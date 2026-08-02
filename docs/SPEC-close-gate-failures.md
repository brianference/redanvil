# Spec — close the 16 gate failures, and fix the two rules that are wrong

Two scopes. Sections A and C are `orchestrator/` only. Section B is
`az-planting-calendar/` only. No git add/commit/push, no deploy.

Inherited rules — see `rules/base-15.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function. Fail closed.
- Write `--`. Never a unicode em dash.

The gate scored `az-planting-calendar` **0/100, 72/81 evaluated**, with 16
failing rules. Some are real defects. Two are bugs in rules added earlier today,
and those get fixed first -- a wrong measurer is worse than a missing one because
it burns effort on a defect that does not exist.

---

# A. Two rules are measuring the wrong thing

## A1. `fe-legal-substance` reads source, not the rendered page

It reports `terms: 37 words, 0 h2 sections`. The deployed page measures **1687
words across 16 h2 sections** -- verified against
`https://az-planting-calendar.pages.dev/terms`. The check is reading a React
component whose 37 words are JSX, while the copy lives in `src/i18n/en.ts` and
is rendered at runtime.

Measure the **rendered** page the way `fe-required-pages` already does: serve or
fetch the route and count from the DOM. A rule that reads source will be wrong
for every app that keeps copy in a locale bundle, which the rule pack requires
all of them to do.

Re-run against az-planting-calendar afterwards: terms and privacy must pass on
their real content, with the word and section counts printed.

## A2. `u-sec-param-sql` false-positives on a constant column list

It flags:

```
interpolated SQL: functions/lib/db.ts: `SELECT ${ZONE_SELECT} FROM zones WHERE id = ?`
```

`ZONE_SELECT` is a module-level constant column list and the value is bound with
`?`. That is not injection. Flagging it teaches people to ignore the rule, which
costs more than the rule earns.

Narrow it: an interpolation is a finding when the interpolated expression could
carry a request value. A `const` string literal declared in the same module, and
used inside a `SELECT` column position, is not. Keep flagging any interpolation
of a parameter, a function argument, or anything derived from `request`.

Prove both directions: a genuine `WHERE id = ${userInput}` must still FAIL, and
the `ZONE_SELECT` shape must PASS.

---

# B. The real app defects

## B1. `/api/grid` and `/api/plantable` ignore `q`

Measured: the UI narrows 59 rows to 18 on "Beans", but
`/api/grid?q=Beans` returns 45 of 45 and `/api/plantable?q=Beans` returns 7 of 7.
The parameter is accepted and discarded, which is the decorative-control failure
the rule exists for -- and it means the UI is filtering client-side over a full
payload rather than asking the server.

Make `q` narrow on both endpoints, parameterized and Zod-validated like
`/api/crops` already is, and have the UI use the server result. Add route tests
asserting a strictly smaller row count for a known-subset query on each.

## B2. Raw crop art is committed outside an asset directory

`hyg-no-binaries` flags `design-refs/crop-art/raw/*.jpg`. Those are generation
intermediates; the shipped WebP files live in `public/crops/`. Remove the raw
directory from the tree and gitignore it, exactly as `tmp-sources/` was handled.
Do not delete the shipped assets.

## B3. Breadcrumbs and structured data

- `fe-breadcrumbs`: inner and detail routes need a breadcrumb `nav` with an
  accessible name matching `/breadcrumb/i` and a link toward the parent.
- `fe-structured-data`: a parseable `application/ld+json` block with `@context`
  and `@type`, plus an absolute `rel="canonical"`, on the home route at minimum.

## B4. Prior-art scans

`u-integration-scan` and `u-competitor-scan` fail. The files exist; the scans
want recorded, dated findings and written conclusions rather than presence.
Read each check's diagnostic and satisfy what it actually asks for.

## B5. Remaining

`u-test-feature-audit`, `fe-visible-response`, `u-api-real-output`,
`hyg-no-duplication`, `u-sec-timeouts`. Run each check, read its real
diagnostic, and fix the cause. Do not weaken a check to clear it.

`lg-shipped` fails only because HEAD is unpushed. Leave it -- it clears when the
push happens, and pushing is not your job.

---

# C. Measurement provenance

`meas-known-bad` and `meas-standard-tool` fail because the checks added today
have no `knownBad` entry in `evidence/measurement-meta.json`.

Each of these already HAS a known-bad fixture in its test file -- the entry just
was never recorded. Have each check write its own provenance when it runs:
`tool`, `engine` where a browser is involved, the run results, and the knownBad
fixture it was validated against. A check that records its own provenance cannot
drift from it.

Rules needing entries: `u-build-succeeds`, `u-api-not-found`,
`u-api-no-spa-mask`, `u-legal-claims-true`, `fe-favicon-legible`,
`lg-result-reproduces`, `fe-resource-links`, `fe-result-in-viewport`,
`fe-breadcrumbs`, `proc-design-options`, `fe-legal-substance`,
`fe-structured-data`, `fe-brand-mark-size`, `lg-bindings-bound`.

---

## Proof required

- A1: the rendered word and section counts for terms and privacy, and the rule
  passing on real content.
- A2: the injection fixture still FAILS and the `ZONE_SELECT` shape PASSES.
- B1: `curl` output showing `/api/grid?q=` and `/api/plantable?q=` returning
  strictly fewer rows.
- Full repo gate: `npm run typecheck`, `npm run lint`, `npm test`.
- The app's own gate re-run, with the new failing-rule list. Every rule that
  still fails must be named with its real diagnostic.

Do not weaken any rule to make a count go down. If a rule is genuinely wrong,
fix the rule and say which -- that is what A1 and A2 are.
