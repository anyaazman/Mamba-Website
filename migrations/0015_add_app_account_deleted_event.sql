-- Allow the 'app_account_deleted' event type.
--
-- 'app_account_deleted'  api/backend/account-deleted.js — a client deleted their
--                        account in the app, the Bridge removed it from farm.db
--                        and told the website, which reset an 'approved' row to
--                        "not whitelisted". The row is the durable record of
--                        why an account the operator approved is pending again.
--
-- recordEvent swallows insert errors, so until this runs the endpoint still
-- resets the account and alerts on Telegram; only the event row is missing.
--
-- SQLite cannot ALTER a CHECK constraint, so the table is rebuilt exactly as
-- 0006, 0009 and 0014 did: create, copy, drop, rename, recreate indexes.
--
-- Run: wrangler d1 execute mamba-db --remote --file=migrations/0015_add_app_account_deleted_event.sql

CREATE TABLE events_v5 (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL CHECK(type IN ('pageview','register','login','ib_request','mt5_added','whitelist_request','whitelist_synced','password_reset','account_deletion_request','whitelist_sync_failed','whitelist_orphaned','app_account_deleted')),
    page       TEXT DEFAULT '',
    referrer   TEXT DEFAULT '',
    title      TEXT DEFAULT '',
    user_id    INTEGER,
    metadata   TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO events_v5 (id, type, page, referrer, title, user_id, metadata, created_at)
    SELECT id, type, page, referrer, title, user_id, metadata, created_at FROM events;

DROP TABLE events;

ALTER TABLE events_v5 RENAME TO events;

CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
