import { json, hashToken, rateLimit } from './_helpers.js';

const VALID_TYPES = ['pageview', 'register', 'login', 'ib_request', 'mt5_added', 'whitelist_request', 'password_reset'];

function clamp(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

export async function onRequestPost({ request, env }) {
  try {
    if (!(await rateLimit(env, 'events', request, 60, 60))) {
      return json({ success: false }, 429);
    }

    const body = await request.json();
    const { type, page, referrer, title, metadata } = body;

    if (!type || !VALID_TYPES.includes(type)) {
      return json({ error: 'Invalid event type.' }, 400);
    }

    let userId = null;
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = await hashToken(authHeader.slice(7));
      const tokenRow = await env.DB.prepare(
        'SELECT user_id FROM tokens WHERE token = ? AND expires_at > datetime(\'now\')'
      ).bind(token).first();
      if (tokenRow) userId = tokenRow.user_id;
    }

    let metadataStr = '{}';
    if (metadata) {
      try {
        const s = JSON.stringify(metadata);
        if (s.length <= 1000) metadataStr = s;
      } catch (e) { /* keep default */ }
    }

    await env.DB.prepare(
      'INSERT INTO events (type, page, referrer, title, user_id, metadata) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(type, clamp(page, 300), clamp(referrer, 500), clamp(title, 300), userId, metadataStr).run();

    return json({ success: true }, 201);
  } catch (e) {
    console.error('Event tracking error:', e.message);
    return json({ success: false }, 500);
  }
}
