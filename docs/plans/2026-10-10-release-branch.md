# Revamp branch delivery

## Authorized outcome
Commit the accepted revamp and push `codex/ten-second-clarity` to
`anyaazman/Mamba-Website`. Preserve the original checkout, local samples and
layout backups. The user intends to publish for production; a branch push alone
does not establish deployment.

## Delivery steps
1. Check repository identity, GitHub authentication and current remote main.
2. Bound demo mode to localhost; repair the known form persistence failures and
   homepage Valetax configuration link, with focused regression evidence.
3. Exclude local backups from the commit and identify deployment asset boundaries.
4. Verify the changed handlers, local member/admin journeys, pages and mobile UI;
   build Pages functions and review the final diff.
5. Commit only intended source/docs/tests, push the branch without force, and
   verify the exact remote commit. Report production separately.

## Current evidence and constraints
- Remote main and preview baseline: `210dac824df6090076d95d47e19b07a469aa5232`.
- GitHub active account: `anyaazman`.
- Original checkout is clean. Preview origin points at the original local clone;
  use a separate GitHub remote in the preview.
- Cloudflare project listing is unavailable because this session has no
  Cloudflare authentication. Do not change production data or claim deployment.
- No schema migration is needed for the changes; installed production schema and
  live broker/Manager behavior remain unverified.
- Pages publishes the project root in the existing configuration. Its uploader
  does not use `.assetsignore`; Gitignore also does not protect a direct local
  upload. Before deployment, prepare an explicit public asset directory excluding
  docs, backups, tests, tools, migrations and local secrets, and verify the Pages
  build/output settings. This branch-delivery task does not deploy the root.

## Release corrections and verification
- Forms: real handlers tested with in-memory SQLite; absent tables and rejected
  deletion-event types fail with HTTP 500 and no success notification. Valid
  requests persist before HTTP 201. Optional event logging remains non-blocking.
- Public `?demo` leaves real fetch and saved data untouched. Local seed imports
  retain existing clients, sessions and later edits.
- Shared Valetax link configuration restored on the homepage. Download links,
  section destinations and desktop fallback point at existing revamp sections.
- Homepage activity tracking restored. Shared script versions stay consistent.
- Focused regressions reproduced the old failures before passing after fixes.
- Independent release review found the missing section links and homepage
  tracking; a grouped fix and scoped re-review resolved both findings.
- Pages Functions compile successfully. Local UI suites cover mobile member
  signup/login, admin workflows, onboarding, IB guidance, setup invitation,
  full guide, navigation and site-wide style/integrity.

## Publication boundary
GitHub `main` is still the original baseline. The revamp is delivered as
`codex/ten-second-clarity`; check that branch's Git history for the delivered
revision. No merge into main, Cloudflare deployment, production data change or
live broker verification is included in this delivery.

## Acceptance
Local demo remains available; public `?demo` cannot intercept real requests.
Public form success requires a saved record. Existing optional telemetry remains
non-blocking. All accepted UI and sample data remain. GitHub branch tip equals
the verified local commit, with original main preserved.
