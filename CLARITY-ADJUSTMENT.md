# Ten-second clarity adjustment

This preview keeps the original Mamba project beside it. The initial landing-page
experiment has expanded into the accepted public-site, member-area and admin
revamp on `codex/ten-second-clarity`.

## Current release scope

- Shared blue/navy styling and mobile layouts across public and member pages.
- Candle-by-candle MT5 illustration, detailed How Mamba Works guide, app-store
  downloads and a delayed, dismissible setup invitation.
- Clearer login, member onboarding, IB verification and MT5 account controls.
- Admin overview, client management, Valetax comparison and searchable activity.
- Fictional sample clients and mock authentication restricted to localhost.
- Support and deletion requests report success only after saving their records.

Local layout backups remain in `docs/backups/` and are excluded from Git.
See `docs/plans/2026-10-10-release-branch.md` for delivery evidence and the
remaining production-deployment prerequisites.

## Initial homepage changes

- Replaced the technical hero (“execution time”, “uptime”, “256-bit”) with a plain-language promise: **You place the trade. Mamba manages the exits.**
- Defined the product in one sentence: a mobile app that automates stop loss, breakeven and trailing stops on MetaTrader 5 positions.
- Added an at-a-glance trade illustration showing entry, breakeven and a protected open position.
- Made the audience explicit: MT5 traders, busy traders and people building a repeatable risk process.
- Moved the Valetax dependency into the signup context instead of making it the first explanation a new visitor sees.
- Kept the existing account, legal and support destinations intact.

## Original experiment suggestions

1. A/B test this hero against the current homepage using first-click rate on “Create your free account” and “See a trade in action”.
2. Keep the existing detailed feature/how-it-works content below the fold once the headline and product definition are validated.
3. Add a short real app screen recording beside the illustration after confirming the final production copy.
