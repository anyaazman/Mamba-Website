# How Mamba Works revamp

## Goal

Rebuild the legacy `how-Mamba-work.html` page in the clarity preview so a first-time client can understand the product flow, the two supported management modes, and the setup path without leaving the current light revamp aesthetic.

## Scope

- Keep the original repository at `/Users/anyaazman/Development/Mamba-Website` unchanged.
- Preserve the existing screenshots, product videos, app-store URLs, broker disclosure, legal links, support links, and member-area navigation.
- Replace the dense legacy layout with a scoped page structure and `how-work-revamp.css`.
- Explain Mamba as a post-entry trade-management tool: the client chooses the trade; Mamba manages configured protection such as take profit, stop loss, breakeven, and trailing.
- Keep strategy copy descriptive and avoid unsupported performance, prediction, or profit claims.
- Make the page usable at mobile and desktop widths, including a keyboard-accessible mobile navigation drawer.

## Implementation steps

1. Save a timestamped rollback copy of the current preview page and any page-specific stylesheet.
2. Rebuild the page with:
   - revamp header and light canvas;
   - concise hero and mechanism overview;
   - V1 Growth and V2 Superscalping strategy cards using the existing media;
   - a connected five-step setup flow;
   - app-store actions, Valetax disclosure, support/member CTA, and the existing legal/risk footer content.
3. Add focused responsive styles in `how-work-revamp.css`; load shared `config.js` and `nav.js` so store links and navigation remain wired.
4. Add `tests/how-work-revamp.spec.js` to cover required sections, media and store links, responsive overflow, readable light-theme colors, and no broken local references.
5. Run the focused test, site integrity, shared-theme checks, and `git diff --check`.
6. Open `http://localhost:8790/how-Mamba-work.html` for visual review.

## Acceptance criteria

- The page explains the core mechanism in the first viewport: entry is chosen by the client, then Mamba applies configured TP/SL and adjusts protection according to the chosen mode.
- Both legacy strategy demonstrations and all five setup steps remain available.
- All local assets resolve, internal navigation works, app links remain functional, and the page has no horizontal overflow at 390px or 1280px.
- The original repository has no changed files.

## Confirmed onboarding order

The client-approved sequence for the guide is:

1. Create the Mamba member account.
2. Request IB verification, with the new-account and existing-account Valetax paths.
3. Add the MT5 account to manage.
4. Request whitelist approval and wait for approval.
5. Download the app, configure V1 or V2, and start the first protected trade.
