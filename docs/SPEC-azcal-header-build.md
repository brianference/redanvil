# Spec — build the compact drawer + dock header

Scope: **only** `az-planting-calendar/`. No git add/commit/push, no deploy.

Inherited rules — see `rules/base-15.md` and `rules/per-app-pack.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function.
- Keep all user-facing copy in `src/i18n/en.ts`.
- Use theme tokens for colour. Never hardcode a hex value in a component.
- No `maxWidth` in a JS style object (`fe-no-inline-width` is a blocker).
- Write `--`. Never a unicode em dash.

The user chose **option 3, Compact drawer + dock**
(`design-refs/header-options/option-3-drawer-dock.html`). The reasoning and the
accepted trade-off are in `design-refs/header-options/DECISION.md` -- read it
first.

## 1. Build the chosen header

Nav, zone, crop search and the filter affordance collapse into one compact bar
instead of the current stack of separate bands. Filters live in an **expandable
drawer** opened from that bar. The assistant becomes a **persistent dock**
rather than a panel competing with content.

Wire it into the live app on top of the Tailwind v4 / Timeline+rail layout that
is already shipping. This replaces the current chrome; do not leave the old
bands behind as dead markup (`u-conc-dead-code` is a blocker).

## 2. Protect the hero — this is the condition of the pick

Option 3 measured the **tallest mobile header of the three at 452px**, leaving
**392px** of timeline above the fold at 375, against 502px for option 1. The
user accepted that, so the build has to spend that budget carefully:

- The filter drawer is **collapsed by default at 375**. It may be open by
  default at 1280 only if the timeline still clears the bar below.
- The header must not grow beyond the mockup's measured height. Re-measure after
  building and report the real number.
- On arrival at 375, the timeline section heading **and at least one full row of
  cells** must be visible without scrolling.
- If the timeline ends up below roughly a third of the mobile viewport, tighten
  the header rather than shrinking the hero. Report it if you cannot hold both.

## 3. Everything already measured must still hold

Re-measure each and report the number -- do not assume:

- Crop search above the fold at 375 and 1280 (mockup: y=74 at 375, y=34 at 1280)
- Brand mark >= 48px at 1280 (mockup: 96px desktop, 56px mobile)
- **0 truncated elements** at 375, placeholders included
- **24/24 half-months reachable** by scrolling at both widths, current window
  scrolled into view on load, Mar 1 still selectable
- Crop search autocomplete: combobox roles, arrow keys, Escape, the Search
  button, and Enter submitting -- all still working
- axe-core **0 violations in both themes**, with the filter drawer OPEN and with
  the suggestion list OPEN. A drawer and a popup are where new violations hide.
- **0 CSP violations, 0 console errors** -- the CSP is strict, no `unsafe-inline`
- Every interactive control >= 44px, including drawer and dock toggles
- Painted content >= 80% at 1440 and 1920

## Definition of done

Report each with real output:

- `npm run typecheck`, `npm run lint`, `npm test`, `npx playwright test`,
  `npm run build` -- real tails.
- Measured header height at 375 and 1280, and the timeline space left above the
  fold at 375, next to the mockup's 452 / 266 / 392.
- The full re-measurement list from section 3, each with its number.
- Screenshots at 375 and 1280 in both themes, described from actually looking --
  including one at 375 with the filter drawer open.
- An acceptance test that the drawer opens, closes, and is collapsed on load at
  375; and that the assistant dock is reachable and dismissible.

If holding both the header and the hero is not possible at 375, say so with the
measurements rather than quietly letting the timeline shrink.
