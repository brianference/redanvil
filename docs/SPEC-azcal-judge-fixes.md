# Spec — close the five independent-judge findings

Scope: **only** `az-planting-calendar/`. No git add/commit/push, no deploy.

Inherited rules — see `rules/base-15.md` and `rules/per-app-pack.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function.
- Validate every boundary input with Zod.
- Fail closed. Unknown or partial state is an explicit error, never silent success.
- Keep all user-facing copy in `src/i18n/en.ts`.
- Write `--`. Never a unicode em dash.

An independent reviewer with no access to the existing verdicts returned 5 FAILs
over 10 judge rules. Every one was re-verified against the source before this
spec was written; they are real, not suggestions. Fix the cause, never the
symptom, and do not delete a feature to make a finding disappear.

## 1. fe-fail-closed-states — a failed search paints as "no results"

`src/pages/HomePage.tsx:125-127`:

```ts
.catch(() => {
  if (!cancelled) setSearchIds(new Set());
});
```

An empty id set flows into `filteredGrid` (HomePage.tsx:148-155) and `YearGrid`
renders its empty state (YearGrid.tsx:44-45). So a network or API failure is
indistinguishable from "no crops match" -- the user is told their search found
nothing when in fact it never ran. This is the exact shape base rule 15 forbids.

Add a distinct search-error state: keep the previous ids or clear them, but set
an error flag and render a real error in the grid region (`role="alert"`), with
copy from `en.ts` and a way to retry. Empty-because-zero-matches and
empty-because-it-broke must not look the same.

Test both: a test that the empty result renders the empty state, and a test that
a failed `/api/crops` request renders the error state and NOT the empty state.
Force the failure with Playwright request interception, not by breaking code.

## 2. u-val-input-validation — two handlers skip the schemas that exist

`functions/api/plantable.ts:19-42` and `functions/api/grid.ts:14-31` hand-check
`method` / `date` / `month`. `PlantableQuerySchema` (schemas.ts:117) and
`FilterQuerySchema` (schemas.ts:128) already exist and neither handler imports
them.

Parse the query with the existing schema in both handlers and return the
existing 400 error shape on failure. Do not weaken either schema to fit the
current hand-rolled behaviour; if a schema is genuinely wrong for the route, fix
the schema and say so in your report.

Keep the current accepted inputs working -- the acceptance suite covers
`?month=6` and the date parameter, and those must still pass.

## 3. u-conc-no-speculative-abstraction — dead assistant layer

`getAssistantCropData` (`functions/lib/db.ts:325-353`) and `CropWindowSummary`
(`db.ts:309-318`) have **zero callers** outside their own file. Production
grounding goes through `groundFilters` (assistant.ts:226). Confirmed by grep.

Delete both, plus any now-unused imports or types they pulled in. `u-conc-dead-code`
is a blocker, so this is not optional tidying.

If a test exists only to cover the deleted function, delete that test too -- do
not keep a test alive to justify dead code.

## 4. u-conc-use-what-exists — a tested helper sits unused

`halfMonthInWindow` (`src/lib/halfMonth.ts:60-68`) is exported and unit-tested,
and is referenced **only by its own test file**. `HomePage.tsx:215-224` hand-
inlines the same wrap-around logic as `windowOverlapsHalves`, used at
HomePage.tsx:61-64.

Replace the inlined logic with the tested helper. If the helper's signature does
not fit the call site, adapt the call site; if it genuinely cannot express the
case, keep the local version and explain precisely why in your report rather
than leaving both.

## 5. u-test-adequacy — the production grounding path is untested

`groundFilters` (`assistant.ts:226-294`) is what actually answers every assistant
request (called at assistant.ts:375) and `assistant-shape.test.ts` never
references it. Its `half_month`, `crop`, `method` and empty-filter branches are
all unexercised.

Add unit tests for every branch of `groundFilters` against a fake D1 binding
(the existing tests already stub shapes -- follow that pattern). Also add route
tests for the 400 branches in `plantable.ts:24-38` and `grid.ts:17-30` once
item 2 moves them onto Zod.

## Definition of done

Report each with real output, not a summary:

- `npm run typecheck`, `npm run lint`, `npm test`, `npx playwright test`,
  `npm run build` -- the actual tails.
- For item 1: the new error-state test, and proof it is not vacuous -- show it
  failing against the current `catch` behaviour before your fix (describe the
  failure output), then passing after.
- For item 3: the grep showing zero remaining references to the deleted symbols.
- For item 4: the grep showing `halfMonthInWindow` now has a production caller.
- For item 5: the test names covering each `groundFilters` branch.

If any item cannot be done as specified, say so plainly and complete the rest.
