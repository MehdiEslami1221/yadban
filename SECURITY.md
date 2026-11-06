# Security

Yadban is a single-owner deployment. Anyone with its password can access all reminders and register devices. Do not share an instance between unrelated users who require separate data access.

- Salted PBKDF2-SHA256 password verification; setup requires at least 12 characters. Choose a long unique passphrase.
- Signed HttpOnly, SameSite=Strict sessions with seven-day expiry and Secure cookies over HTTPS.
- Password or signing-secret changes invalidate old sessions. Signing out clears the current cookie but does not revoke copies of stolen cookies globally.
- Same-origin checks on mutations; no cross-origin API access.
- Login attempts limited to ten per hashed client IP per fifteen minutes. Consider additional edge limits for widely exposed deployments.
- Push endpoints restricted to known browser providers; redirects are refused.
- Encrypted push payloads, but reminder titles may appear on lock screens.
- No private data cached by the service worker.

Keep secrets, cookies, database exports and subscription URLs private. Do not include them in public issues or logs. Use private vulnerability reporting if enabled, otherwise contact the maintainer using the contact details linked from their profile.
