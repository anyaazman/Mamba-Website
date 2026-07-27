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

## Reconciliation (built)

Upload `valetax-snapshot.json` in the admin panel's **Valetax** tab. It posts to
`/api/admin/valetax/import`, and `/api/admin/valetax/reconcile` then matches the
snapshot against the Mamba DB (`userEmail`↔`ib_email`, `login`↔`account_number`)
and reports four buckets:

| Bucket | Meaning |
|---|---|
| Not under our code | Requested IB verification, but Valetax has no such client |
| MT5 not in downline | An MT5 account on Mamba that Valetax does not show under our code |
| No Mamba account | Under our code at Valetax, never registered on Mamba |
| Matched | Confirmed on both sides |

The Worker holds no Valetax credentials and no Valetax session — it only reads
what you uploaded. Re-run this tool whenever you want fresher numbers; the tab
shows how old the current snapshot is and warns past a week.

## Known POC gaps (next steps)

- **Sub-IB recursion**: `hasChildren:true` clients have their own downline. The
  POC pulls level 1 only; recursing needs the child-list call confirmed from the
  portal Network tab. Until then every reconciliation count understates the real
  book — the report surfaces the sub-IB count so the gap is visible rather than
  silent.

## Do not commit

`valetax-snapshot.json` contains client PII, and `node_modules/` is large — both
should stay out of git.
