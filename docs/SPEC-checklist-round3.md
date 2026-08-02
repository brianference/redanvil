# Spec — three more rows, from defects a green gate missed

Scope: `orchestrator/`, `rules/`, `docs/DONE-CHECKLIST.md`. Do **not** touch
`az-planting-calendar/` or `app-builder/` — other runs own them.
No git add/commit/push, no deploy.

Inherited rules — see `rules/base-15.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function.
- Fail closed. Unknown state is an explicit failure, never silent success.
- Write `--`. Never a unicode em dash.

Add each row and its implementation in the **same change**;
`orchestrator/test/doneChecklist.test.ts` pins `unimplementedRows()` to `[]`.
Registration is four places: `RULES`, `APP_CHECKS`, the check script plus a
`check.mjs` case, and `coverage.mjs`. Exit codes: 0 pass, 1 fail, 3 n/a.

## D11 — Domain items link to real, resolving external resources

Rule `fe-resource-links`.

A reference app that shows an item and tells the reader nothing about where to
learn more has stopped halfway. az-planting-calendar lists 45 crops with
planting windows and no link to how to actually plant any of them, while
`extension.arizona.edu` serves crop guidance and returns 200.

The rule that matters is not "has links" -- it is **"has links that resolve"**,
because the failure mode here is an invented URL. A plausible-looking guide link
to a page that never existed is the anti-hallucination failure in its most
damaging form: it looks like a citation.

Measure on the deployed or locally served app:

- Crawl the item detail routes (discover them; do not hardcode a path).
- Require each to carry at least one **external** link (a different host to the
  app's own).
- **Follow every external link and require a 2xx or 3xx.** Send a browser
  user-agent -- almanac.com returns 403 to a bare curl agent and 200 to a real
  one, and treating that as a dead link would be a false failure.
- Fail naming each dead link with its status and the page it is on.
- n/a only when the app genuinely has no item detail route.

Cache results within a run so 45 items do not mean 45 duplicate requests to the
same host, and set a per-request timeout so one slow host cannot hang the gate.

## C10 — A control's result renders where the person is looking

Rule `fe-result-in-viewport`.

Measured on production: crop search sat at y=327 and its result landed at
**y=1942** in a 900px viewport. `fe-search-present` passed because the row count
narrowed. `fe-visible-response` passed because something changed. Neither asked
whether the change was on screen, so the control worked and looked dead, and the
user reported it broken twice.

Drive the live app: type a known-narrowing query into the search input, wait on
the real response, and require that **something which changed is inside the
first viewport** -- a result list, a count, or an empty state. Measure at 375 and
1280.

Fail with the measured y of the nearest changed element, so the diagnostic says
"your result is 1042px below the fold" rather than "search failed".

n/a when the app has no search or filter control (`fe-search-present` already
fails that case separately).

## Extend fe-responsive-375 to placeholders

Not a new row -- a gap in an existing one. The check compares `scrollWidth`
against `clientWidth` on elements with text, and `placeholder` is an attribute,
not `textContent`. So "Find a crop by nar" truncated at 375 through both the old
check and the new one.

For every `input`/`textarea` with a placeholder, measure the placeholder's
rendered width against the field's content box and fail when it is clipped.
Measure text width properly (canvas `measureText` with the element's computed
font, or a hidden span) rather than estimating from character count.

Keep the existing exclusions: screen-reader-only elements and deliberate scroll
containers.

## Proof required

For each of the two new rules and the extension:

1. Run against a **known-bad fixture**, real output, non-zero exit.
2. Run against a **known-good fixture**, exit 0.
3. `fe-resource-links` specifically: prove the dead-link path fires, using a URL
   that really 404s, and prove the browser-UA path does not produce a false
   failure on a host that rejects bare agents.
4. `npm run typecheck`, `npm run lint`, `npm test` at the repo root.
5. `unimplementedRows()` returning `[]`.

These rules will fail az-planting-calendar until that app is fixed. That is
correct and expected -- do not weaken a rule to make a current app pass.
