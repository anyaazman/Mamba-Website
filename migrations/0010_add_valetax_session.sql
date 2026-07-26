-- Valetax partner-portal session token store (single row).
-- The operator logs in via the admin dashboard (human-keyed CAPTCHA); the
-- resulting short-lived FX-Token is stored here and reused for reconciliation
-- calls until it expires, at which point the dashboard re-prompts for a login.
-- Run: wrangler d1 execute mamba-db --remote --file=migrations/0010_add_valetax_session.sql

CREATE TABLE IF NOT EXISTS valetax_session (
    id          INTEGER PRIMARY KEY CHECK (id = 1),  -- enforce a single row
    token       TEXT,
    expires_at  TEXT,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
