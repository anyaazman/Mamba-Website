import { json, readJson, recordEvent, notifyAdmin, overRateLimit, rateLimit } from '../_helpers.js';

// Called by the trading backend (Bridge) when a client deletes their account in
// the app. The Bridge has already removed the account from its whitelist, so a
// portal row still saying 'approved' showed the client approved while every
// login was refused — 2421001779 on 2026-10-15.
//
// The row goes back to "not whitelisted": status 'pending' with no request
// stamp, which the dashboard renders as a Request Whitelist button. A client
// with an approved IB is whitelisted again by that one click; anyone else goes
// to the admin like any request. A 'rejected' row or a request still under
// review is left as it is.
//
// Authenticated with the key the website already sends to the backend
// (BACKEND_ADMIN_KEY, the Manager's WEBSITE_SYNC_KEY), so there is no new secret
// to provision. The Bridge only calls this for a caller holding that account's
// login token.

const encoder = new TextEncoder();

// Hash first so the comparison does not depend on, or reveal, the key's length.
async function sameSecret(presented, expected) {
  const [a, b] = await Promise.all([presented, expected].map(s =>
    crypto.subtle.digest('SHA-256', encoder.encode(s))));
  return crypto.subtle.timingSafeEqual(a, b);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.BACKEND_ADMIN_KEY) return json({ error: 'Not configured.' }, 503);

  // Same brute-force budget as verifyAdminKey: consumed only by a wrong key.
  if (await overRateLimit(env, 'backendkey', request, 10, 900)) {
    return json({ error: 'Unauthorized.' }, 401);
  }
  const auth = request.headers.get('Authorization') || '';
  const presented = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!presented || !(await sameSecret(presented, env.BACKEND_ADMIN_KEY))) {
    await rateLimit(env, 'backendkey', request, 10, 900);
    return json({ error: 'Unauthorized.' }, 401);
  }

  const body = await readJson(request);
  const num = body && typeof body.account_number === 'string' ? body.account_number.trim() : '';
  if (!/^[0-9]{1,20}$/.test(num)) return json({ error: 'account_number is required.' }, 400);

  try {
    const row = await env.DB.prepare(
      'SELECT id, user_id, status FROM mt5_accounts WHERE account_number = ?'
    ).bind(num).first();

    const reset = !!row && row.status === 'approved';
    if (reset) {
      await env.DB.prepare(
        "UPDATE mt5_accounts SET status = 'pending' WHERE id = ?"
      ).bind(row.id).run();
      // Best-effort: the column only exists once migration 0008 has been applied.
      try {
        await env.DB.prepare(
          'UPDATE mt5_accounts SET whitelist_requested_at = NULL WHERE id = ?'
        ).bind(row.id).run();
      } catch (e) { /* pre-0008: status alone already reads as "not requested" */ }
    }

    await recordEvent(env, 'app_account_deleted', {
      user_id: row ? row.user_id : null,
      metadata: { account_number: num, previous_status: row ? row.status : null, reset }
    });
    context.waitUntil(notifyAdmin(env, '🗑️ Account deleted in the app', {
      Account: num,
      Website: !row ? 'not registered on the portal'
        : reset ? 'reset to not whitelisted' : `left as ${row.status}`
    }));

    return json({ success: true, found: !!row, reset });
  } catch (e) {
    console.error('account-deleted error:', e.message, e.stack);
    return json({ error: 'Failed.' }, 500);
  }
}
