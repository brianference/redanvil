# Spec — fix 375px truncation, the 96px logo plate, and the check that missed both

Two parts, different directories. **Part A** is `az-planting-calendar/` only.
**Part B** is `orchestrator/` only. No git add/commit/push, no deploy.

Inherited rules — see `rules/base-15.md` and `rules/per-app-pack.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function.
- Use theme tokens for colour. Never hardcode a hex value in a component.
- Keep all user-facing copy in `src/i18n/en.ts`.
- Write `--`. Never a unicode em dash.

---

# Part A — the app

## A1. Nothing may truncate or clip at 375px

Measured on the current build at 375x900. `fe-responsive-375` passed because
nothing overflows horizontally -- these are clipped or ellipsised instead, which
the rule explicitly calls a failure: *"An ellipsis is not overflow: a truncated
label still fails."*

Genuine defects, with measured overflow in pixels:

| Element | Overflow | Text |
|---|---|---|
| `.zone-selector__label` | 63px wide, 47px tall | "Planning zone" |
| `.hero__subtitle` | 43px tall | "Arizona low desert (Maricopa County). Se…" |
| `.hero__title` | 2px tall | "What can I plant right now?" (descender clipped) |
| `.method-chip__mark` (x7) | 2px tall | "S" / "T" |

Also visible in `evidence/screenshots/v8-375-dark.png` and not in the table
above, because they are container-level rather than element-level:

- the brand mark is **clipped** at the top-left
- the app name renders as "AZ Planting Calend**…**"
- the zone selector value renders as "Cave Creek AZ (low desert, Marico"
- a dangling "7 crops **·**" separator with nothing after it

Fix by letting text **wrap** or by shortening the string in `src/i18n/en.ts`.
Do **not** fix by adding `text-overflow: ellipsis` -- that is the defect, not the
remedy. Do not shrink type below the 16px body floor.

The header is now carrying a 96px mark, the app name, a zone context line, a
zone selector, four nav links and a theme toggle. At 375 that is too much for
one row: use the overflow menu the rule pack allows, and let the zone selector
own its own row if needed.

## A2. The 96px brand mark shows a plate on dark

At 32px the calendar card behind the cactus read as detail. At 96px it reads as
a light grey box on the dark header -- see `evidence/screenshots/v8-1280-dark.png`.
The keying removed the card's flat fill but kept the grid lines and border,
which at triple size close up into a visible rectangle.

The artwork is final and must not be redrawn. Options, in order of preference:

1. Re-key so the calendar card's grid lines and outer border also go, leaving
   the cactus, seedling and sand on transparency. The mark stays the same
   illustration, minus the backdrop that only worked at small size.
2. If the grid is essential to the mark's identity at large size, keep it but
   make the header mark a **cropped** version (cactus + seedling), the same crop
   already used for the favicon, which was verified legible.

Whichever you choose, composite the result on `#0a0e12` and on `#eef1f4`, save
both to `design-refs/logos/v2/verify/`, and state whether any plate remains.

## A3. Re-verify what A1 and A2 must not break

Search stays above the fold (currently y=321 at 1280, y=246 at 375). The mark
stays >= 48px at 1280. The assistant still opens by default. `/grid` still 200s.
Zone lookup by id, city and ZIP still works. Report the measured values again.

---

# Part B — the check that certified a broken page

`fe-responsive-375` only compares scroll width against client width at the page
level, so it cannot see element-level truncation. Extend it.

For every visible element at 375, flag `scrollWidth > clientWidth + 1` or
`scrollHeight > clientHeight + 1`, and fail naming each element with its
selector, its overflow in pixels, and its text.

**Exclude these or the check becomes untrustworthy** -- verified against the
real app, where a naive version produced 12 hits of which 2 were false:

- **Screen-reader-only elements.** `.theme-toggle__sr-only` reported 105x23px of
  overflow and `.assistant__label` reported 261px. Both are the visually-hidden
  pattern, which clips deliberately. Detect it structurally: 1px width/height,
  `position: absolute` with `clip`/`clip-path`, or `overflow: hidden` combined
  with a 1px box -- not by class name, which varies per app.
- **Deliberate scroll containers**, where `overflow`/`overflow-x` is `auto` or
  `scroll`. The year grid scrolls horizontally on purpose and must stay legal.

Tune the vertical threshold with care: seven `.method-chip__mark` elements
report exactly 2px of vertical overflow, which is line-height rounding on a
single character rather than a clipped label. Decide a threshold you can defend
and write down why. A check that fires on every rounded line box will be
switched off, which is worse than not having it.

## Proof required

1. The extended check run against the **current** `az-planting-calendar` build:
   it must **FAIL** and name `.zone-selector__label` and `.hero__subtitle`.
2. The same check run after Part A: it must **PASS**.
3. The same check against an app known to be clean, to show it does not fire
   spuriously.
4. `npm run typecheck`, `npm run lint`, `npm test` in both the app and the repo
   root -- real tails.
5. Screenshots at 375 and 1280 in both themes after Part A, described from
   actually looking at them.

If the vertical threshold cannot be set without either false positives or
missing the real 43px clip, say so with the numbers instead of picking one
silently.
