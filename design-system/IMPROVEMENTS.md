# Design rules — improvements log

Changelog for the RedAnvil design system and the gate that scores it. Newest first.
Append an entry after every design run per the mobile-ux continuous-improvement protocol.

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
