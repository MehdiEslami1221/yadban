import { z } from 'zod';
import type { Env, Reminder } from './types';
import {
  authenticated,
  attemptKey,
  configured,
  issueSession,
  sameOrigin,
  sessionCookie,
  verifyPassword,
} from './auth';
import { reminderInput, subscriptionInput } from './validation';
import { dispatchDue, pushConfigured, sendPush } from './push';
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  });
const output = (row: Reminder) => ({ ...row, completed: !!row.completed });
async function body(request: Request) {
  if (Number(request.headers.get('content-length') || 0) > 131072)
    throw new Error('Body too large');
  const text = await request.text();
  if (text.length > 131072) throw new Error('Body too large');
  return JSON.parse(text);
}
async function api(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url),
    path = url.pathname,
    method = request.method;
  if (method !== 'GET' && !sameOrigin(request)) return json({ error: 'Invalid origin' }, 403);
  if (path === '/api/session' && method === 'GET')
    return json({ authenticated: await authenticated(request, env), configured: configured(env) });
  if (path === '/api/login' && method === 'POST') {
    if (!configured(env))
      return json({ error: 'Run the setup script and configure the server secrets.' }, 503);
    const key = await attemptKey(request, env),
      now = Date.now();
    const attempt = await env.DB.prepare(
      `INSERT INTO login_attempts(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<=? THEN ? ELSE reset_at END RETURNING attempts`,
    )
      .bind(key, now + 900000, now, now, now + 900000)
      .first<{ attempts: number }>();
    if (attempt && attempt.attempts > 10)
      return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429, {
        'Retry-After': '900',
      });
    const { password } = z
      .object({ password: z.string().min(1).max(256) })
      .parse(await body(request));
    if (!(await verifyPassword(password, env.PASSWORD_HASH)))
      return json({ error: 'Incorrect password.' }, 401);
    await env.DB.prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();
    return json({ ok: true }, 200, {
      'Set-Cookie': sessionCookie(request, await issueSession(env)),
    });
  }
  if (path === '/api/logout' && method === 'POST')
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, '') });
  if (!(await authenticated(request, env))) return json({ error: 'Please sign in.' }, 401);
  if (path === '/api/reminders') {
    if (method === 'GET') {
      const rows = await env.DB.prepare('SELECT * FROM reminders ORDER BY due').all<Reminder>();
      return json(rows.results.map(output));
    }
    if (method === 'POST') {
      const { items } = z
        .object({ items: z.array(reminderInput).min(1).max(36) })
        .parse(await body(request));
      const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM reminders').first<{
        n: number;
      }>();
      if ((count?.n || 0) + items.length > 5000)
        return json({ error: 'Reminder limit reached. Remove old records first.' }, 409);
      const rows = items.map((x) => ({
        ...x,
        id: crypto.randomUUID(),
        completed: 0,
        created: new Date().toISOString(),
        notify_at: Date.parse(x.due) - x.lead * 60000,
        revision: 1,
        version: 1,
      }));
      await env.DB.batch(
        rows.map((r) =>
          env.DB.prepare(
            'INSERT INTO reminders(id,title,category,amount,due,timezone,repeat,lead,note,completed,created,notify_at,revision,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          ).bind(
            r.id,
            r.title,
            r.category,
            r.amount,
            r.due,
            r.timezone,
            r.repeat,
            r.lead,
            r.note,
            0,
            r.created,
            r.notify_at,
            1,
            1,
          ),
        ),
      );
      return json(rows.map(output), 201);
    }
    if (method === 'PATCH') {
      const { id, ...values } = z
        .object({ id: z.string().uuid() })
        .passthrough()
        .parse(await body(request));
      const change = reminderInput
        .partial()
        .extend({ completed: z.boolean().optional() })
        .strict()
        .parse(values);
      const old = await env.DB.prepare('SELECT * FROM reminders WHERE id=?')
        .bind(id)
        .first<Reminder>();
      if (!old) return json({ error: 'Not found' }, 404);
      const row = {
        ...old,
        ...change,
        completed: change.completed === undefined ? old.completed : Number(change.completed),
      };
      const requeue =
        change.due !== undefined ||
        change.lead !== undefined ||
        change.title !== undefined ||
        change.completed === false;
      row.revision = old.revision + (requeue ? 1 : 0);
      row.version = old.version + 1;
      row.notify_at = Date.parse(row.due) - row.lead * 60000;
      const results = await env.DB.batch([
        env.DB.prepare(
          'UPDATE reminders SET title=?,category=?,amount=?,due=?,timezone=?,lead=?,note=?,completed=?,notify_at=?,revision=?,version=? WHERE id=? AND version=?',
        ).bind(
          row.title,
          row.category,
          row.amount,
          row.due,
          row.timezone,
          row.lead,
          row.note,
          row.completed,
          row.notify_at,
          row.revision,
          row.version,
          id,
          old.version,
        ),
        env.DB.prepare(
          'DELETE FROM deliveries WHERE reminder_id=? AND revision < (SELECT revision FROM reminders WHERE id=?)',
        ).bind(id, id),
      ]);
      if (!results[0].meta.changes)
        return json({ error: 'This reminder changed. Reload and try again.' }, 409);
      return json(output(row));
    }
    if (method === 'DELETE') {
      const id = z.string().uuid().parse(url.searchParams.get('id'));
      await env.DB.prepare('DELETE FROM reminders WHERE id=?').bind(id).run();
      return json({ ok: true });
    }
  }
  if (path === '/api/push/status' && method === 'GET') {
    const cron = await env.DB.prepare(
      "SELECT value FROM runtime_state WHERE key='last_cron'",
    ).first<{ value: string }>();
    return json({
      configured: pushConfigured(env),
      publicKey: env.VAPID_PUBLIC_KEY || null,
      lastCron: cron ? Number(cron.value) : null,
    });
  }
  if (path === '/api/push/subscribe' && method === 'POST') {
    if (!pushConfigured(env)) return json({ error: 'Push keys are not configured.' }, 503);
    const sub = subscriptionInput.parse(await body(request));
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM subscriptions').first<{
      n: number;
    }>();
    const exists = await env.DB.prepare('SELECT id FROM subscriptions WHERE endpoint=?')
      .bind(sub.endpoint)
      .first();
    if (!exists && (count?.n || 0) >= 10)
      return json({ error: 'At most 10 devices can be registered.' }, 409);
    await env.DB.prepare(
      'INSERT INTO subscriptions(id,endpoint,p256dh,auth,language,created) VALUES(?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,language=excluded.language',
    )
      .bind(
        crypto.randomUUID(),
        sub.endpoint,
        sub.keys.p256dh,
        sub.keys.auth,
        sub.language,
        Date.now(),
      )
      .run();
    return json({ ok: true });
  }
  if (path === '/api/push/unsubscribe' && method === 'POST') {
    const { endpoint } = z.object({ endpoint: z.string().max(2048) }).parse(await body(request));
    await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint=?').bind(endpoint).run();
    return json({ ok: true });
  }
  if (path === '/api/push/test' && method === 'POST') {
    if (!pushConfigured(env)) return json({ error: 'Push keys are not configured.' }, 503);
    const { endpoint } = z.object({ endpoint: z.string().max(2048) }).parse(await body(request));
    const sub = await env.DB.prepare('SELECT * FROM subscriptions WHERE endpoint=?')
      .bind(endpoint)
      .first<{ endpoint: string; p256dh: string; auth: string; language: string }>();
    if (!sub) return json({ error: 'Register this device first.' }, 404);
    const r = await sendPush(env, sub, {
      title: 'Yadban',
      body:
        sub.language === 'fa'
          ? 'اعلان آزمایشی از سرور رسید.'
          : 'Your server sent this test notification.',
      tag: 'yadban-test',
      url: '/',
    });
    return r.ok
      ? json({ ok: true })
      : json({ error: 'Push service rejected the test.', status: r.status }, 502);
  }
  return json({ error: 'Not found' }, 404);
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!new URL(request.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await api(request, env);
    } catch (error) {
      if (
        error instanceof z.ZodError ||
        error instanceof SyntaxError ||
        (error instanceof Error && error.message === 'Body too large')
      )
        return json({ error: 'Invalid request.' }, 400);
      console.error('Request failed', error instanceof Error ? error.name : 'Unknown');
      return json({ error: 'The server could not complete the request.' }, 500);
    }
  },
  async scheduled(_controller: ScheduledController, env: Env) {
    await dispatchDue(env);
  },
};
