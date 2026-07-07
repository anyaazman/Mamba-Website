import { verifyAdminKey, json, notifyAdmin, syncBackendWhitelist } from '../_helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyAdminKey(request, env))) {
    return json({ error: 'Unauthorized.' }, 403);
  }

  try {
    const { account_id, status } = await request.json();

    if (!account_id || !['approved', 'rejected'].includes(status)) {
      return json({ error: 'account_id and valid status (approved|rejected) are required.' }, 400);
    }

    const account = await env.DB.prepare(
      'SELECT account_number FROM mt5_accounts WHERE id = ?'
    ).bind(account_id).first();

    if (!account) {
      return json({ error: 'MT5 account not found.' }, 404);
    }

    // Keep the backend whitelist in sync. Approve -> add, reject -> remove.
    // Fails open: the D1 update always proceeds; on sync failure we flag the
    // admin so they can reconcile manually.
    const sync = await syncBackendWhitelist(
      env,
      status === 'approved' ? 'add' : 'remove',
      account.account_number,
      'admin ' + status
    );

    await env.DB.prepare(
      'UPDATE mt5_accounts SET status = ? WHERE id = ?'
    ).bind(status, account_id).run();

    if (!sync.ok) {
      context.waitUntil(notifyAdmin(env, '⚠️ Whitelist sync failed (manual reconcile needed)', {
        Account: String(account.account_number),
        Action: status
      }));
    }

    return json({ success: true, message: `MT5 account ${status}.` });
  } catch (e) {
    console.error('Admin whitelist error:', e.message, e.stack);
    return json({ error: 'Action failed. Please try again.' }, 500);
  }
}
