import type { Env } from './types';
const encoder = new TextEncoder();
export function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
export function decode(value: string) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
}
export async function hashPassword(
  password: string,
  salt = crypto.getRandomValues(new Uint8Array(16)),
) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 },
    key,
    256,
  );
  return `pbkdf2$100000$${base64url(salt)}$${base64url(new Uint8Array(bits))}`;
}
export async function verifyPassword(password: string, stored: string) {
  if (!/^pbkdf2\$100000\$[\w-]+\$[\w-]+$/.test(stored)) return false;
  const calculated = await hashPassword(password, decode(stored.split('$')[2]));
  let diff = calculated.length ^ stored.length;
  for (let i = 0; i < stored.length; i++)
    diff |= stored.charCodeAt(i) ^ (calculated.charCodeAt(i) || 0);
  return diff === 0;
}
async function signingKey(env: Env) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(env.SESSION_SECRET + ':' + env.PASSWORD_HASH),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}
export function configured(env: Env) {
  return !!env.PASSWORD_HASH && env.SESSION_SECRET?.length >= 32;
}
export async function issueSession(env: Env, now = Date.now()) {
  const data = base64url(
    encoder.encode(JSON.stringify({ exp: now + 7 * 86400000, nonce: crypto.randomUUID() })),
  );
  const sig = await crypto.subtle.sign('HMAC', await signingKey(env), encoder.encode(data));
  return data + '.' + base64url(new Uint8Array(sig));
}
export async function authenticated(request: Request, env: Env, now = Date.now()) {
  if (!configured(env)) return false;
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('yadban_session='))
    ?.slice(15);
  if (!token || token.length > 1024) return false;
  try {
    const [data, sig, ...rest] = token.split('.');
    if (rest.length || !sig) return false;
    if (
      !(await crypto.subtle.verify(
        'HMAC',
        await signingKey(env),
        decode(sig),
        encoder.encode(data),
      ))
    )
      return false;
    const payload = JSON.parse(new TextDecoder().decode(decode(data)));
    return (
      typeof payload.exp === 'number' && payload.exp > now && payload.exp <= now + 7 * 86400000
    );
  } catch {
    return false;
  }
}
export function sessionCookie(request: Request, token: string) {
  return `yadban_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token ? 604800 : 0}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}
export async function attemptKey(request: Request, env: Env) {
  return base64url(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        encoder.encode(
          env.SESSION_SECRET + ':' + (request.headers.get('CF-Connecting-IP') || 'local'),
        ),
      ),
    ),
  );
}
