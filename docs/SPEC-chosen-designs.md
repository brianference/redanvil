# Spec — build the two chosen designs

Two parts, different directories. **Part A** is `az-planting-calendar/` only.
**Part B** is `app-builder/` only. No git add/commit/push, no deploy.

Inherited rules — see `rules/base-15.md` and `rules/per-app-pack.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function.
- Keep all user-facing copy in `src/i18n/en.ts`.
- No `maxWidth` in a JS style object (`fe-no-inline-width` is a blocker).
- Write `--`. Never a unicode em dash.

The user picked both options. The picks are recorded in the two `DECISION.md`
files and `proc-design-options` passes for both apps -- read those files first;
they carry the reasoning and the carry-overs.

---

# Part A — az-planting-calendar: Timeline + rail, in Tailwind v4

Chosen: **option 3, Timeline + rail**
(`design-refs/home-options/option-3-timeline-rail.html` and its four frames).

## A1. Tailwind v4

The PRD's §13 platform line already specified Tailwind and the app shipped plain
CSS. Migrate to **Tailwind v4** (CSS-first: `@import "tailwindcss"` and
`@theme`; there is no `tailwind.config.js` in v4).

Map the existing CSS custom properties (`--bg`, `--surface`, `--surface-2`, the
type scale) into `@theme`. Keep every colour coming from a token that resolves
per theme, and re-run axe in both themes afterwards to confirm the mapping did
not change any resolved value. Never hand-write a hex value in a component.

**These currently pass and must still pass afterwards** -- re-measure each and
report the number, do not assume:

- axe-core: **0 violations in both themes**
- 0 console errors, 0 CSP violations (the CSP is strict: no `unsafe-inline` in
  `style-src`, so Tailwind must not require inline styles)
- 0 truncated elements at 375
- search above the fold: y=327 at 1280
- brand mark >= 48px at 1280 (currently 96px)
- painted content >= 80% at 1440 and 1920

## A2. The Timeline + rail layout

- A horizontal half-month timeline is the hero, showing the count of plantable
  crops per half-month, with the current half-month marked. It is a real
  control: selecting a half-month changes the list below.
- Crop rows sit under the timeline, secondary to it.
- The zone bar spans full width above search.
- The assistant is a right-hand rail on desktop and a block under the list on
  mobile -- not a floating button.
- Carry over from option 2: **larger crop imagery** in the rows. At the current
  thumbnail size several crops read as similar green shapes.

**The mockup hardcodes "Last frost Mar 9 / First frost Nov 15".** Those are the
superseded Cave Creek values. Read frost dates from D1 -- Cave Creek is Feb 20 /
Dec 6 -- and never hardcode them.

## A3. Search must be live, not a box that appears to do nothing

Measured on production: the input sits at y=327, but typing "tomato" narrows a
grid whose first row is at **y=1942**, and nothing in the first viewport
changes. The control works and looks broken, which is what `fe-visible-response`
exists to catch.

Make search render its result **next to the input, as you type**:

- Matching crops appear in the first viewport within a few hundred ms of typing,
  without pressing enter.
- A result count is stated ("3 crops match tomato").
- Zero matches renders an explicit empty state -- never an empty area, and never
  the same appearance as a failed request. The existing `searchError` state must
  stay distinct from "no matches".
- Debounce input rather than firing a request per keystroke, and cancel
  superseded requests so a slow earlier response cannot overwrite a newer one.
- The placeholder currently truncates at 375 ("Find a crop by nar"). Shorten the
  string in `en.ts` so it fits, and do not rely on ellipsis.

Add an acceptance test asserting the result count element is **in the viewport**
at 375 and 1280 after typing, using `toBeInViewport()`.

---

# Part B — app-builder: Card catalog examples page

Chosen: **option 3, Card catalog**
(`design-refs/design-options/option-3-card-catalog.html`).

Equal-weight magazine cards, filter-chip chrome, stacked device frames as the
card face, title + stat chips + actions beneath.

## B1. Each card expands into a real "What it does"

Beyond the mockup, per the user. Under the images, each app gets a grouped
capability breakdown in plain prose, closing with a "The app it shipped"
paragraph citing real gate numbers from a dated run. QuickFlight's existing
entry is the reference for tone and depth: grouped headings, each bullet a
concrete capability stated as behaviour, no marketing adjectives.

For **az-planting-calendar**, every figure must be read from the app or its
evidence, never estimated. Verified figures available today:

- 45 crops, 83 planting windows, 8 Maricopa low-desert zones (query D1).
- Every planting window cites UA Cooperative Extension az1005; the join is an
  INNER JOIN on `sources`, so a window with no citation cannot render at all.
- Zone lookup by zone id, city name, or ZIP.
- Frost dates are NOAA 1991-2020 normals as published per town; Cave Creek is
  Feb 20 / Dec 6, and elevation is carried per zone (Cave Creek 2,529 ft against
  Buckeye 1,040 ft), which is why county-level dates run early locally.
- An assistant that converts a question into filter values only and answers from
  D1 rows, never from model knowledge.
- Gate numbers, measured against the deployed build on 2026-08-02: axe-core
  4.12.1 reports **0 violations in both themes**, **0 console errors** across six
  loads, **0 truncated elements at 375**, all six security headers present, and
  the assistant rate limiter returns 429 with `Retry-After` past ten requests.
  Test counts: **99 unit and 54 acceptance** in the app.

**Re-verify each number before publishing it.** If a figure cannot be confirmed
from a real run, leave it out. A wrong number on a page whose whole point is
"this was measured" is worse than a missing one.

Do the same for the existing QuickFlight entry only if its numbers still verify;
if they do not, mark them with their original run date rather than refreshing
them with guesses.

## Definition of done

Report each with real output:

- Part A: `npm run typecheck`, `npm run lint`, `npm test`, `npx playwright test`,
  `npm run build` -- real tails.
- Part A re-measured: axe both themes, console errors, CSP violations, truncated
  elements at 375, search input y, brand mark height, painted width at 1440.
- Part A: search result count visible in the first viewport at 375 and 1280
  after typing, with the measured y.
- Part B: `npx tsc --noEmit`, `npx eslint . --max-warnings 0`, `npx vitest run`.
- Part B: the source of every number in the az-planting-calendar entry.
- Screenshots of both at 375 and 1280 in both themes, described from looking.

If Tailwind v4 cannot satisfy the strict CSP without `unsafe-inline`, stop and
report it rather than loosening the CSP.
