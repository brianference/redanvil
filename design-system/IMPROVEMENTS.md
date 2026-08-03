# Design rules — improvements log

Changelog for the RedAnvil design system and the gate that scores it. Newest first.
Append an entry after every design run per the mobile-ux continuous-improvement protocol.

## 2026-08-02 — seven measurement checks that could not fail (RA-178)

Not a design run — a measurement audit, logged here because it changes what "the gate
passed" is allowed to mean for every design rule above. An independent fresh-context
review plus the fixes it triggered found seven checks in the gate's own measurement
layer that had been green since the day they were written, because each one had a path
to a pass that required nothing real to happen:

- `meas-two-run` (G2) held one computed value written twice as `runs[]`, and the
  validator only checked `length>=2` plus agreement — a duplicate always agrees with
  itself. It was vacuous across all six rules it covers.
- `meas-known-bad` (G1) returned pass on an unresolvable fixture path, so prose
  describing a bad case ("results JSON whose finalScore does not match recompute")
  satisfied the rule without a fixture ever executing.
- `meets_the_bar` called `isDone()` without four of its options
  (`qaVisualOk`/`userRefuseOk`/`independentReviewOk`/`coverageHighWater`), which made
  checklist rows C2, C10, F5 and A6 unreachable — enforced in appearance, impossible
  in fact.
- `lg-shipped` (condition 5) read its own prior failure back and could never clear;
  condition 2 (HEAD pushed) deadlocked the very first push by construction.
- `lg-result-reproduces` required `provenance === HEAD`, which is unsatisfiable inside
  a reverify pass (stamping verdicts and committing evidence are two different
  commits), and its "missing scored rule" branch computed the answer and never used it.
- `fe-assistant-present` accepted the bare word "filters" in a response as proof of
  database grounding — the repo's own passing fixture had zero DB access behind it.
- `fe-light-dark` (C3) read only `backgroundColor`, so a hero painted with a
  `background` gradient walked past it to a transparent `html` and false-FAILED.

Cost: unknown how many prior gate runs certified apps against these six-plus rules
with no real signal behind them — the honest number is "every one until today." The
fix is real: 637 tests pass from the repo root, tsc and eslint clean, real QA-visual
and user-refuse harnesses now exist (validated against known-bad first), and coverage
sits at a measured 67.58%, not a round number.

What changed, and what to carry forward:

- **A check that cannot fail carries no information.** Before trusting any new gate
  rule, name the input that would make it FAIL and produce that input — a passing
  known-bad fixture is not optional evidence, it is the only evidence. See the new
  hard rule in the global `CLAUDE.md` and `docs/DONE-CHECKLIST.md` rows G6/G7.
- **A fix for this class of bug can create a new false failure.** The six two-run
  fixes recorded both timestamps at write time, so a fast measurement produced
  byte-identical records and four of six then failed the run meant to prove them
  fixed. Timestamps must be captured as each run actually completes (0.6s–7.7s real
  spreads observed), never backfilled together afterward.
- **`fe-light-dark` now reads `backgroundImage` in addition to `backgroundColor`**, and
  checks the actual painted element rather than assuming `html`/`body` carries the
  surface color — folded into the `playwright-qa` skill (rule 10) so the next app's
  theme check does not repeat this.
- 16 knownBad fixtures are still owed across other rules; this pass fixed the
  mechanism, not every instance of a missing fixture.

## 2026-07-21 — Measure everything + 10-option design exploration (enforced)

Observation: the gate wired only 5 deterministic checks, so the real app-builder gate
measured 5 of 48 rules and the dashboard showed a fabricated 98. Manual review is not
the system doing its job.

Changes:

- Deterministic coverage 5 -> 16 via a real static checker (orchestrator/scripts/checks/
  check.mjs): security (interpolated-SQL, stubbed-auth, fetch-timeouts, headers/CORS,
  input-validation), hygiene (secret-scan, no-binaries), frontend (theme-tokens-only,
  no-unsanitized-html, i18n-central-copy), scoped ts-ignores. Judge + visual verdicts
  cover the rest of the 48-rule rubric.
- gateApp fails-closed on unrecorded visual blockers.
- Promoted measurable mobile-ux rules (touch targets, 16px type floor, non-color state,
  safe areas) to scored visual rules.
- Design process is now: 10 options per new app UI (5 Claude + 5 Grok team), a random
  Mobbin-inspired element injected, Grok designs default, keep approved logos, merge the
  user's picks, then ralph-loop to a real >= 90 with recorded visual evidence.
- Learned: a false-failing check is its own dishonesty — u-sec-param-sql first flagged PRD
  prose ("create, edit, and delete ${x}"); tightened to require real SQL syntax (FROM/INTO/SET).

## 2026-07-21 — Premium requirements become fail-closed rubric rules

Observation: the RedAnvil site shipped without light mode, with bare-text nav and no
breadcrumbs, even though "premium nav" and "light/dark" were written in the per-app
pack. Root cause: those requirements existed only as prose. The scored rubric array
(`orchestrator/src/rubric/rules.ts`) never encoded them, and `computeScore` treated
any rule with no recorded outcome as passing. A code-clean diff therefore cleared the
gate with none of the premium requirements actually checked.

Changes:

- Added a `visual` rule method that is **fail-closed** — an unrecorded verdict FAILS
  (`FAIL_CLOSED_METHODS` in `rubric/types.ts`; `computeScore` in `gate/score.ts`).
- Encoded 9 premium/design requirements as scored `visual` rules: fe-light-dark,
  fe-premium-nav, fe-required-pages, fe-no-attribution, fe-responsive-375,
  fe-product-completeness, fe-visual-review-recorded (blockers) plus fe-seo-og and
  fe-cross-link (major). Documented in `rules/rubric/frontend.md` (lane v1.1.0).
- Added R13 (premium web-app shell) to the living rules, mapping each rule to its
  rubric id, and recorded the inline-style-beats-class specificity trap.
- Fixed the design-gate hook: it matched the whole PostToolUse payload, so reading a
  file that mentioned "pages deploy" tripped it. It now matches only tool_input.command
  and only a real `wrangler pages deploy`, and its checklist now names the 9 visual rules.

Classify: new **must** rules (promoted from prose to scored, fail-closed). Anti-pattern
recorded: requirements that live only in prose and are never encoded in the scored array.

Rule updates:

- Added R13.1–R13.9 (premium web-app shell), version 1.3 → 1.4.
- No rule softened or deleted.

## 2026-07-22 — Brand mark vs banner separation (prior run)

R10.6 / R10.7 added: header brand mark is a small optimized asset, never the hero
banner; favicon/app icon derive from the same mark.

## 2026-07-25 — desktop width, shared shell (v11.0.0)

**A measurement can be confidently wrong in the flattering direction, and only a
user looking at the site will catch it.** `desktop_width.mjs` measured
`main.getBoundingClientRect().width`. A block element is 100% of its parent by
default, so it reported 93% for pages whose content sat in the left third of a
1920 screen. Four pages across two apps were narrow behind that number.

What changed, and what to carry forward:

- Measure **painted** extent, never a container box: text via its own client
  rects (an `<h1>`'s box is full width while its glyphs are not), plus anything
  drawing a background, border or shadow. Exclude header and footer.
- **Inline `maxWidth` is the recurring cause** — eight occurrences now across
  this repo. Enforced statically by `fe-no-inline-width` so it is caught before
  a deploy rather than by a rendered measurement afterwards.
- **Column counts must follow the content.** A fixed `column-count: 3` on a
  two-section page leaves an empty third column and reads as 60% of the screen.
  A `:has()` quantity query only adds a column when there is something to put
  in it.
- **An ellipsis is not overflow.** `fe-responsive-375` tests horizontal
  overflow, so truncated KPI labels (`TOTAL R…`) passed every check. Only the
  screenshot showed it.

Shared shell: twelve units parameterised into `design-system/` (duplication
394 → 40). The pattern that works is tokens-plus-copy props, so each app keeps
its own palette and wording while the markup lives once.

## 2026-08-02 — az-planting-calendar, and what the gate could not see

Twelve design rules passed while a user found four defects in twenty minutes.
Every item below was invisible to a green gate.

- **A control whose result is off-screen looks broken.** Search sat at y=327 and
  narrowed a grid whose first row was at y=1942, so typing changed nothing in
  the first viewport. `fe-search-present` passed (it narrows) and
  `fe-visible-response` passed (something changed). Neither asks whether the
  change is where the person is looking. Render the result **beside the input**,
  with a stated count, and an empty state distinct from an error state.
- **Size the art to the discrimination task.** 45 generated crop illustrations
  at thumbnail size made beans, okra and yardlong read as the same green shape.
  Per-item imagery only earns its weight when the item is identifiable at the
  size it actually renders.
- **A brand mark below ~48px reads as an afterthought.** Shipped at 32px and was
  called "way too small". Now enforced by `fe-brand-mark-size` (>=48px at 1280,
  >=32px at 375).
- **Never delete the brand's defining element to fix a rendering problem.** At
  96px the logo's calendar backdrop looked like a plate on the dark header, so
  it was keyed away -- removing the calendar from a planting *calendar*. Fix the
  rendering, keep the identity.
- **Three options is a real step, and it was skipped.** §7.3a called it "not
  optional" and nothing measured it, so the app was built straight from a
  hypothesis. `proc-design-options` now requires >=3 artifacts plus a
  DECISION.md naming the pick, the why, and the structural difference. Name
  option directories `*-options` -- an app has options for more than one surface.
- **Mockups carry stale data into the build.** All three option frames hardcoded
  superseded frost dates. Wire option frames to the real source, or mark the
  numbers as placeholder in the frame itself.
- **Truncation is not overflow, and the check knew it before the code did.** The
  rule text said "an ellipsis is not overflow"; the implementation compared
  scroll width at page level and passed a page with five truncated labels.
  Element-level `scrollWidth`/`scrollHeight` now, excluding sr-only elements and
  deliberate scroll containers -- a naive version reported 12 hits of which 2
  were false.
- **Placeholder text is a third blind spot.** `placeholder` is not `textContent`,
  so a truncated placeholder passes both the old and new checks. Keep
  placeholders short enough for 375 rather than relying on a measurement.
- **A strict CSP breaks axe injection.** `script-src 'self'` blocks
  `page.addScriptTag`. Fix the harness (`bypassCSP` in the audit context), never
  the app -- adding `unsafe-inline` to make a tool work undoes the security work
  in the same session that added it.
