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
