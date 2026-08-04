-- Allow the 'whitelist_sync_failed' and 'whitelist_orphaned' event types.
--
-- Both record a divergence between D1 and the trading backend's farm.db, and
-- both are useless without a durable row. recordEvent swallows insert errors in
-- a try/catch (_helpers.js), so without this migration the CHECK constraint
-- rejects them silently and the endpoints report success having persisted
-- nothing — the same defect 0006 fixed for 'whitelist_synced' and 0009 for
-- 'account_deletion_request'.
--
-- 'whitelist_sync_failed'  admin/whitelist.js — the operator approved or
--                          rejected an account, D1 was updated, and the backend
--                          did not confirm. On an approval the client is shown
--                          "approved" while the Bridge still refuses the login.
--
-- 'whitelist_orphaned'     admin/delete-user.js — a user was deleted from the
--                          portal but removing their MT5 account from the
--                          backend whitelist failed. The account can still
--                          trade. This one is the reason the row matters more
--                          than the Telegram alert: the D1 rows naming the
--                          account are deleted milliseconds later, so if the
--                          message is missed, nothing on either side remembers
--                          which account was left behind.
--
-- SQLite cannot ALTER a CHECK constraint, so the table is rebuilt exactly as
-- 0006 and 0009 did: create, copy, drop, rename, recreate indexes.
--
-- Verified: pre-migration both INSERTs fail with "CHECK constraint failed" and
-- tests/whitelist-sync-reporting.spec.js reports the missing rows;
-- post-migration they succeed and existing rows are preserved.
--
-- Run: wrangler d1 execute mamba-db --remote --file=migrations/0014_add_whitelist_divergence_events.sql

CREATE TABLE events_v4 (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL CHECK(type IN ('pageview','register','login','ib_request','mt5_added','whitelist_request','whitelist_synced','password_reset','account_deletion_request','whitelist_sync_failed','whitelist_orphaned')),
    page       TEXT DEFAULT '',
    referrer   TEXT DEFAULT '',
    title      TEXT DEFAULT '',
    user_id    INTEGER,
    metadata   TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO events_v4 (id, type, page, referrer, title, user_id, metadata, created_at)
    SELECT id, type, page, referrer, title, user_id, metadata, created_at FROM events;

DROP TABLE events;

ALTER TABLE events_v4 RENAME TO events;

CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
