import { buildPushPayload } from '@block65/webcrypto-web-push';
import type { Env } from './types';
import { safeEndpoint } from './validation';
type Job = {
  reminder_id: string;
  subscription_id: string;
  revision: number;
  attempts: number;
  title: string;
  due: string;
  timezone: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  language: string;
};
export function pushConfigured(env: Env) {
  return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}
export async function sendPush(
  env: Env,
  sub: { endpoint: string; p256dh: string; auth: string },
  data: object,
  transport: typeof fetch = fetch,
) {
  if (!safeEndpoint(sub.endpoint)) throw new Error('Unsupported push provider');
  const payload = await buildPushPayload(
    { data: JSON.stringify(data), options: { ttl: 3600 } },
    { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    {
      subject: env.VAPID_SUBJECT!,
      publicKey: env.VAPID_PUBLIC_KEY!,
      privateKey: env.VAPID_PRIVATE_KEY!,
    },
  );
  return transport(sub.endpoint, {
    ...payload,
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
}
export async function dispatchDue(env: Env, now = Date.now(), transport: typeof fetch = fetch) {
  await env.DB.prepare(
    "INSERT INTO runtime_state(key,value) VALUES('last_cron',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  )
    .bind(String(now))
    .run();
  if (!pushConfigured(env)) return { sent: 0, configured: false };
  await env.DB.prepare(
    `INSERT OR IGNORE INTO deliveries(reminder_id,subscription_id,revision) SELECT r.id,s.id,r.revision FROM reminders r CROSS JOIN subscriptions s WHERE r.completed=0 AND r.notify_at<=? AND r.notify_at>=? AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.reminder_id=r.id AND d.subscription_id=s.id AND d.revision=r.revision) LIMIT 100`,
  )
    .bind(now, now - 86400000)
    .run();
  const jobs = await env.DB.prepare(
    `SELECT d.*,r.title,r.due,r.timezone,s.endpoint,s.p256dh,s.auth,s.language FROM deliveries d JOIN reminders r ON r.id=d.reminder_id AND r.revision=d.revision JOIN subscriptions s ON s.id=d.subscription_id WHERE r.completed=0 AND r.notify_at<=? AND r.notify_at>=? AND d.status!='sent' AND d.attempts<5 AND d.next_attempt<=? AND d.lease_until<=? ORDER BY r.notify_at LIMIT 5`,
  )
    .bind(now, now - 86400000, now, now)
    .all<Job>();
  let sent = 0;
  for (const job of jobs.results) {
    const claim = crypto.randomUUID();
    const locked = await env.DB.prepare(
      `UPDATE deliveries SET claim=?,lease_until=?,attempts=attempts+1 WHERE reminder_id=? AND subscription_id=? AND revision=? AND status!='sent' AND attempts<5 AND lease_until<=?`,
    )
      .bind(claim, now + 120000, job.reminder_id, job.subscription_id, job.revision, now)
      .run();
    if (!locked.meta.changes) continue;
    let status = 0;
    try {
      const when = new Intl.DateTimeFormat(job.language === 'fa' ? 'fa-IR' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: job.timezone,
      }).format(new Date(job.due));
      const r = await sendPush(
        env,
        job,
        { title: job.title, body: when, tag: `reminder-${job.reminder_id}`, url: '/' },
        transport,
      );
      status = r.status;
      if (r.ok) {
        await env.DB.prepare(
          "UPDATE deliveries SET status='sent',sent_at=?,last_status=?,lease_until=0 WHERE claim=?",
        )
          .bind(now, status, claim)
          .run();
        sent++;
        continue;
      }
      if (status === 404 || status === 410) {
        await env.DB.prepare('DELETE FROM subscriptions WHERE id=?')
          .bind(job.subscription_id)
          .run();
        continue;
      }
    } catch {
      status = 0;
    }
    await env.DB.prepare(
      "UPDATE deliveries SET status='failed',last_status=?,next_attempt=?,lease_until=0 WHERE claim=?",
    )
      .bind(status, now + Math.min(3600000, 300000 * 2 ** job.attempts), claim)
      .run();
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM login_attempts WHERE reset_at<?').bind(now),
    env.DB.prepare(
      'DELETE FROM deliveries WHERE sent_at<? OR reminder_id IN (SELECT id FROM reminders WHERE notify_at<?)',
    ).bind(now - 30 * 86400000, now - 30 * 86400000),
  ]);
  return { sent, configured: true };
}
