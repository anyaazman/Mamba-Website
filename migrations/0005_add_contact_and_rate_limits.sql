-- Contact form storage + D1-backed rate limiting
-- Run: wrangler d1 execute mamba-db --remote --file=migrations/0005_add_contact_and_rate_limits.sql

CREATE TABLE IF NOT EXISTS contacts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT NOT NULL,
    message    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);

-- Fixed-window rate limit buckets (key = scope:ip:bucket)
CREATE TABLE IF NOT EXISTS rate_limits (
    rl_key     TEXT PRIMARY KEY,
    count      INTEGER NOT NULL DEFAULT 1,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);
