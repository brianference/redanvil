# Spec — crop search: autocomplete, a submit button, and Enter

Scope: **only** `az-planting-calendar/`. No git add/commit/push, no deploy.

Inherited rules — see `rules/base-15.md` and `rules/per-app-pack.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function.
- Keep all user-facing copy in `src/i18n/en.ts`.
- Validate every boundary input with Zod.
- Write `--`. Never a unicode em dash.

Builds on the live-search work in `docs/SPEC-chosen-designs.md` §A3. That covered
results beside the input. This adds what the user asked for after using it.

## The report

"The search crops doesn't appear to work and has no autocomplete. Also add the
search button but enter submits it too."

The first half is measured and real: the input is at y=327, the narrowed result
lands at y=1942, and nothing in the first viewport changes as you type. From the
user's seat the control is dead. §A3 addresses that. The rest is new.

## 1. Autocomplete on crop search

A typeahead over the 45 crop names, from the app's own data -- never a
hardcoded list.

- Suggestions appear as the user types, from `/api/crops?q=`, debounced.
- Match on any part of the name, case-insensitively, so "pea" finds both
  "Blackeyed Peas" and "Peas, Snow".
- Show the crop's illustration beside each suggestion; the art already exists at
  `public/crops/<crop-id>.webp` and it is what makes a list of names scannable.
- Choosing a suggestion goes straight to that crop's detail page.
- Cap the visible list (8 or so) and say when more matched than are shown.

**Accessibility is the part that is usually wrong.** Implement the combobox
pattern properly, because a div that looks like a dropdown is unusable by
keyboard and invisible to a screen reader:

- `role="combobox"` on the input with `aria-expanded`, `aria-controls`, and
  `aria-autocomplete="list"`.
- `role="listbox"` on the popup, `role="option"` on each row.
- `aria-activedescendant` tracking the highlighted option.
- Arrow keys move the highlight, Enter selects the highlighted option, Escape
  closes and returns focus to the input.
- axe must still report **0 violations in both themes** afterwards -- run it.

## 2. A Search button, with Enter still submitting

- A visible, labelled Search button beside the input. Real button, >= 44px
  touch target, not an icon with no accessible name.
- Enter submits too. When a suggestion is highlighted, Enter picks that
  suggestion; otherwise Enter runs the search.
- Both paths must reach the same result state -- a button that behaves
  differently from Enter is worse than having only one of them.
- Wrap the input and button in a `<form>` with `onSubmit`, so Enter works for
  free rather than through a keydown handler that misses IME and mobile Go.

## 3. Do not regress §A3

Results still appear beside the input in the first viewport, with a stated
count, an empty state distinct from the error state, debounced input, and
superseded requests cancelled.

## Proof required

Report each with real output:

- Typing "tom" with the suggestion list open: a screenshot at 1280 and at 375,
  described from looking at it.
- The measured y of the suggestion list at both widths -- it must be in the
  first viewport.
- Keyboard walk-through: Tab to the input, type, ArrowDown, Enter -- lands on the
  crop detail page. State what happened at each step.
- axe-core in both themes with the list OPEN, not just closed. A popup is where
  combobox violations live.
- An acceptance test for: suggestions appear, ArrowDown+Enter selects, the
  button submits, Enter submits, and both reach the same state.
- `npm run typecheck`, `npm run lint`, `npm test`, `npx playwright test`,
  `npm run build` -- real tails.
- 0 truncated elements at 375, still.

If the combobox cannot be made axe-clean, say which rule fails and why rather
than shipping an inaccessible dropdown.
