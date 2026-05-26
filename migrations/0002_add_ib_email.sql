-- Add ib_email column to users table (fixes schema drift in production)
-- The production database was created with an older schema that didn't include this column.
-- Run: wrangler d1 execute mamba-db --remote --file=migrations/0002_add_ib_email.sql

ALTER TABLE users ADD COLUMN ib_email TEXT DEFAULT '';
