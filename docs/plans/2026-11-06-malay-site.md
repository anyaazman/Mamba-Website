# Malay site: my.mambaapp.online

`www.mambaapp.online` stays the English original. `my.mambaapp.online` is the
same site in Bahasa Melayu. It shares everything behind the pages: accounts,
the D1 database, the API, Telegram alerts, the trading-backend sync and the
Bridge webhook. A member can sign in on either site with the same email and
password. Login storage is per domain, though, so switching sites means
signing in again.

## How it is served

One Pages project (`mamba-website`), one deploy, two hostnames.

- Malay pages live in `ms/` (11 pages, plus `ms/robots.txt` and `ms/sitemap.xml`).
- A zone **URL Rewrite rule** serves page requests on `my.mambaapp.online`
  from `/ms/…`. The browser keeps seeing `my.mambaapp.online/login`.
- CSS, JS, images, video and `/api/*` are not rewritten, so both sites share
  them, along with the same Functions and D1.
- The English site's serving path does not change. A Functions middleware
  was avoided on purpose: Pages does not apply `_headers` to Functions
  responses, so routing pages through one would drop CSP/HSTS.

Decisions:
- Admin stays English, on www only.
- Legal pages are fully translated, and the English version prevails ("Versi
  Bahasa Inggeris terpakai jika terdapat sebarang percanggahan").
- Formal Bahasa Melayu, keeping English trading terms (stop loss, take
  profit, breakeven, trailing stop, entry, pip, MT5, IB, whitelist).
- An EN | BM switch link only, with no automatic redirects.
- Text a member pastes into a Valetax support ticket stays in English.

## What is in the repo

| Piece | Where |
|---|---|
| Malay pages | `ms/*.html`: `lang="ms"`, root-absolute assets (`/styles.css?v=29`), extension-less relative page links (`login`, `./#how-it-works`), canonical on my., hreflang on both sites, and `mamba-en-source` (hash of the English page it was translated from) |
| Script text | `i18n.js` (`window.MAMBA_T`; English text is the key) + `i18n-ms.js` (Malay dictionary, loaded only by `ms/` pages). Shared scripts wrap text in `t('…')` |
| API messages | `functions/api/_i18n-ms.js` + `_middleware.js`: `error` / `message` / `warning` are translated when the request comes from the Malay site (host `my.mambaapp.online`, or a same-origin Referer under `/ms/` on previews and localhost). Admin routes are never translated |
| Site tagging | `siteMeta()` / `siteFields()` in `_helpers.js`. Events from the Malay site carry `metadata.site = "ms"`; Telegram alerts gain `Site: my.mambaapp.online (BM)`. English records are unchanged |
| Build | `scripts/build-public.mjs` publishes `ms/`, checks its references, and fails if a public English page has no Malay version |
| Tests | `tests/ms-parity.spec.js`, `tests/ms-i18n-coverage.spec.js`, `tests/ms-pages.spec.js` |

### When English copy changes

`tests/ms-parity.spec.js` fails as soon as an English page differs from the
version its Malay page was translated from. To fix it:
1. Update the matching `ms/<page>.html`: same markup, translated text, root-absolute assets, extension-less page links.
2. Set its `mamba-en-source` to the new hash. The failing test prints which page; the hash is sha256 of the English file with `?v=N` removed and whitespace runs collapsed (`sourceHash()` in the test).
3. Wrap any new script text in `t('…')` and add it to `i18n-ms.js`. Add any new member-facing API message to `functions/api/_i18n-ms.js`. `tests/ms-i18n-coverage.spec.js` lists what is missing.

## Cloudflare configuration (dashboard; outside the repo)

Zone `mambaapp.online`, Free plan. **Created 2026-11-07**, alongside the zone's existing redirect "Redirect from WWW to root [Template]" (despite its name, it sends `mambaapp.online/*` to `www.`). In all: 1 of 10 rewrite rules and 4 of 10 redirect rules.

### 1. URL Rewrite rule
Rules → Transform Rules → **Rewrite URL** → Create rule
- Name: `Malay site pages from /ms`
- Custom filter expression:
  ```
  (http.host eq "my.mambaapp.online"
   and not starts_with(http.request.uri.path, "/api/")
   and not starts_with(http.request.uri.path, "/ms/")
   and http.request.uri.path ne "/ms"
   and http.request.uri.path.extension in {"" "html" "xml" "txt"})
  ```
- Path: Rewrite to → **Dynamic** → `concat("/ms", http.request.uri.path)`
- Query: Preserve

### 2. Redirect rules
Rules → Redirect Rules → **Single Redirects**. Use wildcard pattern matching and preserve the query string. Redirects run before rewrites, so these never loop.

| Name | Request URL | Target URL | Status |
|---|---|---|---|
| Malay site: hide /ms | `https://my.mambaapp.online/ms/*` | `https://my.mambaapp.online/${1}` | 301 |
| www /ms to Malay site | `https://www.mambaapp.online/ms/*` | `https://my.mambaapp.online/${1}` | 301 |
| Malay admin to English admin | `https://my.mambaapp.online/admin*` | `https://www.mambaapp.online/admin` | 302 |

There is no separate rule for the bare domain: `mambaapp.online/ms/*` goes to www through the existing rule, then to `my.` through the second rule above.

### 3. Custom domain
Workers & Pages → `mamba-website` → Custom domains → Set up a custom domain →
`my.mambaapp.online`. Cloudflare creates the CNAME to `mamba-website-8iv.pages.dev`
and issues the certificate.

## Launch order (done 2026-11-07; `my.mambaapp.online` live from `52d7b8c`)

The English pages link to `my.mambaapp.online`, so the subdomain must exist
before those links go live:

1. Review the Malay pages on the branch preview:
   `https://feature-malay-site.mamba-website-8iv.pages.dev/ms/`. **Previews use
   the production D1** (with no Telegram or backend secrets), so don't sign up
   or submit forms there; use local `wrangler pages dev` for that.
2. Add the rewrite and redirect rules (section 1–2). They affect only
   `/ms/*` paths and the not-yet-existing `my.` host.
3. Add the custom domain (section 3). Until the merge, `my.` shows the
   English 404 page; nothing links to it yet.
4. Merge to `main`. The production deploy brings the Malay pages and the
   English switch links live together.
5. Run the live checks below.

## Live checks after launch

- `curl -sI https://my.mambaapp.online/` → 200, and the page has `<html lang="ms">`
- `/login.html` ends at `/login` in Malay; `/ms/login` gives 301 → `/login`
- `/admin` gives 302 → `https://www.mambaapp.online/admin`
- `https://www.mambaapp.online/ms/` gives 301 → `https://my.mambaapp.online/`
- `Content-Security-Policy` and `Strict-Transport-Security` headers are present on `my.`
- `/styles.css`, `/dashboard.js` and a `/web-files/` video return 200 on `my.`
- A wrong-password sign-in on `my.` shows "E-mel atau kata laluan tidak sah."
- `https://my.mambaapp.online/robots.txt` and `/sitemap.xml` return the Malay versions

## Fallback

If the rewrite rule does not reach Pages, the fallback is a root
`functions/_middleware.js` that serves `/ms/…` for the `my.` host and sets the
security headers itself. That only affects `my.`; the English site is never at
risk while you test it there.
