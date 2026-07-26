import { verifyAdminKey, json } from '../../_helpers.js';
import { VALETAX_BASE, decodeTokenExpiry, saveToken } from './_valetax.js';

// POST /api/admin/valetax/login   body: { captchaId, captchaAnswer }
//
// SPIKE MODE: the token's location in Valetax's signIn response is unknown
// (body field vs FX-Token header vs Set-Cookie). This endpoint submits the
// human-supplied CAPTCHA answer, tries the known extraction points, stores the
// token if found, and ALWAYS returns a redacted view of the raw upstream
// response so we can confirm where the token lives and whether Cloudflare's
// egress IP is accepted. Once confirmed, this becomes a normal login endpoint.
export async function onRequestPost({ request, env }) {
  if (!(await verifyAdminKey(request, env))) {
    return json({ error: 'Unauthorized.' }, 403);
  }

  let body;
  try { body = await request.json(); } catch (e) { body = {}; }
  const { captchaId, captchaAnswer } = body;

  if (!captchaId || !captchaAnswer) {
    return json({ error: 'captchaId and captchaAnswer are required.' }, 400);
  }

  const email = env.VALETAX_EMAIL;
  const password = env.VALETAX_PASSWORD;
  if (!email || !password) {
    return json({ error: 'Valetax credentials are not configured on the server.' }, 500);
  }

  const url = VALETAX_BASE(env) + '/api.def.user.user.signIn'
    + '?email=' + encodeURIComponent(email)
    + '&password=' + encodeURIComponent(password)
    + '&rememberMe=false';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ captchaAnswer: String(captchaAnswer), captchaId: captchaId })
    });

    const raw = await res.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (e) { /* non-JSON */ }

    // Try known token locations, in order of likelihood.
    const fromHeader = res.headers.get('FX-Token') || res.headers.get('fx-token') || res.headers.get('authorization');
    const fromBody = data && (data.token || data.fxToken || data.accessToken || (data.result && data.result.token));
    const token = fromBody || fromHeader || null;

    let stored = false;
    let expiresAt = null;
    if (token) {
      expiresAt = decodeTokenExpiry(token);
      await saveToken(env, token, expiresAt);
      stored = true;
    }

    // Redacted diagnostic view — never echo the raw token or credentials.
    return json({
      upstreamStatus: res.status,
      tokenFound: !!token,
      tokenLocation: fromBody ? 'body' : (fromHeader ? 'header' : null),
      stored: stored,
      expiresAt: expiresAt,
      setCookiePresent: !!res.headers.get('Set-Cookie'),
      // captchaRequired / blocked / remainingAttempts surface here if login was rejected
      upstreamBody: token ? '[redacted — token stored]' : (data || raw.slice(0, 800))
    });
  } catch (e) {
    console.error('Valetax login error:', e.message);
    return json({ error: 'Could not reach Valetax. ' + e.message }, 502);
  }
}
