import { verifyAdminKey, json } from '../../_helpers.js';
import { VALETAX_BASE } from './_valetax.js';

// GET /api/admin/valetax/captcha
// Proxies Valetax's captcha.generate for the configured partner email and
// returns the challenge to the dashboard, where a HUMAN reads and answers it.
export async function onRequestGet({ request, env }) {
  if (!(await verifyAdminKey(request, env))) {
    return json({ error: 'Unauthorized.' }, 403);
  }

  const email = env.VALETAX_EMAIL;
  if (!email) {
    return json({ error: 'VALETAX_EMAIL is not configured on the server.' }, 500);
  }

  const url = VALETAX_BASE(env) + '/api.user.captcha.generate?email=' + encodeURIComponent(email);

  try {
    // NOTE: assuming POST to match the observed Valetax RPC pattern (query params
    // + empty/JSON body). If the spike shows captcha needs GET, flip this one line.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: ''
    });

    const raw = await res.text();
    let data;
    try { data = JSON.parse(raw); } catch (e) { data = null; }

    if (!res.ok || !data) {
      return json({ error: 'Captcha generation failed.', upstreamStatus: res.status, upstreamBody: raw.slice(0, 500) }, 502);
    }

    return json({ captchaId: data.id, imageBase64: data.imageBase64 });
  } catch (e) {
    console.error('Valetax captcha error:', e.message);
    return json({ error: 'Could not reach Valetax. ' + e.message }, 502);
  }
}
