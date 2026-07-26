// Shared helpers for the Valetax partner-portal integration.
//
// AUTH MODEL: the operator logs in from the admin dashboard and solves the
// login CAPTCHA themselves (human, every session). This backend never solves
// or bypasses the CAPTCHA — it only proxies the operator-supplied answer to
// Valetax and stores the resulting short-lived FX-Token for reuse.

export function VALETAX_BASE(env) {
  // Partner portal currently lives on the `intl` host (client signup moved to
  // `global`, the partner API did not). Overridable via env if that changes.
  return (env.VALETAX_API_BASE || 'https://ma.valetaxintl.com').replace(/\/+$/, '');
}

// The FX-Token embeds its own expiry as base64 JSON in the first segment.
// Best-effort decode so we can store an accurate expires_at.
export function decodeTokenExpiry(token) {
  try {
    const firstSegment = token.split('.')[0] || token;
    // The token is not standard JWT; the leading base64 chunk decodes to JSON.
    const b64 = firstSegment.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = atob(b64.slice(0, b64.length - (b64.length % 4)));
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    const obj = JSON.parse(jsonStr.slice(start, end + 1));
    return obj.expiredAt || null;
  } catch (e) {
    return null;
  }
}

export async function saveToken(env, token, expiresAt) {
  await env.DB.prepare(
    `INSERT INTO valetax_session (id, token, expires_at, updated_at)
     VALUES (1, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       token = excluded.token,
       expires_at = excluded.expires_at,
       updated_at = datetime('now')`
  ).bind(token, expiresAt || null).run();
}

export async function getStoredSession(env) {
  const row = await env.DB.prepare(
    'SELECT token, expires_at, updated_at FROM valetax_session WHERE id = 1'
  ).first();
  if (!row || !row.token) return null;
  const expired = row.expires_at && new Date(row.expires_at) <= new Date();
  return { token: row.token, expires_at: row.expires_at, updated_at: row.updated_at, expired: !!expired };
}

export async function clearToken(env) {
  await env.DB.prepare('DELETE FROM valetax_session WHERE id = 1').run();
}
