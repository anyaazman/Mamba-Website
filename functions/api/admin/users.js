import { verifyAdminKey, json } from '../_helpers.js';

export async function onRequestGet({ request, env }) {
  if (!(await verifyAdminKey(request, env))) {
    return json({ error: 'Unauthorized.' }, 403);
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');

  let query = 'SELECT id, name, email, ib_status, ib_email, ib_type, created_at, updated_at FROM users';
  const params = [];

  if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
    query += ' WHERE ib_status = ?';
    params.push(statusFilter);
  }

  query += ' ORDER BY created_at DESC';

  const result = await env.DB.prepare(query).bind(...params).all();
  const users = result.results;

  // Fetch MT5 accounts for all returned users
  if (users.length > 0) {
    const userIds = users.map(u => u.id);
    const placeholders = userIds.map(() => '?').join(',');
    const accounts = await env.DB.prepare(
      `SELECT id, user_id, account_number, status, created_at FROM mt5_accounts WHERE user_id IN (${placeholders}) ORDER BY created_at ASC`
    ).bind(...userIds).all();

    const accountsByUser = {};
    accounts.results.forEach(a => {
      if (!accountsByUser[a.user_id]) accountsByUser[a.user_id] = [];
      accountsByUser[a.user_id].push(a);
    });

    users.forEach(u => {
      u.mt5_accounts = accountsByUser[u.id] || [];
    });
  }

  return json({ users });
}
