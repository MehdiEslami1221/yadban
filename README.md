# Yadban

**A little less to remember.**

Yadban is a self-hosted reminder planner for installments, bills and everyday tasks. It combines a Persian–English interface with a private database and scheduled Web Push notifications.

One deployment belongs to one person. Use the same password on your phone and computer to access the same reminders.

[Installation](#run-locally) · [Deployment](docs/DEPLOYMENT.md) · [Notifications](docs/NOTIFICATIONS.md) · [Architecture](docs/ARCHITECTURE.md)

## Features

- Persian and English interface with RTL/LTR layouts.
- Persian calendar view and locale-aware dates.
- Installment, bill and personal reminder categories.
- Weekly, monthly and yearly series with independently editable occurrences.
- Upcoming totals, overdue reminders, completion history and search.
- Server-scheduled encrypted Web Push with retries and expired-device cleanup.
- Per-device notification controls and a server-generated test notification.
- Installable PWA, calendar export with alarms, and JSON export.
- Password-protected API with HttpOnly sessions and login throttling.

Date entry and monthly/yearly recurrence currently use the **Gregorian calendar**. Persian dates are supported for display and calendar navigation. Amounts are entered in toman; Yadban does not process payments or connect to banks.

## Stack

| Layer                | Technology                                           |
| -------------------- | ---------------------------------------------------- |
| Interface            | Next.js App Router, React, TypeScript                |
| Frontend delivery    | Next.js static export and Workers Static Assets      |
| API and scheduler    | Cloudflare Workers and Cron Triggers                 |
| Database             | Cloudflare D1 / SQLite                               |
| Notifications        | Web Push, VAPID and Service Worker                   |
| Validation and tests | Zod, Node test runner and local D1 integration tests |

The frontend and API share one origin. A Node.js server is not required in production. Docker is not required for local development.

## Run locally

Requirements: **Node.js 22.13 or newer**, npm and Git. These commands work in PowerShell, macOS and Linux terminals.

```sh
git clone https://github.com/MehdiEslami1221/yadban.git
cd yadban
npm ci
npm run setup
npm run build
npm run db:local
npm run preview
```

Open the local URL printed by Wrangler, normally `http://localhost:8787`, and sign in with the password chosen during setup. The setup prompt shows typed characters; use a private terminal.

Setup generates a password hash, session secret and VAPID key pair in the ignored `.dev.vars` file. It does not store the plaintext password. No Cloudflare account is required for local D1 development.

After frontend edits, use `npm run dev` to rebuild and launch the full application. Worker edits reload during the session. Local Cron events must be simulated manually; they do not run automatically every five minutes.

## Deploy your own instance

Follow [the deployment guide](docs/DEPLOYMENT.md) to create a database, set your own secrets and deploy to your Cloudflare account. A custom domain is optional.

The configuration targets small personal deployments and runs the scheduler every five minutes. Free tiers have request, database and CPU limits. Check usage and delivery behavior in your account; this project does not promise unlimited or permanently free hosting.

Never upload `.dev.vars`, access tokens, database backups or local runtime state to a public repository.

## Notification behavior

Web Push can deliver while the page is closed when the app is deployed, the scheduler is running and the device has granted permission. Provider acceptance is not proof that a notification was displayed.

On iPhone and iPad, add the app to the Home Screen before enabling notifications; support starts with iOS/iPadOS 16.4. Connectivity, browser settings, Focus mode and power restrictions can delay or suppress delivery.

Complete the [real-device acceptance test](docs/NOTIFICATIONS.md) before relying on reminders for actual deadlines.

## Checks

```sh
npm run check
npm run format:check
```

Tests cover authentication, cookie expiry, cross-origin writes, atomic series creation, CRUD operations, endpoint validation, payload encryption, delivery deduplication, retries, queue progression, month-end dates, daylight saving and calendar export. Provider responses are mocked; real-device delivery requires separate verification.

## Project structure

| Directory     | Purpose                                                      |
| ------------- | ------------------------------------------------------------ |
| `app/`        | Login, dashboard, calendar, translations and device settings |
| `worker/`     | Authenticated API, validation and scheduled delivery         |
| `public/`     | Manifest, service worker, icons and asset headers            |
| `migrations/` | Versioned database schema                                    |
| `scripts/`    | Cross-platform setup and secret upload                       |
| `tests/`      | Date handling and local D1 integration tests                 |
| `docs/`       | Deployment, notification, architecture and usage guides      |

## Current scope

- Single-owner deployment; no public registration or separate user accounts.
- Up to 36 occurrences per series, 5,000 stored reminders and 10 devices.
- Five device deliveries per scheduler invocation; a backlog can delay alerts.
- No SMS, email, banking integration or automatic payment.
- Online access is required for reading and changing records; private data is not cached offline.
- JSON export is available, but one-click import is not. Use private D1 exports for full recovery.
- Calendar exports are snapshots and do not synchronize subsequent edits or completion status.

## Author

[Mehdi Eslami](https://github.com/MehdiEslami1221) · [ejrasys.ir](https://ejrasys.ir)

## License

[MIT](LICENSE)
