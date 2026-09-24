# Spec — the timeline cuts off spring, and search needs autocomplete

Scope: **only** `az-planting-calendar/`. No git add/commit/push, no deploy.

Inherited rules — see `rules/base-15.md` and `rules/per-app-pack.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function.
- Keep all user-facing copy in `src/i18n/en.ts`.
- Use theme tokens for colour. Never hardcode a hex value in a component.
- Write `--`. Never a unicode em dash.

## 1. Nine of twenty-four half-months are unreachable

Measured on the new Timeline + rail build at 1280x1000:

```
cells total=24  reachable-on-screen=15  cut-off=9
unreachable: Jan 1, Jan 15, Feb 1, Feb 15, Mar 1, Mar 15, Apr 1, Apr 15, May 1
```

The timeline reports `scrollWidth === clientWidth` with `overflow-x: visible`,
so the later cells are simply painted past the edge with no way to reach them.
The hero control of a planting calendar cannot select spring.

Fix so **every one of the 24 half-months is reachable** at 375 and 1280:

- Horizontal scroll **inside the timeline container** (`overflow-x: auto`), never
  page-level overflow. The year grid already does this correctly -- follow it.
- Scroll the current half-month into view on load, so "now" is visible without
  the user hunting for it.
- Keyboard reachable: arrow keys move between cells and the focused cell scrolls
  into view. A scroll container that only responds to a mouse is not accessible.
- Show that more exists -- an edge fade, or visible partial cells. A row that
  ends flush at the container edge looks complete when it is not, which is how
  this shipped.
- The cells are the primary control, so keep them >= 44px.

Do not solve this by shrinking cells until 24 fit; at 375 that produces
unreadable 15px targets.

## 2. A stray brand mark beside the search input

At 1280 a small copy of the brand mark renders immediately left of the crop
search field (see `evidence/screenshots/tw-1280-dark.png`, around y=234). It is
not a search icon and reads as a rendering accident. Remove it, or replace it
with a real search icon that has an accessible name.

## 3. Autocomplete, a Search button, and Enter

Implement `docs/SPEC-azcal-search-autocomplete.md` in full -- typeahead over the
45 crop names from `/api/crops?q=`, the crop illustration beside each suggestion,
a proper combobox (`role="combobox"`, `aria-expanded`, `aria-controls`,
`aria-activedescendant`, `role="listbox"`/`role="option"`, arrow keys, Enter,
Escape), a real labelled Search button >= 44px, and Enter submitting through a
`<form onSubmit>` so mobile Go and IME composition work.

Both the button and Enter must reach the same result state.

## 4. Truncated assistant placeholder

The assistant input placeholder renders as "e.g. What can I plant ir" in the
rail. Shorten the string in `en.ts` so it fits its field. Placeholders are an
attribute, not text content, so no current check catches this -- which is why it
survived two truncation passes.

## Proof required

Report each with real output:

- The cell-reachability measurement re-run at 375 and 1280: **24 of 24
  reachable**, using the same method that produced the numbers above.
- Keyboard walk: Tab to the timeline, arrow to a cut-off month, confirm it
  scrolls into view and selecting it changes the list.
- Typing "tom" with suggestions open: screenshots at 375 and 1280, described
  from looking, plus the measured y of the suggestion list (must be in the first
  viewport).
- axe-core in both themes **with the suggestion list open**.
- 0 truncated elements at 375, and the placeholder measurement showing both the
  crop search and assistant placeholders fit.
- `npm run typecheck`, `npm run lint`, `npm test`, `npx playwright test`,
  `npm run build` -- real tails.
- 0 CSP violations and 0 console errors.

Acceptance tests for: every half-month reachable, suggestions appear,
ArrowDown+Enter selects, button submits, Enter submits, both reach the same
state.
