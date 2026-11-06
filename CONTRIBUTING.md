# Contributing

Describe the problem or intended behavior in a focused issue. Keep changes small and include tests for authentication, scheduling, persistence and date behavior.

```sh
npm ci
npm run check
npm run format:check
```

Use `npm run format` to format changes. Keep documentation and code comments in English; user-facing text should support English and Persian.

Add schema changes as new migrations. Never commit credentials, personal records, database dumps or build output. Describe real-device verification when changing notification delivery and document any unverified behavior.
