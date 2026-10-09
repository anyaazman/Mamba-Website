# Mamba revamp: client clarity, trust and demo activation

**Status:** Proposed plan only. Website implementation and publication are not authorized by this document.
**Goal:** Help self-directed MT5 traders understand Mamba within 10 seconds, decide whether it fits their setup, and reach a verified first demo trade with fewer uncertainties.
**Why planning is required:** Requested audit-to-revamp plan; several changes depend on verified product behavior and real evidence.
**Scope:** `/Users/anyaazman/Development/Mamba-Website-clarity-preview`. Preserve the original repository, approved homepage animation, light visual style, connected Getting Started flow, existing-account IB modal improvements, and all member functions.
**Inputs:** User-supplied `MAMBA_HORMOZI_AUDIT.md` (22 September 2026), plus inspection of the current preview's homepage, setup guide, dashboard flow, privacy policy, and tracking code. The audit describes the old public site; its app-store counts and product assertions have not been independently reverified in this planning pass.

## Recommendation

Keep the successful visual direction. Improve the client journey before adding more feature sections or another broad visual redesign. The next release should answer: What does Mamba do? Can I use it? What will it cost? What must I do next? How do I know it is working?

Primary audience: MT5 traders who choose their own entries and want consistent exit/risk rules while away from their terminal. Existing Valetax users get a shorter setup route. Keep V1/V2 as named modes inside the product, with plain-language explanations.

## What the revamp already solves

| Audit concern | Current preview | Decision |
|---|---|---|
| Unclear hero/category | “You place the trade. Mamba manages the exits.” plus an MT5 explanation | Keep the headline; tighten supporting claims rather than replace it blindly |
| Abstract mechanism | Candle-by-candle TP/SL, breakeven and trailing animation, labeled illustrative | Keep it; add actual product evidence separately |
| Unsupported speed/uptime/security counters | Removed from the preview homepage | Do not reintroduce without defined, current evidence |
| Hard-to-follow member onboarding | Connected Download → Verify IB → Connect MT5 flow | Preserve its layout; make next actions and status meanings clearer |
| Existing Valetax path readability | Readable copy boxes, guide and email form | Preserve; expose this path earlier in the public journey |
| Broker and risk disclosure | Present in homepage footer, setup guide and legal pages | Bring a short cost/relationship explanation beside relevant CTAs |

## Remaining evidence-backed gaps

- `index.html`: “Start with a demo” still leads to generic registration. The next step does not explain the demo route before asking for account creation.
- `how-Mamba-work.html`: the setup checklist includes “Fund your trading account,” despite promoting demo use later. It also retains “revolutionary technology,” “entry management,” and “automated trading” terminology.
- `index.html`: “See a trade in action” points at a text section rather than the animated chart. Footer `#home` and `#faq` have no matching targets; other pages point to missing homepage `#get-app`.
- `index.html`: compensation is in the footer, while the free/Valetax CTA area does not explain broker trading costs alongside the offer.
- `dashboard.js`: download has no verified installation state; IB approval, account addition and whitelisting are distinct from a live app connection or rules running. The UI must not imply they are equivalent.
- `privacy-policy.html`: its credential statement explicitly covers the website. It does not establish how the mobile app/backend stores MT5 credentials or behaves offline.
- Existing screenshots, two local mode videos and the dashboard tutorial are potential proof assets. They must be reviewed for currency and instructional value before commissioning replacements.
- `tracking.js` supplies a basic event helper, but the revamped homepage does not load it. A website CTA click cannot prove app installation or a successfully protected trade.

## Outcome 1 — A consistent, honest first impression (priority 1)

**Client result:** A visitor can explain what Mamba does, who chooses entries, the Valetax requirement, and why it is free.

**Work:**
- Keep the approved headline and animation. Suggested supporting copy: “Set take-profit, stop-loss, breakeven and trailing-stop rules for your MT5 positions from your phone.” Confirm supported behavior before final copy.
- Use one consistent description, such as “Mobile trade management for MT5.” Avoid implying trade signals, automatic entries, guaranteed protection, or guaranteed profits.
- Place a compact cost explanation beside the primary CTA and Valetax referral CTA: no Mamba subscription; broker spreads/commissions still apply; Mamba is compensated by Valetax for referred-account activity. Confirm current commercial terms.
- Make “Start with a free demo” lead to an actual demo setup section/guide, with an “Already have Valetax?” alternative and visible member sign-in.
- Repair the animation CTA and fragment destinations. Match link labels to what opens.
- Clarify audience: traders who choose entries and want exit-rule management. Replace “growing accounts” with a concrete use case, without implying returns.
- Align homepage, login, setup guide and relevant metadata. Review “automatically protects,” “takes over,” and “your plan stays on” against actual operational dependencies. Resolve the footer's broad “do not execute trades” wording with the actual distinction between broker execution, user trade decisions and automated management instructions.

**Primary files:** `index.html`, `clarity.css`, `login.html`, `how-Mamba-work.html`; relevant shared links and metadata.
**Acceptance:** All CTAs land on the promised content. Five representative new users see the first screen for 10 seconds; at least four correctly explain the product and who chooses entries, without mistaking it for a signal service. This is a proposed usability gate, not an observed result.

## Outcome 2 — Two clear routes to a first demo result (priority 1)

**Client result:** New and existing Valetax users know their requirements and next action before registration, without assuming a deposit is necessary to test.

**Work:**
- Rework the existing How Mamba Works page around “Try a demo” and “I already have Valetax.” Reuse the existing IB choice/modal behavior rather than invent a second verification process.
- Add a “Before you start” checklist: supported phone/OS, MT5 account/server, partner eligibility, software/connection dependencies, and where each action happens (website, Mamba app, Valetax or MT5).
- Confirm actual demo prerequisites, including KYC and whether existing accounts can move partner relationships. Separate demo steps from optional live-account funding.
- Put functional setup before the V1/V2 detail. Present the modes as “V1 Growth — breakeven rules” and “V2 Superscalping — trailing rules,” retaining exact product names for recognition.
- Preserve the approved three-step dashboard flow. Add context within its steps: “Already installed? Continue to verification”; verification waiting/approved/rejected with next action; added account versus whitelist pending/approved.
- Explain what follows whitelist approval: open the app, connect the eligible account, configure rules and test using demo funds, according to confirmed behavior.
- Keep app connection/rule activity separate from website approval. Use an “Open the setup guide” action until a real integration can establish connection status. A store click must not mark installation complete.
- Include a contextual help link and explain what the member can do while waiting. Any waiting-time estimate needs support-team evidence.

**Primary files:** `how-Mamba-work.html`, `dashboard.html`, `dashboard.js`, `onboarding-revamp.css`, login links, and narrowly scoped guide styles.
**Acceptance:** New-user and existing-account paths are exercised end to end with test accounts. No deposit is presented as a demo prerequisite unless verified as required. Existing pending/rejected/approved and multi-account states remain accurate; refresh preserves real state and Back works. No fabricated “connected” or “rules active” status.

## Outcome 3 — Proof clients can inspect (priority 2)

**Client result:** Visitors can distinguish an explanatory animation from demonstrated product behavior.

**Work:**
- Review the current videos/screenshots/tutorial first. Reuse current, legible assets; produce a concise 60–90 second walkthrough only where existing material is insufficient.
- Show an actual demo account: user opens a position, configured TP/SL appears, a rule changes a stop, and the relevant app/connection status is visible. Show the app version and recording date; redact account identifiers and credentials.
- Keep the hero animation labeled illustrative. Label footage using demo funds; do not imply a successful example establishes future returns or service reliability.
- Add concise captions/transcript and click-to-play loading for phones and slower connections.
- Add genuine user comments about setup or usability only with consent, date and context. Do not invent testimonials, review totals, ratings, or independent security assessments.

**Primary files/assets:** `index.html`, `how-Mamba-work.html`, existing `how-it-works/` assets, tutorial assets, `clarity.css`.
**Dependencies:** Current app access and a real demo walkthrough; consent for any third-party quotation.
**Acceptance:** The recording demonstrates the claimed behavior on the identified version, with no exposed credentials. Playback, captions/transcript and mobile sizing work; media does not autoplay or materially slow the initial page.

## Outcome 4 — Practical trust, compatibility and failure answers (priority 2)

**Client result:** A client can assess access, custody, privacy and outages before connecting an account.

**Work:**
- Add a short homepage FAQ with a functioning `#faq` target: cost, Valetax requirement, who selects trades, demo use, compatibility, permissions and stopping use.
- Expand the guide with a plain diagram of the verified app → service/EA/bridge → MT5/broker relationship. Do not assume the old EA/terminal description is current.
- Explain website data separately from app/backend credentials: what is entered, where it is stored, access rights, revocation and deletion, supported by actual product evidence.
- Publish a verified outage table covering phone offline, terminal/EA stopped where applicable, backend/bridge unavailable and broker disconnected. Distinguish already accepted broker-side orders from ongoing rule adjustments; do not assume either survives a particular failure without testing.
- Add a compact maintained compatibility/release block, legal entity and support channel. Include version/OS/server requirements only from current sources and a response target only if operations can support it.
- Explain that stop rules do not eliminate gaps, spread, slippage or broker risk. Avoid the audit's overly absolute “removes open risk” wording for breakeven.

**Primary files:** `how-Mamba-work.html`, `index.html`, `support.html`; review relevant legal text for consistency, rather than silently repurposing website-only privacy statements.
**Dependencies:** Product/operations confirmation or read-only technical evidence for execution location, permissions, supported environments, outage behavior and commercial terms.
**Acceptance:** Each technical answer has a source/owner and review date in implementation notes. Unknowns are resolved before being asserted publicly. Clients can find cost, compatibility and failure information without visiting several legal pages.

## Outcome 5 — Measured, consistent client journey (priority 3; instrument alongside the changes)

**Client result:** The experience stays readable and consistent across pages, and improvements are judged by successful setup rather than signup counts alone.

**Work:**
- Bring the detailed guide and support entry points into the approved light style; maintain legibility and consistent button labels across the journey. Preserve legal content and current account behavior.
- Extend existing analytics rather than add a second tracking system. Proposed website events: demo-route selection, existing-account route, walkthrough play, store click, registration success, IB request, whitelist request and approval. Use stable stage names and avoid email, credentials or account numbers in new event metadata.
- Treat app install, connection, rules active and first protected demo trade as unavailable unless real app/backend telemetry exists. Initially measure these with consented usability sessions; label self-reported results accordingly.
- Check event API behavior and privacy implications before integration. Local preview testing must remain isolated from production accounts and notifications.
- Establish a baseline, then compare like-for-like traffic and periods. Do not claim a conversion improvement before adequate data exists.

**Measures:** ten-second comprehension; route-to-registration completion; verification/whitelist drop-off and waiting time; common setup support questions; observed time to first protected demo trade. Separate hands-on setup time from external approval waits.
**Verification:** relevant existing suites `tests/site-integrity.spec.js`, `tests/user-journey.spec.js`, `tests/onboarding-layout.spec.js`, `tests/ib-existing-ui.spec.js` and `tests/hero-trade.spec.js` against `http://localhost:8790`; add targeted checks for fragment targets, route continuity and new status wording. Test narrow phones, tablets, desktop, keyboard navigation, zoom and reduced motion. Existing suites alone do not establish real app/broker behavior.

## Suggested homepage reading order

1. Existing clear hero + candle animation + demo CTA and compact cost/eligibility explanation.
2. Three practical benefits: apply defined exits, adjust stops using configured rules, monitor from a phone.
3. Real app walkthrough and what the client should notice.
4. Two setup routes and requirements.
5. Cost, permissions, compatibility and outage FAQ with links to the detailed guide.
6. Demo CTA, support and existing legal footer.

## Implementation order and evidence gates

1. Back up the current approved preview. Implement Outcome 1 and repair navigation; keep current architecture-dependent copy conditional until verified.
2. Confirm demo prerequisites and actual runtime architecture. Build Outcome 2 using the current member flows.
3. Review existing media and collect product evidence in parallel with content preparation; complete Outcomes 3–4 when sources are available.
4. Add proportional measurement and run the affected journey, visual and accessibility checks. Review the full client path before any publication decision.

Do not publish “Protect your first demo trade in 10 minutes” now. Time representative clean setups first, record approval delays separately, then use a supported range or leave timing unpromised. Likewise, do not carry old download counts forward as current proof.

## Not recommended for this pass

- Another hero animation or wholesale redesign of the approved dashboard.
- A paid plan, broker-neutral product, new EA/backend integration or live connection telemetry without separate scope.
- Fake progress, artificial countdowns, profit guarantees, invented reviews or unmeasured performance claims.
- Production deployment, commits or changes to the original project as a side effect of this plan.

## Definition of success

A new client can say what Mamba does after 10 seconds, see the real requirements and costs before registering, select the right setup route, understand each approval state, find help when blocked and verify the result on a real demo account. Existing functions and accepted visual work remain intact.
