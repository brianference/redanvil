# Spec — enforce the requirements that were declared and never measured

Scope: `orchestrator/`, `rules/`, `docs/DONE-CHECKLIST.md`. Do **not** touch
`az-planting-calendar/` app source. No git add/commit/push, no deploy.

Inherited rules — see `rules/base-15.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function.
- Fail closed. Unknown state is an explicit failure, never silent success.
- Write `--`. Never a unicode em dash.

## Why

`docs/plan-source-taketheprdandjoyfulprism.md:204` declares a set of §7.3a
blockers **"not optional"**. Measured against the code today:

- rubric rules mentioning design options / variants: **0**
- `DONE-CHECKLIST.md` rows for them: **0**
- hooks enforcing them: **none**
- breadcrumbs: required in `rules/per-app-pack.md`, **0** rubric rules, and the
  app has none
- JSON-LD: required in `rules/per-app-pack.md`, not present in the app
- canonical link: not present in the app

The checklist enforcement built earlier in this session was derived from
`DONE-CHECKLIST.md` alone, so a second document's binding requirements stayed
exactly as unenforced as before. This spec closes that.

## The rule that must hold while you work

`orchestrator/test/doneChecklist.test.ts` pins `unimplementedRows()` to `[]`.
**Add each checklist row and its implementation in the same change.** Never add
a row first and implement later -- a row with no measurement fails every app
immediately, and the pinned test is what stops that from being done casually.

Registration is four places (a rule missing from any one either fails as
unevaluated or silently auto-passes):

1. `orchestrator/src/rubric/rules.ts` -- `RULES`
2. `orchestrator/src/commands/gate.ts` -- `APP_CHECKS`
3. `orchestrator/scripts/checks/<rule-id>.mjs` + a case in `check.mjs`
4. `orchestrator/src/done/coverage.mjs` -- bind the new row id

Exit codes: **0 pass, 1 fail, 3 n/a**.

## New checklist rows and their checks

Add these to `docs/DONE-CHECKLIST.md` in the sections named, then implement.

### Section C (the page, seen)

**C8 — Inner and detail pages show breadcrumbs.** Rule `fe-breadcrumbs`.
Drive the live app: for each non-home route that is a detail or inner page,
assert a `nav` with an accessible name matching `/breadcrumb/i` (or
`aria-label="Breadcrumb"`) exists and contains a link back toward the parent.
n/a only when the app has a single route.

**C9 — The chosen design was picked from three distinct options.** Rule
`proc-design-options`. Evidence-based: require
`design-refs/design-options/` containing at least **three** option artifacts
(HTML or image), plus a `DECISION.md` naming which was chosen and why.
Fail when fewer than three options exist, when `DECISION.md` is missing, or when
it contains an unwritten marker (`TBD`, `Fill this in`, `TODO`). Structural
distinctness cannot be decided mechanically, so `DECISION.md` must state in one
line how the three differ **structurally** -- and a reviewer can challenge it.
This is the §7.3a step the plan called not optional.

### Section D (content is real)

**D8 — Terms and Privacy meet the reference standard.** Rule
`fe-legal-substance`. Measured from the reference implementation at
`https://redanvil.pages.dev` on 2026-08-02: `/terms` = 1462 words / 16 `h2`;
`/privacy` = 1605 words / 16 `h2`.

Require for **both** pages: **>= 1400 words** and **>= 14 `h2` sections**, and
required topic coverage matched case-insensitively against headings and body:

- Terms: acceptance/eligibility, what the service is, disclaimer, acceptable
  use, intellectual property, third-party services, warranties, limitation of
  liability, indemnity, availability/changes to the service, termination,
  changes to these terms, governing law, contact.
- Privacy: who we are/contact, accounts, what is collected, what is **not**
  collected, why/purpose, processors/third parties, cookies or local storage,
  data location/transfers, retention/deletion, your rights/requests, children,
  security, changes to this policy, contact.

Report every missing topic by name. Word/section floors alone are not enough --
a padded page can clear a word count while omitting liability entirely.

**D9 — Structured data and canonical URL.** Rule `fe-structured-data`.
Require a valid `application/ld+json` block that parses as JSON and carries
`@context` and `@type`, and a `<link rel="canonical">` with an absolute URL, on
the home route at minimum. `per-app-pack.md` already requires JSON-LD.

### Section E (shipped)

**E6 — Every binding declared in config exists in the deployed environment.**
Rule `lg-bindings-bound`.

This is the gap that nearly shipped a broken assistant: `wrangler.toml` declared
`[ai] binding = "AI"`, every test passed, and the deployed Pages project had
`ai: {}`. The endpoint correctly fail-closed with 503, so no route check caught
it -- the code was right and the environment was wrong.

Parse declared bindings from `wrangler.toml` (`[[d1_databases]]`, `[ai]`,
`[[kv_namespaces]]`, `[[r2_buckets]]`). For each, probe the **deployed** app for
its symptom: a declared binding whose endpoints answer "binding unavailable" /
503-with-a-missing-binding-reason is a FAIL. Token-free -- measure the deployed
reality, not the config file and not the Cloudflare API.
n/a when no `wrangler.toml` exists.

## Also: raise the brand-mark floor

Rule `fe-brand-mark-size`, bound to a new row **D10 — the brand mark renders at
a real size**. `fe-brand-mark` checks bytes and shape; nothing checks how large
the mark actually renders. The app shipped a 32px mark that the user called far
too small.

Measure the **rendered** height of the header brand mark on the live page at
1280 and at 375. Require **>= 48px** at 1280. At 375 require **>= 32px** (small
screens legitimately scale down, but not to nothing). Fail when no image or SVG
mark is found in the header at all.

## Proof required

For **every** new rule:

1. The check run against a **known-bad fixture**, real output, exiting non-zero.
2. The check run against a **known-good fixture**, exiting 0.
3. `npm run typecheck`, `npm run lint`, `npm test` for the repo -- real tails.
4. `unimplementedRows()` still returning `[]` after your rows are added.

A check that cannot be made to fail is worthless -- if one cannot, say so rather
than shipping it.
