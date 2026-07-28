-- Drop the Valetax session store left behind by the login spike.
--
-- 0010 created valetax_session to hold the short-lived FX-Token that
-- functions/api/admin/valetax/login.js obtained with an operator-keyed CAPTCHA.
-- 64e6cf6 deleted login.js and captcha.js and moved the downline pull out to
-- tools/valetax-sync, so nothing reads or writes this table any more — the
-- Worker holds no Valetax session at all. It is schema with no owner.
--
-- Checked before writing this: no reference to valetax_session survives
-- anywhere under functions/ or in the frontend, and the production table holds
-- 0 rows, so no live broker token is being discarded.
--
-- Kept separate from 0012 deliberately. 0012 fixes a correctness bug and should
-- be applied; this one only removes dead weight and cannot be rolled back, so
-- it is skippable and deferrable on its own.
--
-- Run: wrangler d1 execute mamba-db --remote --file=migrations/0013_drop_valetax_session.sql

DROP TABLE IF EXISTS valetax_session;
