import { verifyAdminKey, json, syncBackendWhitelist, readJson, notifyAdmin, recordEvent } from '../_helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyAdminKey(request, env))) {
    return json({ error: 'Unauthorized.' }, 403);
  }

  try {
    const body = await readJson(request);
    if (!body) return json({ error: 'Invalid request body.' }, 400);
    const { user_id } = body;

    if (!user_id) {
      return json({ error: 'user_id is required.' }, 400);
    }

    const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(user_id).first();
    if (!user) {
      return json({ error: 'User not found.' }, 404);
    }

    // Remove this user's MT5 accounts from the backend whitelist before we drop
    // the D1 rows. Backend availability still never blocks deletion — a user's
    // right to be deleted does not depend on the trading host being up — but the
    // result is no longer discarded.
    //
    // These were fired through context.waitUntil() and never inspected. A failed
    // removal left the account in farm.db's account_whitelist, still able to log
    // in and trade, while the D1 rows that recorded WHICH account it was were
    // deleted milliseconds later. That combination is unrecoverable: nothing on
    // either side remembers the orphan. So we await the removals while the
    // numbers are still known, and if any fail we name them.
    const accounts = await env.DB.prepare(
      'SELECT account_number FROM mt5_accounts WHERE user_id = ?'
    ).bind(user_id).all();

    const outcomes = await Promise.all(
      accounts.results.map(async (acc) => ({
        account: acc.account_number,
        result: await syncBackendWhitelist(env, 'remove', acc.account_number)
      }))
    );
    const orphaned = outcomes.filter(o => !o.result.ok).map(o => String(o.account));

    // Record BEFORE the deletes. events.user_id is a foreign key into users, so
    // an insert referencing a user that has already been removed fails — and
    // recordEvent swallows insert errors, so it would fail silently and leave
    // exactly the gap this row exists to close.
    if (orphaned.length) {
      await recordEvent(env, 'whitelist_orphaned', {
        user_id,
        metadata: { accounts: orphaned, reason: 'backend removal failed during user deletion' }
      });
    }

    await env.DB.prepare('DELETE FROM tokens WHERE user_id = ?').bind(user_id).run();
    await env.DB.prepare('DELETE FROM mt5_accounts WHERE user_id = ?').bind(user_id).run();
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user_id).run();

    if (orphaned.length) {
      // The ON DELETE SET NULL above nulls this row's user_id, which is fine:
      // the account numbers in metadata are what a manual reconcile needs, and
      // they are the only place those numbers still exist.
      context.waitUntil(notifyAdmin(env, '⚠️ Whitelist orphaned — manual removal needed', {
        Accounts: orphaned.join(', '),
        Detail: 'User deleted from the portal, but these accounts are STILL whitelisted on the trading backend and can still trade.'
      }));
    }

    return json({
      success: true,
      message: 'User deleted.',
      backend_synced: orphaned.length === 0,
      orphaned_accounts: orphaned
    });
  } catch (e) {
    console.error('Admin delete user error:', e.message, e.stack);
    return json({ error: 'Failed to delete user. Please try again.' }, 500);
  }
}
