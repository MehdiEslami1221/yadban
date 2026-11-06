import { webcrypto, randomBytes } from 'node:crypto';
import { writeFile, access } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
try {
  await access('.dev.vars');
  console.error('.dev.vars already exists. Back it up and remove it before generating new keys.');
  process.exit(1);
} catch {}
const prompt = createInterface({ input: stdin, output: stdout });
console.log('Create credentials for your personal deployment. Input is visible in this terminal.');
const password = await prompt.question('Choose a password (at least 12 characters): ');
prompt.close();
if (password.length < 12 || password.length > 256)
  throw new Error('Password must contain 12–256 characters.');
const salt = randomBytes(16),
  key = await webcrypto.subtle.importKey('raw', Buffer.from(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
const bits = await webcrypto.subtle.deriveBits(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 },
  key,
  256,
);
const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
]);
const pub = await webcrypto.subtle.exportKey('raw', pair.publicKey),
  priv = await webcrypto.subtle.exportKey('jwk', pair.privateKey);
const secrets = {
  PASSWORD_HASH: `pbkdf2$100000$${salt.toString('base64url')}$${Buffer.from(bits).toString('base64url')}`,
  SESSION_SECRET: randomBytes(32).toString('base64url'),
  VAPID_PUBLIC_KEY: Buffer.from(pub).toString('base64url'),
  VAPID_PRIVATE_KEY: priv.d,
};
await writeFile(
  '.dev.vars',
  Object.entries(secrets)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join('\n') + '\n',
  { mode: 0o600, flag: 'wx' },
);
console.log('Local secrets written to .dev.vars. This file is ignored by Git. Keep it private.');
