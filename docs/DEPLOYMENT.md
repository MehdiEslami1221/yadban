# Deployment

## Prepare

Complete the README's local setup and run `npm run check`. Keep `.dev.vars` private. Every deployment needs its own credentials.

```sh
npx wrangler login
npx wrangler d1 create yadban
```

Copy the returned database ID into `d1_databases[0].database_id` in `wrangler.jsonc`, replacing the all-zero placeholder. Keep the binding name `DB`. If you choose another database name, update `database_name` as well.

Set the Worker `name` to your preferred name. Set `vars.VAPID_SUBJECT` to a contact URL you control or a valid `mailto:` address. This is a public contact identifier, not a private key.

## Apply the schema and deploy

```sh
npm run db:remote
npm run deploy
npm run secrets:upload
npm run deploy
```

Check the account and database displayed by Wrangler before applying remote migrations. Local records are not uploaded.

The first deployment creates the Worker. Authentication fails closed until secrets are configured. The upload helper reads `.dev.vars` and passes values to Wrangler through standard input without printing them or writing another secret file. The last deployment ensures the current code and secrets are active together.

| Secret              | Purpose                         |
| ------------------- | ------------------------------- |
| `PASSWORD_HASH`     | Salted PBKDF2 password verifier |
| `SESSION_SECRET`    | Session signing secret          |
| `VAPID_PUBLIC_KEY`  | Application-server public key   |
| `VAPID_PRIVATE_KEY` | Private push signing key        |

CI checks the repository only; it does not deploy or need Cloudflare credentials.

## Verify

1. Open the HTTPS URL returned by Wrangler and sign in.
2. Create a reminder, reload, and confirm persistence.
3. Sign in on another device and verify the same records appear.
4. Follow [NOTIFICATIONS.md](NOTIFICATIONS.md) to test background delivery.
5. Check Worker logs, CPU usage and the scheduler heartbeat in Settings.

Cron is configured as `*/5 * * * *`. Configuration changes can take time to propagate. Publishing source code to GitHub does not deploy or configure your Cloudflare account.

## Update

```sh
git pull
npm ci
npm run check
npm run db:remote
npm run deploy
```

Back up data before schema changes. Migrations are append-only: do not edit files already applied to production.

## Back up and restore

The UI exports reminder records as JSON. For a full backup including subscriptions and delivery history:

```sh
npx wrangler d1 export DB --remote --output yadban-backup.sql
```

Store exports privately. To restore into a **new empty database**, update the binding to that database and run:

```sh
npx wrangler d1 execute DB --remote --file yadban-backup.sql
```

Inspect the selected account/database before restoring. Do not import a full dump over an active database without a recovery plan. Preserve the original VAPID keys if existing device subscriptions must continue working.

## Rotate credentials

There is no email password reset. The deployment owner manages secrets through Cloudflare.

To replace all credentials, privately back up `.dev.vars`, remove it, run `npm run setup`, upload the secrets and deploy. Existing sessions become invalid. Because this also rotates VAPID keys, disable and re-enable notifications on every device.

For password-only rotation, replace only `PASSWORD_HASH` and optionally `SESSION_SECRET` through Wrangler secret commands; keep the VAPID pair. A changed password hash invalidates old session signatures.

## Custom domain

Add a Custom Domain in the Cloudflare dashboard and complete its DNS setup. Moving to another origin requires signing in and enabling notifications again because permissions and subscriptions are origin-specific.

## Free-tier limits

Bounded batches and static assets keep the deployment small, but provider limits still apply. Check request, D1 and CPU usage under your actual workload. Password verification and notification cryptography must fit the selected plan's CPU budget. Resource-limit errors need reduced load or a suitable hosting plan.

References:

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Runtime secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
