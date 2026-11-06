CREATE TABLE reminders (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0,
 due TEXT NOT NULL, timezone TEXT NOT NULL, repeat TEXT NOT NULL DEFAULT 'none', lead INTEGER NOT NULL,
 note TEXT NOT NULL DEFAULT '', completed INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL,
 notify_at INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX reminders_due ON reminders(completed, notify_at);
CREATE TABLE subscriptions (id TEXT PRIMARY KEY, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'en', created INTEGER NOT NULL);
CREATE TABLE deliveries (
 reminder_id TEXT NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
 subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0, claim TEXT,
 sent_at INTEGER, last_status INTEGER, PRIMARY KEY(reminder_id,subscription_id,revision)
);
CREATE TABLE login_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE TABLE runtime_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
