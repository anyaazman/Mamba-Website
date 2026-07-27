-- Valetax IB downline snapshots, for reconciliation against the Mamba DB.
--
-- The snapshot is produced by tools/valetax-sync (attended, real browser,
-- human-solved CAPTCHA) and uploaded here. Nothing in the Worker logs into
-- Valetax; this schema only stores what the operator imported.
--
-- Rows are normalised rather than kept as one JSON blob so reconciliation runs
-- as SQL joins and no single row approaches D1's value-size limit.
--
-- Run: wrangler d1 execute mamba-db --remote --file=migrations/0011_add_valetax_snapshot.sql

-- One row per import. Kept as history so a bad import can be compared against
-- the previous good one; reconciliation always uses the newest id.
CREATE TABLE IF NOT EXISTS valetax_snapshots (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    pulled_at    TEXT,                                   -- when the POC pulled from Valetax
    client_count INTEGER NOT NULL DEFAULT 0,
    imported_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per Valetax client in the downline.
CREATE TABLE IF NOT EXISTS valetax_clients (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id     INTEGER NOT NULL,
    valetax_user_id TEXT,
    email           TEXT,
    -- lower(trim(email)); matching column so the join never depends on the
    -- casing Valetax happens to return.
    email_norm      TEXT,
    name            TEXT,
    registered_at   TEXT,
    -- Valetax marks sub-IBs with hasChildren. The POC pulls level 1 only, so a
    -- true here means that client's own downline is NOT represented below.
    has_children    INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (snapshot_id) REFERENCES valetax_snapshots(id) ON DELETE CASCADE
);

-- One row per MT5 login belonging to a client, from referral.getTrading.
CREATE TABLE IF NOT EXISTS valetax_accounts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id     INTEGER NOT NULL,
    valetax_user_id TEXT,
    login           TEXT,
    FOREIGN KEY (snapshot_id) REFERENCES valetax_snapshots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_valetax_clients_snapshot ON valetax_clients(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_valetax_clients_email    ON valetax_clients(email_norm);
CREATE INDEX IF NOT EXISTS idx_valetax_accounts_snapshot ON valetax_accounts(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_valetax_accounts_login   ON valetax_accounts(login);
