import { json } from '../_helpers.js';

const VALID_TYPES = ['pageview', 'register', 'login', 'ib_request', 'mt5_added', 'whitelist_request', 'password_reset'];

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { type, page, referrer, title, metadata } = body;

    if (!type || !VALID_TYPES.includes(type)) {
      return json({ error: 'Invalid event type.' }, 400);
    }

    let userId = null;
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const tokenRow = await env.DB.prepare(
        'SELECT user_id FROM tokens WHERE token = ? AND expires_at > datetime(\'now\')'
      ).bind(token).first();
      if (tokenRow) userId = tokenRow.user_id;
    }

    await env.DB.prepare(
      'INSERT INTO events (type, page, referrer, title, user_id, metadata) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(type, page || '', referrer || '', title || '', userId, metadata ? JSON.stringify(metadata) : '{}').run();

    return json({ success: true }, 201);
  } catch (e) {
    console.error('Event tracking error:', e.message);
    return json({ success: false }, 500);
  }
}
