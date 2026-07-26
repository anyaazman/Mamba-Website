-- Allow the 'account_deletion_request' event type.
--
-- request-deletion.js:33 records this type with the comment "Durable record so
-- the request survives even if Telegram is unavailable" — but the type is not
-- in the events CHECK constraint, so the INSERT fails, and recordEvent swallows
-- the error in a try/catch (_helpers.js:133). The endpoint therefore returns
-- 201 "your deletion request has been received" while persisting nothing. The
-- only surviving trace is the fire-and-forget Telegram message that the durable
-- record was specifically meant to back up.
--
-- This matters beyond data hygiene: Google Play and the App Store both require
-- a working account-deletion path, and account-deletion.html is the published
-- URL for it. A missed Telegram message currently means the request is gone.
--
-- This is the same defect 0006 fixed for 'whitelist_synced'. SQLite cannot
-- ALTER a CHECK constraint, so the table is rebuilt exactly as 0006 did:
-- create, copy, drop, rename, recreate indexes.
--
-- Verified before shipping: pre-migration the INSERT fails with
-- "CHECK constraint failed" and the row count stays flat; post-migration it
-- succeeds and existing rows are preserved.
--
-- Run: wrangler d1 execute mamba-db --remote --file=migrations/0009_add_account_deletion_request_event.sql

CREATE TABLE events_v3 (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL CHECK(type IN ('pageview','register','login','ib_request','mt5_added','whitelist_request','whitelist_synced','password_reset','account_deletion_request')),
    page       TEXT DEFAULT '',
    referrer   TEXT DEFAULT '',
    title      TEXT DEFAULT '',
    user_id    INTEGER,
    metadata   TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO events_v3 (id, type, page, referrer, title, user_id, metadata, created_at)
    SELECT id, type, page, referrer, title, user_id, metadata, created_at FROM events;

DROP TABLE events;

ALTER TABLE events_v3 RENAME TO events;

CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
