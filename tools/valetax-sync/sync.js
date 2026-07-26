// Valetax IB reconciliation sync — XHR-level via a real browser session.
//
// Runs a REAL Chromium (Playwright). The browser only holds a genuine,
// Cloudflare-cleared session; every API call is made as the app's own
// JavaScript via page.evaluate(fetch(...)) — no DOM automation, no selectors.
//
// BOUNDARY (deliberate):
//   • YOU solve the login CAPTCHA — the image is relayed to your Telegram and
//     you reply with the digits. This script does NOT solve it (no OCR/LLM/
//     service) and uses no stealth/anti-detection plugins.
//   • It logs into YOUR account and reads YOUR data. Session token is cached
//     (expires ~hourly) so you don't re-solve on every run.
//
// Env: VALETAX_EMAIL, VALETAX_PASSWORD, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
//      (optional: VALETAX_BASE). Run ATTENDED. See README.md.

const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.VALETAX_BASE || 'https://ma.valetaxglobal.com';
const EMAIL = process.env.VALETAX_EMAIL;
const PASSWORD = process.env.VALETAX_PASSWORD;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;
const TOKEN_FILE = 'token.json';
const TAKE = 20;

if (!EMAIL || !PASSWORD) { console.error('Set VALETAX_EMAIL / VALETAX_PASSWORD.'); process.exit(1); }
if (!TG_TOKEN || !TG_CHAT) { console.error('Set TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID for the captcha relay.'); process.exit(1); }

// ---- token expiry (the FX-Token's first segment is base64 JSON) ----
function tokenExpiry(token) {
  try {
    const seg = token.split('.')[0];
    const s = Buffer.from(seg.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const obj = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
    return obj.expiredAt || null;
  } catch (e) { return null; }
}
function cachedToken() {
  try {
    const c = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    if (c.token && c.expiresAt && new Date(c.expiresAt) > new Date(Date.now() + 60000)) return c.token;
  } catch (e) {}
  return null;
}

// ---- Telegram relay ----
async function tgSendCaptcha(pngBuffer) {
  const form = new FormData();
  form.append('chat_id', String(TG_CHAT));
  form.append('caption', 'Valetax captcha — reply with the digits.');
  form.append('photo', new Blob([pngBuffer], { type: 'image/png' }), 'captcha.png');
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, { method: 'POST', body: form });
  if (!r.ok) throw new Error('Telegram sendPhoto failed: ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
async function tgBaselineOffset() {
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates?offset=-1`);
  const d = await r.json();
  const arr = d.result || [];
  return arr.length ? arr[arr.length - 1].update_id : 0;
}
async function tgWaitForAnswer(sinceId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let offset = sinceId + 1;
  while (Date.now() < deadline) {
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates?offset=${offset}&timeout=20`);
    const d = await r.json();
    for (const u of (d.result || [])) {
      offset = u.update_id + 1;
      const m = u.message;
      if (m && String(m.chat.id) === String(TG_CHAT) && m.text) {
        const digits = m.text.trim();
        if (/^\d{3,8}$/.test(digits)) return digits;
      }
    }
  }
  return null;
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await (await browser.newContext()).newPage();

  // Load the origin so page.evaluate fetches are same-origin and cf-cleared.
  console.log('Loading Valetax…');
  await page.goto(BASE + '/guest/sign-in', { waitUntil: 'networkidle' });

  // In-page authenticated fetch helpers (run as the app's own JS).
  const pageJson = (url, opts) => page.evaluate(async ({ url, opts }) => {
    const res = await fetch(url, opts);
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch (e) { body = text; }
    return { status: res.status, ok: res.ok, body, fxHeader: res.headers.get('fx-token') };
  }, { url, opts });

  let fxToken = cachedToken();
  if (fxToken) {
    console.log('✓ Reusing cached token (still valid).');
  } else {
    // 1) captcha.generate
    console.log('Requesting captcha…');
    const cap = await pageJson(BASE + '/api.user.captcha.generate?email=' + encodeURIComponent(EMAIL), {
      method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    });
    if (!cap.ok || !cap.body || !cap.body.imageBase64) { console.error('captcha.generate failed:', cap.status, cap.body); await browser.close(); process.exit(1); }
    const captchaId = cap.body.id;
    const png = Buffer.from(cap.body.imageBase64, 'base64');
    fs.writeFileSync('captcha.png', png);

    // 2) relay to Telegram, wait for the human's reply
    const baseline = await tgBaselineOffset();
    await tgSendCaptcha(png);
    console.log('→ Captcha sent to Telegram. Reply with the digits (3 min)…');
    const answer = await tgWaitForAnswer(baseline, 180000);
    if (!answer) { console.error('No captcha answer received in time.'); await browser.close(); process.exit(1); }
    console.log('✓ Got answer from Telegram.');

    // 3) signIn (json body, creds in query — mirrors the real browser request)
    const signInUrl = BASE + '/api.def.user.user.signIn?email=' + encodeURIComponent(EMAIL)
      + '&password=' + encodeURIComponent(PASSWORD) + '&rememberMe=false';
    const si = await pageJson(signInUrl, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ captchaAnswer: answer, captchaId })
    });
    // Token may be in the body or the fx-token response header.
    fxToken = si.fxHeader
      || (si.body && (si.body.token || si.body.fxToken || si.body.accessToken || (si.body.result && si.body.result.token)))
      || null;
    if (!fxToken) { console.error('signIn returned no token. status=' + si.status + ' body=', JSON.stringify(si.body).slice(0, 400)); await browser.close(); process.exit(1); }
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token: fxToken, expiresAt: tokenExpiry(fxToken) }));
    console.log('✓ Logged in, token cached.');
  }

  // Authenticated data call: form-urlencoded, empty body (application/json +
  // empty body was the earlier 400).
  async function api(path) {
    const r = await pageJson(BASE + path, {
      method: 'POST',
      headers: { 'FX-Token': fxToken, 'Accept': 'application/json, text/plain, */*', 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    if (!r.ok) throw new Error(path + ' -> HTTP ' + r.status + ': ' + JSON.stringify(r.body).slice(0, 200));
    return r.body;
  }

  console.log('Pulling downline…');
  const clients = [];
  let skip = 0, total = Infinity;
  while (skip < total) {
    const d = await api(`/api.user.report.deals.parentalTree.getRange?skip=${skip}&take=${TAKE}`);
    total = d.count; clients.push(...(d.items || [])); skip += TAKE;
    console.log(`  ${clients.length}/${total}`);
  }
  // NOTE: hasChildren:true entries are sub-IBs — recursion is a next step.

  console.log('Pulling trading accounts…');
  const enriched = [];
  for (const c of clients) {
    let trading = null;
    try { trading = await api(`/api.user.partner.referral.getTrading?id=${c.userId}`); }
    catch (e) { console.log(`  getTrading ${c.userId}: ${e.message}`); }
    enriched.push(Object.assign({}, c, { trading }));
  }

  fs.writeFileSync('valetax-snapshot.json', JSON.stringify({ pulledAt: new Date().toISOString(), count: clients.length, clients: enriched }, null, 2));
  console.log(`\n✓ Wrote valetax-snapshot.json (${clients.length} clients). PII — keep out of git.`);
  await browser.close();
})();
