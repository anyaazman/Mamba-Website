# Mamba Management website

Marketing site, member portal and admin workspace for **Mamba Management**, a
mobile app that manages exits (stop loss, take profit, breakeven, trailing
stop) on MetaTrader 5 positions. Operated by Rahsia Bumi Enterprise.

| Site | Language | Notes |
|---|---|---|
| https://www.mambaapp.online | English | The original site. `mambaapp.online` redirects here. |
| https://my.mambaapp.online | Bahasa Melayu | Same site and same backend, in Malay. Launched 2026-11-07. |

Both sites share one backend: the same member accounts, database, API,
Telegram alerts and trading-backend whitelist sync. A member can sign in on
either site with the same email and password; because login storage is per
domain, switching sites means signing in again. Every page links to its
counterpart on the other site (the **EN | BM** switch link). The admin
workspace is English-only, at `www.mambaapp.online/admin`.

## How it is built

- **Cloudflare Pages**, project `mamba-website`, deployed from `main`. No
  framework, bundler or root `package.json`: plain HTML, CSS and JavaScript.
- **Pages Functions** in `functions/api/` serve the API (auth, member actions,
  admin, contact form, account-deletion requests, events, and the trading
  backend's `backend/account-deleted` webhook).
- **Cloudflare D1** database `mamba-db`, bound as `DB`.
- **Build**: `node scripts/build-public.mjs` copies an allowlist of site files
  into `dist/`, the only folder Pages publishes. Tests, migrations, tools and
  docs stay private. The build fails if a page points at a file that would not
  be published, or if an English page has no Malay version.

### Repository layout

| Path | What it is |
|---|---|
| `*.html`, `*.css`, `*.js` (root) | English pages and the shared styles and scripts |
| `ms/` | Malay pages, plus `robots.txt` and `sitemap.xml` for `my.mambaapp.online` |
| `i18n.js`, `i18n-ms.js` | Text lookup for scripts, and the Malay dictionary |
| `config.js` | Single source of truth for Valetax links, the referral code and app store IDs |
| `demo.js` | Local-only mock API (localStorage), active on `localhost` / `127.0.0.1` |
| `functions/api/` | Pages Functions: the API |
| `migrations/` | D1 schema migrations (applied by hand, see below) |
| `scripts/build-public.mjs` | Builds `dist/` for deployment |
| `tests/` | Standalone Node and Playwright suites |
| `tools/valetax-sync/` | Operator-run tool that pulls the Valetax downline for reconciliation |
| `docs/` | Plans and the progress log |

## The Malay site (my.mambaapp.online)

One deployment serves both hostnames. The Malay pages live in `ms/`, and a
Cloudflare **URL Rewrite rule** on the `mambaapp.online` zone serves page
requests on `my.mambaapp.online` from `/ms/…`. The browser keeps seeing
`my.mambaapp.online/login`. CSS, JS, images, video and `/api/*` are not
rewritten, so both sites share them.

- **Pages**: `ms/<page>.html` mirrors each public English page: `lang="ms"`,
  root-absolute asset URLs (`/styles.css?v=29`), extension-less page links
  (`login`, `./#how-it-works`), canonical and `hreflang` tags, and a
  `mamba-en-source` hash of the English page it was translated from.
- **Script text**: shared scripts wrap visible text in `t('…')`. On English
  pages `t()` returns the text unchanged; Malay pages load `i18n-ms.js` first,
  so `t()` returns the Malay entry.
- **API messages**: `functions/api/_middleware.js` translates `error`,
  `message` and `warning` through `functions/api/_i18n-ms.js` when a request
  comes from the Malay site. Admin routes are never translated.
- **Admin visibility**: events and Telegram alerts from the Malay site are
  tagged (`metadata.site = "ms"`, `Site: my.mambaapp.online (BM)`).
- **Style**: formal Bahasa Melayu, keeping the trading terms Malaysian traders
  use (stop loss, take profit, breakeven, trailing stop, entry, pip, MT5, IB,
  whitelist). The legal pages state that the English version prevails. Text
  members paste into Valetax support tickets stays in English.

Cloudflare configuration (in the dashboard, not the repo): one rewrite rule,
three redirect rules (`/ms/*` on `my.` and `www.` and `/admin` on `my.`), and
the `my.mambaapp.online` custom domain on the Pages project. The exact rules
are in [docs/plans/2026-11-06-malay-site.md](docs/plans/2026-11-06-malay-site.md).

### When you change an English page

`tests/ms-parity.spec.js` fails until the Malay page catches up:

1. Make the same change in `ms/<page>.html` with Malay text. Keep the markup,
   ids, form fields and `?v=` versions identical to the English page.
2. Update its `<meta name="mamba-en-source">` hash; the failing test names the
   page, and the hash rule is `sourceHash()` in the test.
3. New script text: wrap it in `t('…')` and add it to `i18n-ms.js`. New API
   message: add it to `functions/api/_i18n-ms.js`.
   `tests/ms-i18n-coverage.spec.js` lists anything missing.

## Local development

```bash
npx wrangler pages dev . --port 8789 --local
```

- English site: http://localhost:8789/. Malay site:
  http://localhost:8789/ms/ (the zone rewrite only exists in production).
- On localhost, `demo.js` answers the API from localStorage, so sign-up, the
  dashboard and the admin workspace (key `demo-admin`) work without touching a
  database or Telegram.
- `.dev.vars` (not committed) can hold `TELEGRAM_BOT_TOKEN` and
  `TELEGRAM_CHAT_ID` for local alerts.

## Tests

The browser suites use Playwright from `tools/valetax-sync`:

```bash
cd tools/valetax-sync && npm install && npx playwright install chromium
```

With the dev server running on port 8789:

| Suite | Covers |
|---|---|
| `node tests/ms-parity.spec.js` | Malay pages match their English pages (no server needed) |
| `node tests/ms-i18n-coverage.spec.js` | Every script and API message has Malay text (no server needed) |
| `node tests/ms-pages.spec.js` | Malay pages and member journey in a browser, plus API language |
| `node tests/site-integrity.spec.js` | Pages, assets, links and asset versions |
| `node tests/user-journey.spec.js` | English member journey (demo API) |
| `node tests/api-journey.spec.js` | Member API against the real local Worker and D1 |
| `node tests/valetax-links.spec.js` | Valetax links are config-owned on both sites |

`tests/run-all.sh` runs the older core suites. `app-banner` and
`valetax-admin-ui` fail on `main` already: the app banner was removed in the
October revamp, and the localhost demo mock rejects real admin keys.
`account-deleted-sync` needs the dev server started with
`--binding BACKEND_ADMIN_KEY=test-backend-key --binding BACKEND_MANAGER_URL=http://127.0.0.1:9`.

## Database migrations

Migrations are applied by hand, never with `wrangler d1 migrations apply`:

```bash
npx wrangler d1 execute mamba-db --remote --file=migrations/<file>.sql
```

The gap at `0007` is deliberate; do not renumber. Migrations 0006, 0009, 0014
and 0015 each rebuild the `events` table to widen its type check, so apply
them in order and never replay an older one after a newer one. Local D1 drifts
behind production; compare schemas before trusting a local test run.

## Deployment

- Pushing to `main` deploys production. Pages runs
  `[ ! -f scripts/build-public.mjs ] || node scripts/build-public.mjs` and
  publishes `dist/`.
- Other branches get preview deployments at
  `<branch>.mamba-website-8iv.pages.dev`. Malay pages are under `/ms/` there.
  **Previews use the production D1 database**, so don't sign up or submit
  forms on a preview.
- Production secrets (Pages settings): `BACKEND_ADMIN_KEY`,
  `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. `BACKEND_MANAGER_URL` is set in
  `wrangler.toml`.
- Static assets are cache-busted by hand with `?v=N`; bump it on every page
  that loads a changed file (English and Malay alike).

## Further reading

- [docs/plans/2026-11-06-malay-site.md](docs/plans/2026-11-06-malay-site.md): the Malay site design, Cloudflare rules and launch checks
- [docs/progress.md](docs/progress.md): progress log
- [CLARITY-ADJUSTMENT.md](CLARITY-ADJUSTMENT.md): the October 2026 public-site, member and admin revamp
- [tools/valetax-sync/README.md](tools/valetax-sync/README.md): pulling the Valetax downline
