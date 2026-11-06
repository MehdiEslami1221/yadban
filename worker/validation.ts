import { z } from 'zod';
export const reminderInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    category: z.enum(['installment', 'bill', 'personal']),
    amount: z.number().finite().min(0).max(1e15),
    due: z
      .string()
      .datetime()
      .refine(
        (v) =>
          Number.isFinite(Date.parse(v)) && Date.parse(v) >= 0 && Date.parse(v) < 4102444800000,
      ),
    timezone: z
      .string()
      .max(80)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }),
    repeat: z.literal('none'),
    lead: z.number().int().min(0).max(43200),
    note: z.string().max(1000),
  })
  .strict();
export function safeEndpoint(endpoint: string) {
  try {
    const u = new URL(endpoint),
      h = u.hostname;
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      (h === 'fcm.googleapis.com' ||
        h.endsWith('.push.services.mozilla.com') ||
        h.endsWith('.push.apple.com') ||
        h.endsWith('.notify.windows.com'))
    );
  } catch {
    return false;
  }
}
function keyOfLength(length: number) {
  return z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .refine((s) => {
      try {
        return atob(s.replace(/-/g, '+').replace(/_/g, '/')).length === length;
      } catch {
        return false;
      }
    });
}
export const subscriptionInput = z.object({
  endpoint: z.string().max(2048).refine(safeEndpoint),
  keys: z.object({ p256dh: keyOfLength(65), auth: keyOfLength(16) }),
  language: z.enum(['en', 'fa']).default('en'),
});
