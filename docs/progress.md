# Current work

## Revamp branch delivery — 2026-10-10
- User authorized commit and push for intended production publication.
- Governing record: [Release branch](plans/2026-10-10-release-branch.md).
- Target: `anyaazman/Mamba-Website`, branch `codex/ten-second-clarity`; original
  checkout and main baseline `210dac8` preserved. The preview now has GitHub as
  `origin` and retains the local source remote as `original-local`.
- Accepted revamp includes public pages, member onboarding/dashboard, mobile
  refinement, detailed guide, setup invitation and admin workflow/sample data.
- Release fixes: localhost-only demo, durable public-form success, valid app and
  footer destinations, shared Valetax link and restored homepage tracking.
- Verification: public form regressions 5 passed; local sample/remote boundary
  checks 17 passed; admin handler checks 16 passed; hero checks 9 passed;
  Valetax links passed; section destinations 17 passed; Pages Functions build
  passed. Browser suites cover member and admin journeys and responsive pages.
- Independent review and scoped follow-up found no unresolved commit/push
  blockers after navigation/tracking fixes. Final remote revision is reported
  in the delivery response and visible in the branch history.
- Production is not deployed by this task. Cloudflare authentication is absent;
  clean asset packaging, production schema/runtime verification and main
  integration remain deployment prerequisites. Local backups remain available.

## Admin revamp — 2026-10-05
- Owner: Codex. User authorized the approved admin improvement suggestions.
- Plan: [Admin revamp](plans/2026-10-05-170000-01-plan-admin-revamp.md).
- State: Implemented and locally verified in `/Users/anyaazman/Development/Mamba-Website-clarity-preview`, branch `codex/ten-second-clarity`, baseline HEAD `210dac824df6090076d95d47e19b07a469aa5232`. No commit, push or deployment performed.
- Delivered: Overview with actual request counts and labelled historical sync alerts; compact client workspace with recorded onboarding progress and separate IB/MT5 states; accessible confirmation/password forms and More actions; persistent backend approval/deletion warnings; preserved Valetax snapshot import and four buckets with stale/incomplete notices; Malaysia-time activity filters, client search, metadata and stable pagination; responsive blue/navy styling.
- Backup: `docs/backups/admin-before-revamp-2026-10-05/`. Matching source files plus restore notes. Original repository remains clean.
- Verification: `node tests/admin-revamp.spec.js http://localhost:8790` — 48 passed after final fixes. Desktop and 320/390/768px layouts, isolated demo mutations and injected warning/network/refresh failures. `node tests/admin-data.spec.js` — 16 passed against real handlers and in-memory SQLite. `node tests/site-integrity.spec.js http://localhost:8790` — 134 passed; final admin-only lifecycle fixes subsequently covered by the 48-check admin suite. `git diff --check` and JS syntax checks passed.
- Negative controls: active-tab hover regression failed before styling fix; API timestamp contract failed on backed-up source; action-refresh lock regression failed before fix; refresh-unavailable regression timed out on stale counts before fix. All pass on final source.
- Independent review: two P2 findings (an earlier action unlocking a newer dialog; stale clients republished after failed refresh) were fixed with retained failing-then-passing checks. No other blocking findings.
- Visual review: desktop and phone browser review complete. User admin tab reloaded at `http://localhost:8790/admin`; temporary viewport override reset. User's existing Local Test Trader remains unchanged. Key is `demo-admin` for local demo.
- Screenshot: `/Users/anyaazman/.codex/visualizations/2026/09/15/01a0a2cf-0aaf-7552-95d4-df85ee3b9d3e/mamba-admin-revamp.jpg`. Additional fixture desktop/mobile screenshots in `/tmp/mamba-admin-review/`.
- Limits: Local demo and isolated handler validation only. No live Valetax login, broker operation or production approval/deletion/reset performed. Existing local Wrangler database is not initialized for full production API journeys; it was not modified. Recorded sync alerts are historical, not verified unresolved backend faults.
- Stopping condition met: authorized admin revamp, backup, focused verification, review fixes and local preview delivered. No remaining accepted work.

## Local admin sample data — 2026-10-05
- User authorized adding dummy clients to the local admin preview.
- Delivered six labelled fictional clients: Daniel (registered), Aina (IB request), Mei (IB approved, awaiting MT5), Sara (mixed MT5 states and whitelist request), Hana (approved accounts), Rizal (IB rejected). Five MT5 accounts, sample activity including two simulated historical sync alerts, and a three-client broker snapshot populate all four comparison buckets.
- Added an explicit localhost-only, demo-admin-authenticated Add sample clients control. Import appends once, preserves existing records/sessions/imported snapshots and later sample edits/deletions. Reserved .invalid email domains identify fictional data.
- Existing browser data backed up under localStorage key `mamba_demo_before_admin_samples_v1` before import. Import marker `admin_samples_v1` prevents duplicates. No production API, broker, or original repository changes.
- Verified: seed suite 14 passed (failed on pre-change source), admin workflow suite 48 passed, site integrity 134 passed, syntax/diff checks clean. Read-only self-review confirmed local/auth guards and atomic saved-data update.
- Applied through the user's local admin UI. Reload confirmed seven total clients including the unchanged Local Test Trader, one IB request, one whitelist request and two simulated sync alerts. All Valetax buckets populated. Left Clients open on Sara Lim (Sample).
- Screenshot: `/Users/anyaazman/.codex/visualizations/2026/09/15/01a0a2cf-0aaf-7552-95d4-df85ee3b9d3e/mamba-admin-sample-clients.jpg`.
- State: complete; local dummy data only.
