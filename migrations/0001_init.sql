-- Mamba Client Portal - Schema v3
-- Run: wrangler d1 execute mamba-db --file=migrations/0001_init.sql

CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    password        TEXT NOT NULL,
    recovery_phrase TEXT NOT NULL,
    ib_status       TEXT NOT NULL DEFAULT 'pending' CHECK(ib_status IN ('pending','approved','rejected')),
    ib_email        TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_ib_status ON users(ib_status);

CREATE TABLE IF NOT EXISTS mt5_accounts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    account_number  TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mt5_user_id ON mt5_accounts(user_id);

CREATE TABLE IF NOT EXISTS tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    token      TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON tokens(user_id);

CREATE TABLE IF NOT EXISTS admin_keys (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash   TEXT NOT NULL UNIQUE,
    label      TEXT DEFAULT 'default',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
