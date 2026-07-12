-- Allow the 'whitelist_synced' event type.
--
-- request-whitelist.js records 'whitelist_synced' when an MT5 account is
-- auto-approved against the trading backend, but the original CHECK constraint
-- didn't list that type, so every such INSERT failed the constraint and was
-- swallowed by recordEvent's try/catch — the approvals worked, the events were
-- silently lost. SQLite can't ALTER a CHECK constraint, so rebuild the table.
--
-- Run: wrangler d1 execute mamba-db --remote --file=migrations/0006_add_whitelist_synced_event.sql

CREATE TABLE events_v2 (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL CHECK(type IN ('pageview','register','login','ib_request','mt5_added','whitelist_request','whitelist_synced','password_reset')),
    page       TEXT DEFAULT '',
    referrer   TEXT DEFAULT '',
    title      TEXT DEFAULT '',
    user_id    INTEGER,
    metadata   TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO events_v2 (id, type, page, referrer, title, user_id, metadata, created_at)
    SELECT id, type, page, referrer, title, user_id, metadata, created_at FROM events;

DROP TABLE events;

ALTER TABLE events_v2 RENAME TO events;

CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
