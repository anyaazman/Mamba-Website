-- Add event tracking for pageviews and business events
-- Run: wrangler d1 execute mamba-db --remote --file=migrations/0003_add_events.sql

CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL CHECK(type IN ('pageview','register','login','ib_request','mt5_added','whitelist_request','password_reset')),
    page       TEXT DEFAULT '',
    referrer   TEXT DEFAULT '',
    title      TEXT DEFAULT '',
    user_id    INTEGER,
    metadata   TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
