const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export async function hashSecret(secret) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  return bytesToHex(salt) + ':' + bytesToHex(new Uint8Array(bits));
}

export async function verifySecret(secret, stored) {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = hexToBytes(saltHex);
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits)) === hashHex;
}

export async function authenticateUser(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  // Tokens are stored hashed so a DB leak doesn't expose live sessions
  const token = await hashToken(authHeader.slice(7));
  const user = await env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.ib_status, u.ib_email, u.created_at
     FROM tokens t
     JOIN users u ON t.user_id = u.id
     WHERE t.token = ? AND t.expires_at > datetime('now')`
  ).bind(token).first();

  if (!user) return null;

  const accounts = await env.DB.prepare(
    'SELECT id, account_number, status, created_at FROM mt5_accounts WHERE user_id = ? ORDER BY created_at ASC'
  ).bind(user.id).all();

  user.mt5_accounts = accounts.results;
  return user;
}

async function sha256(text) {
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hash));
}

export async function hashToken(token) {
  return sha256(token);
}

export function isValidEmail(email) {
  return typeof email === 'string'
    && email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// Fixed-window rate limiter backed by D1. Fails open so a limiter/DB
// problem can never lock users out of the site.
export async function rateLimit(env, scope, request, limit, windowSeconds) {
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / windowSeconds);
    const key = scope + ':' + ip + ':' + bucket;
    const expiresAt = (bucket + 2) * windowSeconds;

    const row = await env.DB.prepare(
      'INSERT INTO rate_limits (rl_key, count, expires_at) VALUES (?, 1, ?) ' +
      'ON CONFLICT(rl_key) DO UPDATE SET count = count + 1 RETURNING count'
    ).bind(key, expiresAt).first();

    if (row && row.count === 1) {
      await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run();
    }

    return !row || row.count <= limit;
  } catch (e) {
    console.error('rateLimit error:', e.message);
    return true;
  }
}

function escapeTelegramHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function verifyAdminKey(request, env) {
  const adminKey = request.headers.get('X-Admin-Key');
  if (!adminKey) return false;
  const hash = await sha256(adminKey);
  const result = await env.DB.prepare(
    'SELECT id FROM admin_keys WHERE key_hash = ?'
  ).bind(hash).first();
  return !!result;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export async function recordEvent(env, type, { page, user_id, metadata } = {}) {
  try {
    await env.DB.prepare(
      'INSERT INTO events (type, page, user_id, metadata) VALUES (?, ?, ?, ?)'
    ).bind(type, page || '', user_id || null, metadata ? JSON.stringify(metadata) : '{}').run();
  } catch (e) {
    console.error('recordEvent error:', e.message);
  }
}

export async function notifyAdmin(env, title, fields) {
  try {
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    const time = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    let text = `<b>${title}</b>\n`;
    if (fields) {
      Object.entries(fields).forEach(([key, value]) => {
        // User-supplied values must be escaped or a "<" in a name would
        // make Telegram reject the whole message (parse_mode: HTML)
        text += `<b>${key}:</b> ${escapeTelegramHtml(value)}\n`;
      });
    }
    text += `<b>Time:</b> ${time}`;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });
  } catch (e) {
    console.error('notifyAdmin error:', e.message);
  }
}

// Sync an MT5 account to/from the trading backend whitelist (Manager service).
// action: 'add' | 'remove'. Fails open — returns { ok:false } instead of throwing
// so a backend outage can never break the website flow. { skipped:true } means
// the integration isn't configured (caller should fall back to the manual flow).
export async function syncBackendWhitelist(env, action, login, notes = '') {
  const base = env.BACKEND_MANAGER_URL;
  const key = env.BACKEND_ADMIN_KEY;
  if (!base || !key) return { ok: false, skipped: true };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    let res;
    if (action === 'add') {
      res = await fetch(`${base}/api/admin/accounts/whitelist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ login: String(login), notes }),
        signal: ctrl.signal
      });
    } else {
      res = await fetch(`${base}/api/admin/accounts/whitelist/${encodeURIComponent(login)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${key}` },
        signal: ctrl.signal
      });
      // 404 means the account is already absent from the backend whitelist.
      if (res.status === 404) return { ok: true };
    }
    return { ok: res.ok };
  } catch (e) {
    console.error('syncBackendWhitelist error:', e.message);
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}
