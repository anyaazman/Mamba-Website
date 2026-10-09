import { verifyAdminKey, json } from '../_helpers.js';

const VALID_TYPES = ['pageview', 'register', 'login', 'ib_request', 'mt5_added', 'whitelist_request', 'whitelist_synced', 'password_reset', 'account_deletion_request', 'whitelist_sync_failed', 'whitelist_orphaned'];

export async function onRequestGet({ request, env }) {
  try {
    if (!(await verifyAdminKey(request, env))) return json({ error: 'Unauthorized.' }, 403);
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const search = (url.searchParams.get('q') || '').trim().slice(0, 200);
    const requested = parseInt(url.searchParams.get('limit'), 10);
    const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : 200, 1), 1000);
    let cursor;
    if (url.searchParams.has('cursor')) {
      try {
        const raw = url.searchParams.get('cursor');
        if (raw.length > 200) throw new Error();
        cursor = JSON.parse(raw);
        if (!Number.isSafeInteger(cursor.id) || cursor.id < 1 || typeof cursor.created_at !== 'string' || cursor.created_at.length > 40 || !Number.isFinite(Date.parse(cursor.created_at))) throw new Error();
      } catch (_) { return json({ error: 'Invalid activity cursor.' }, 400); }
    }
    if ((from && !Number.isFinite(Date.parse(from))) || (to && !Number.isFinite(Date.parse(to))) || (from && to && Date.parse(from) > Date.parse(to))) {
      return json({ error: 'Invalid date range.' }, 400);
    }
    const conditions = [], params = [];
    if (type === 'sync_alerts') conditions.push("e.type IN ('whitelist_sync_failed', 'whitelist_orphaned')");
    else if (type && VALID_TYPES.includes(type)) { conditions.push('e.type = ?'); params.push(type); }
    if (from) { conditions.push('e.created_at >= datetime(?)'); params.push(from); }
    if (to) { conditions.push('e.created_at <= datetime(?)'); params.push(to); }
    if (search) {
      // instr treats %, _ and backslashes as literal search input.
      conditions.push("(instr(lower(coalesce(u.name, '')), lower(?)) > 0 OR instr(lower(coalesce(u.email, '')), lower(?)) > 0 OR CAST(e.user_id AS TEXT) = ?)");
      params.push(search, search, search);
    }
    const join = ' FROM events e LEFT JOIN users u ON e.user_id = u.id';
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const count = await env.DB.prepare('SELECT COUNT(*) AS total' + join + where).bind(...params).first();
    // Stable keyset pagination avoids duplicate rows when new events arrive.
    if (cursor) {
      conditions.push('(e.created_at < ? OR (e.created_at = ? AND e.id < ?))');
      params.push(cursor.created_at, cursor.created_at, cursor.id);
    }
    const query = `SELECT e.id, e.type, e.page, e.referrer, e.title, e.user_id, e.metadata, e.created_at,
      u.name AS user_name, u.email AS user_email` + join +
      (conditions.length ? ' WHERE ' + conditions.join(' AND ') : '') + ' ORDER BY e.created_at DESC, e.id DESC LIMIT ?';
    const result = await env.DB.prepare(query).bind(...params, limit + 1).all();
    const events = result.results.slice(0, limit);
    const last = events[events.length - 1];
    return json({ events, total: count.total, next_cursor: result.results.length > limit && last ? JSON.stringify({ created_at: last.created_at, id: last.id }) : null });
  } catch (e) {
    console.error('admin/events error:', e && e.message, e && e.stack);
    return json({ error: 'Unable to load activity. Please try again.' }, 500);
  }
}
