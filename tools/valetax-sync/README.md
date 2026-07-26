# Valetax Sync (POC)

Pulls your Valetax IB downline + trading data into `valetax-snapshot.json` for
reconciliation against the Mamba DB.

## How it stays in bounds

- Runs a **real Chromium** via Playwright — not a spoofed HTTP client. It *is* a
  browser, so there's nothing to fake for Cloudflare.
- **You solve the login CAPTCHA** in the visible window. The script never solves
  it (no OCR / LLM / solving service) and uses **no stealth/anti-detection
  plugins**. If Cloudflare shows its own challenge, you solve that too.
- It logs into **your** account and reads **your** data. No third-party access.

Run it **attended**. Don't cron it to log in unattended — the token expires
~hourly so a human is in the loop anyway, and automated broker logins can draw
ToS attention. Nothing here should live in the Cloudflare Worker.

## Setup

```bash
cd tools/valetax-sync
npm init -y && npm i playwright
npx playwright install chromium
```

## Run

```bash
VALETAX_EMAIL=you@example.com VALETAX_PASSWORD='your-rotated-password' node sync.js
```

A Chrome window opens → credentials pre-fill → **you solve the captcha + click
Sign In** → the script pulls the data and writes `valetax-snapshot.json`.

## Known POC gaps (next steps)

- **Sub-IB recursion**: `hasChildren:true` clients have their own downline. The
  POC pulls level 1 only; recursing needs the child-list call confirmed from the
  portal Network tab.
- **Reconciliation**: feeding `valetax-snapshot.json` into a Mamba admin endpoint
  to match `userEmail`↔`ib_email` and `login`↔`account_number`, and flag
  dormant / unverified clients — that's the next build once the pull is proven.

## Do not commit

`valetax-snapshot.json` contains client PII, and `node_modules/` is large — both
should stay out of git.
