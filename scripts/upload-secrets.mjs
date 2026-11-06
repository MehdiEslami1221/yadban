import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const entries = Object.fromEntries(
  (await readFile('.dev.vars', 'utf8'))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), JSON.parse(line.slice(i + 1))];
    }),
);
for (const key of ['PASSWORD_HASH', 'SESSION_SECRET', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'])
  if (!entries[key]) throw new Error(`Missing ${key}. Run npm run setup first.`);
const child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'secret', 'bulk'], {
  stdio: ['pipe', 'inherit', 'inherit'],
});
child.stdin.end(JSON.stringify(entries));
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
