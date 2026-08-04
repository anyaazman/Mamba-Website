import { verifyAdminKey, json, notifyAdmin, syncBackendWhitelist, readJson, recordEvent } from '../_helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyAdminKey(request, env))) {
    return json({ error: 'Unauthorized.' }, 403);
  }

  try {
    const body = await readJson(request);
    if (!body) return json({ error: 'Invalid request body.' }, 400);
    const { account_id, status } = body;

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
      // Durable trace, not just a Telegram message. A missed alert used to leave
      // no record at all that D1 and farm.db had diverged, so nothing could
      // reconcile them after the fact.
      await recordEvent(env, 'whitelist_sync_failed', {
        metadata: {
          account_id,
          account_number: account.account_number,
          action: status,
          skipped: Boolean(sync.skipped)
        }
      });
      context.waitUntil(notifyAdmin(env, '⚠️ Whitelist sync failed (manual reconcile needed)', {
        Account: String(account.account_number),
        Action: status
      }));
    }

    // Report the sync outcome rather than an unqualified success. The D1 update
    // did happen, so this is not an error — but on an approval that did not
    // reach the backend the client is shown "approved" while the Bridge still
    // refuses the login, and the operator needs to see that difference.
    return json({
      success: true,
      message: `MT5 account ${status}.`,
      backend_synced: Boolean(sync.ok),
      ...(sync.ok ? {} : {
        warning: status === 'approved'
          ? 'Marked approved in the portal, but the trading backend did not confirm. The client cannot trade yet — reconcile manually.'
          : 'Marked rejected in the portal, but the trading backend did not confirm. The account may still be able to trade — reconcile manually.'
      })
    });
  } catch (e) {
    console.error('Admin whitelist error:', e.message, e.stack);
    return json({ error: 'Action failed. Please try again.' }, 500);
  }
}
