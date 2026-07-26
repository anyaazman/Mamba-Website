// Inspection: fill creds, click Sign In to TRIGGER the captcha (server only
// asks for it after a login attempt), intercept the image, and dump the
// captcha field selector. Does NOT solve the captcha or complete login.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.VALETAX_BASE || 'https://ma.valetaxglobal.com';
const EMAIL = process.env.VALETAX_EMAIL, PASSWORD = process.env.VALETAX_PASSWORD;

if (!EMAIL || !PASSWORD) { console.error('Set VALETAX_EMAIL / VALETAX_PASSWORD.'); process.exit(1); }

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await (await browser.newContext()).newPage();

  let captchaSeen = false;
  page.on('response', async (res) => {
    if (res.url().toLowerCase().includes('captcha')) {
      console.log('captcha response:', res.status(), res.url());
      try {
        const j = await res.json();
        if (j && j.imageBase64) {
          fs.writeFileSync('captcha.png', Buffer.from(j.imageBase64, 'base64'));
          console.log('✓ intercepted captcha image -> captcha.png (id:', j.id + ')');
          captchaSeen = true;
        }
      } catch (e) { /* not json */ }
    }
  });

  await page.goto(BASE + '/guest/sign-in', { waitUntil: 'networkidle' });
  await page.waitForSelector('#email', { timeout: 10000 });
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  console.log('Filled credentials. Clicking Sign In to trigger the captcha…');
  try { await page.click('button[type="submit"]:has-text("Sign In")'); }
  catch (e) { await page.click('button[type="submit"]'); }

  for (let i = 0; i < 24 && !captchaSeen; i++) await page.waitForTimeout(500);

  const inputs = await page.$$eval('input', els => els.map(e => ({ name: e.name, id: e.id, type: e.type, placeholder: e.placeholder })));
  console.log('\nINPUTS AFTER SUBMIT:', JSON.stringify(inputs));
  const imgs = await page.$$eval('img', els => els.map(e => ({ id: e.id, cls: e.className, alt: e.alt, srcStart: (e.src || '').slice(0, 30) })));
  console.log('\nIMAGES AFTER SUBMIT:', JSON.stringify(imgs));

  await page.waitForTimeout(500);
  await browser.close();
})();
