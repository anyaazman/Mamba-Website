import { verifyAdminKey, json } from '../_helpers.js';

export async function onRequestPost({ request, env }) {
  if (!(await verifyAdminKey(request, env))) {
    return json({ error: 'Unauthorized.' }, 403);
  }

  try {
    const { account_id, status } = await request.json();

    if (!account_id || !['approved', 'rejected'].includes(status)) {
      return json({ error: 'account_id and valid status (approved|rejected) are required.' }, 400);
    }

    await env.DB.prepare(
      'UPDATE mt5_accounts SET status = ? WHERE id = ?'
    ).bind(status, account_id).run();

    return json({ success: true, message: `MT5 account ${status}.` });
  } catch (e) {
    return json({ error: 'Action failed. Please try again.' }, 500);
  }
}
