import { verifyAdminKey, json } from '../_helpers.js';

const VALID_TYPES = ['pageview', 'register', 'login', 'ib_request', 'mt5_added', 'whitelist_request', 'whitelist_synced', 'password_reset'];

export async function onRequestGet({ request, env }) {
  try {
    if (!(await verifyAdminKey(request, env))) {
      return json({ error: 'Unauthorized.' }, 403);
    }

    const url = new URL(request.url);
    const typeFilter = url.searchParams.get('type');
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 200, 1000);

    let query = `SELECT e.id, e.type, e.page, e.referrer, e.title, e.user_id, e.metadata, e.created_at,
                 u.name as user_name, u.email as user_email
                 FROM events e
                 LEFT JOIN users u ON e.user_id = u.id`;
    const params = [];
    const conditions = [];

    if (typeFilter && VALID_TYPES.includes(typeFilter)) {
      conditions.push('e.type = ?');
      params.push(typeFilter);
    }

    if (fromDate) {
      conditions.push('e.created_at >= datetime(?)');
      params.push(fromDate);
    }

    if (toDate) {
      conditions.push('e.created_at <= datetime(?)');
      params.push(toDate);
    }

    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY e.created_at DESC LIMIT ?';
    params.push(limit);

    const result = await env.DB.prepare(query).bind(...params).all();
    return json({ events: result.results });
  } catch (e) {
    console.error('admin/events error:', e && e.message, e && e.stack);
    return json({ error: 'Server error: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
}
