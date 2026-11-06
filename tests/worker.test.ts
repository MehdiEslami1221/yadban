import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import worker from '../worker/index.ts';
import { hashPassword, issueSession, authenticated, base64url } from '../worker/auth.ts';
import { safeEndpoint } from '../worker/validation.ts';
import { dispatchDue } from '../worker/push.ts';
import type { Env } from '../worker/types.ts';
let env: Env, proxy: Awaited<ReturnType<typeof getPlatformProxy>>, temp: string, token: string;
const origin = 'https://yadban.example';
async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie = token,
  requestOrigin = origin,
) {
  return worker.fetch(
    new Request(origin + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: requestOrigin,
        ...(cookie ? { Cookie: `yadban_session=${cookie}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
}
const sample = (time = Date.now() + 3600000) => ({
  title: 'Home installment',
  category: 'installment',
  amount: 1250000,
  due: new Date(time).toISOString(),
  timezone: 'Asia/Tehran',
  repeat: 'none',
  lead: 60,
  note: 'Monthly payment',
});
async function clear() {
  await env.DB.batch(
    [
      'DELETE FROM deliveries',
      'DELETE FROM subscriptions',
      'DELETE FROM reminders',
      'DELETE FROM login_attempts',
    ].map((s) => env.DB.prepare(s)),
  );
}
async function addReminder(time = Date.now() - 1000) {
  const r = await request('/api/reminders', 'POST', { items: [{ ...sample(time), lead: 0 }] });
  assert.equal(r.status, 201);
  return ((await r.json()) as { id: string }[])[0].id;
}
async function device() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const raw = await crypto.subtle.exportKey('raw', pair.publicKey);
  const body = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-' + crypto.randomUUID(),
    keys: {
      p256dh: base64url(new Uint8Array(raw)),
      auth: base64url(crypto.getRandomValues(new Uint8Array(16))),
    },
    language: 'en',
  };
  assert.equal((await request('/api/push/subscribe', 'POST', body)).status, 200);
  return body;
}
before(async () => {
  process.env.CLOUDFLARE_CF_FETCH_ENABLED = 'false';
  temp = await mkdtemp(join(tmpdir(), 'yadban-test-'));
  proxy = await getPlatformProxy({ configPath: 'tests/wrangler.json', persist: { path: temp } });
  env = {
    ...(proxy.env as { DB: D1Database }),
    ASSETS: { fetch: async () => new Response('asset') },
    PASSWORD_HASH: await hashPassword('test-only-password-123'),
    SESSION_SECRET: 'test-only-secret-012345678901234567890123456789',
    VAPID_SUBJECT: 'https://example.com',
  } as unknown as Env;
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  env.VAPID_PUBLIC_KEY = base64url(
    new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)),
  );
  env.VAPID_PRIVATE_KEY = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d;
  const sql = await readFile('migrations/0001_initial.sql', 'utf8');
  await env.DB.batch(
    sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => env.DB.prepare(s)),
  );
  token = await issueSession(env);
});
after(async () => {
  await proxy?.dispose();
  if (temp) await rm(temp, { recursive: true, force: true });
});
test('private routes require a session', async () => {
  assert.equal((await request('/api/reminders', 'GET', undefined, '')).status, 401);
  assert.equal((await request('/api/push/status', 'GET', undefined, '')).status, 401);
});
test('login uses secure cookies and cross-origin writes are rejected', async () => {
  assert.equal((await request('/api/login', 'POST', { password: 'wrong' }, '')).status, 401);
  const r = await request('/api/login', 'POST', { password: 'test-only-password-123' }, '');
  assert.equal(r.status, 200);
  for (const part of ['HttpOnly', 'Secure', 'SameSite=Strict'])
    assert.ok(r.headers.get('Set-Cookie')!.includes(part));
  assert.equal(
    (
      await request(
        '/api/reminders',
        'POST',
        { items: [sample()] },
        token,
        'https://attacker.example',
      )
    ).status,
    403,
  );
});
test('expired, tampered and password-rotated sessions fail closed', async () => {
  const expired = await issueSession(env, Date.now() - 8 * 86400000);
  assert.equal((await request('/api/reminders', 'GET', undefined, expired)).status, 401);
  assert.equal((await request('/api/reminders', 'GET', undefined, token + 'x')).status, 401);
  assert.equal(
    await authenticated(new Request(origin, { headers: { Cookie: `yadban_session=${token}` } }), {
      ...env,
      PASSWORD_HASH: await hashPassword('replacement-password'),
    }),
    false,
  );
});
test('invalid series inserts nothing; valid series persists atomically', async () => {
  await clear();
  assert.equal(
    (await request('/api/reminders', 'POST', { items: [sample(), { ...sample(), amount: -1 }] }))
      .status,
    400,
  );
  assert.deepEqual(await (await request('/api/reminders')).json(), []);
  assert.equal(
    (await request('/api/reminders', 'POST', { items: [sample(), sample(Date.now() + 86400000)] }))
      .status,
    201,
  );
  assert.equal(((await (await request('/api/reminders')).json()) as unknown[]).length, 2);
});
test('edit, completion, undo and deletion persist', async () => {
  await clear();
  const id = await addReminder();
  let r = await request('/api/reminders', 'PATCH', { id, title: 'Updated', lead: 1440 });
  assert.equal(((await r.json()) as { title: string }).title, 'Updated');
  r = await request('/api/reminders', 'PATCH', { id, completed: true });
  assert.equal(((await r.json()) as { completed: boolean }).completed, true);
  r = await request('/api/reminders', 'PATCH', { id, completed: false });
  assert.equal(((await r.json()) as { completed: boolean }).completed, false);
  assert.equal((await request('/api/reminders?id=' + id, 'DELETE')).status, 200);
  assert.equal((await request('/api/reminders', 'PATCH', { id, title: 'Missing' })).status, 404);
});
test('untrusted push endpoints and invalid keys are rejected', async () => {
  for (const url of [
    'http://fcm.googleapis.com/x',
    'https://localhost/x',
    'https://127.0.0.1/x',
    'https://fcm.googleapis.com.attacker.example/x',
    'https://user@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
  ])
    assert.equal(safeEndpoint(url), false);
  assert.equal(
    (
      await request('/api/push/subscribe', 'POST', {
        endpoint: 'https://fcm.googleapis.com/x',
        keys: { p256dh: 'bad', auth: 'bad' },
      })
    ).status,
    400,
  );
});
test('scheduler encrypts messages and does not resend accepted deliveries', async () => {
  await clear();
  await addReminder();
  await device();
  let calls = 0;
  const transport: typeof fetch = async (_url, init) => {
    calls++;
    assert.equal(new Headers(init?.headers).get('content-encoding'), 'aes128gcm');
    assert.ok((init?.body as Uint8Array).byteLength > 100);
    return new Response(null, { status: 201 });
  };
  const now = Date.now();
  assert.equal((await dispatchDue(env, now, transport)).sent, 1);
  assert.equal((await dispatchDue(env, now + 1000, transport)).sent, 0);
  assert.equal(calls, 1);
});
test('completed, future and stale reminders do not notify', async () => {
  await clear();
  const id = await addReminder();
  await request('/api/reminders', 'PATCH', { id, completed: true });
  await addReminder(Date.now() + 3600000);
  await addReminder(Date.now() - 2 * 86400000);
  await device();
  let calls = 0;
  await dispatchDue(env, Date.now(), async () => {
    calls++;
    return new Response(null, { status: 201 });
  });
  assert.equal(calls, 0);
});
test('delivery failures back off and expired subscriptions are removed', async () => {
  await clear();
  await addReminder();
  await device();
  const now = Date.now();
  let calls = 0;
  const transport: typeof fetch = async () => {
    calls++;
    return new Response(null, { status: 503 });
  };
  await dispatchDue(env, now, transport);
  await dispatchDue(env, now + 1000, transport);
  assert.equal(calls, 1);
  await dispatchDue(env, now + 300001, async () => new Response(null, { status: 410 }));
  assert.equal(
    (await env.DB.prepare('SELECT COUNT(*) n FROM subscriptions').first<{ n: number }>())?.n,
    0,
  );
});
test('existing delivery history does not starve new jobs', async () => {
  await clear();
  await device();
  for (let i = 0; i < 3; i++) {
    const r = await request('/api/reminders', 'POST', {
      items: Array.from({ length: 34 }, () => ({ ...sample(Date.now() - 1000), lead: 0 })),
    });
    assert.equal(r.status, 201);
  }
  await env.DB.prepare(
    "INSERT INTO deliveries(reminder_id,subscription_id,revision,status,sent_at) SELECT r.id,s.id,r.revision,'sent',? FROM reminders r CROSS JOIN subscriptions s LIMIT 100",
  )
    .bind(Date.now())
    .run();
  assert.equal(
    (await dispatchDue(env, Date.now(), async () => new Response(null, { status: 201 }))).sent,
    2,
  );
});
test('login attempts are rate limited', async () => {
  await clear();
  for (let i = 0; i < 10; i++)
    assert.equal((await request('/api/login', 'POST', { password: 'wrong' }, '')).status, 401);
  assert.equal((await request('/api/login', 'POST', { password: 'wrong' }, '')).status, 429);
});
