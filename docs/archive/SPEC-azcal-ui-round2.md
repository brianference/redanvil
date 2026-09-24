# Spec — search discoverability, brand-mark size, assistant default

Scope: **only** `az-planting-calendar/`. No git add/commit/push, no deploy.

Inherited rules — see `rules/base-15.md` and `rules/per-app-pack.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function.
- Use theme tokens for colour. Never hardcode a hex value in a component.
- Keep all user-facing copy in `src/i18n/en.ts`.
- No `maxWidth` in a JS style object (`fe-no-inline-width` is a blocker).
- Write `--`. Never a unicode em dash.

Every number below was measured against the deployed build, not inferred.

## 1. Search is invisible on arrival

Measured on https://az-planting-calendar.pages.dev with a 900px-tall viewport:
the `filter-search` input sits at **y=1082 at 1280px wide** and **y=2056 at
375px**. Page height is 3425 / 5037. It is below the fold on both, so a visitor
never sees that the app can be searched.

This is the failure `fe-visible-response` exists for: a control whose outcome or
existence is off-screen is indistinguishable from one that is missing.

Move crop search into the **hero**, above the fold at both widths:

- The search input must be within the first viewport at 375x900 and 1280x900 --
  target its top edge under ~600px at 375 and under ~500px at 1280.
- Keep the accessible name matching `/search|find/i` (`fe-search-present`
  requires a text input, not a `<select>`).
- Typing must still narrow the year grid, and the existing narrowing tests must
  still pass. Do not duplicate the input -- one search control, moved, not a
  second one bolted into the hero (a duplicate breaks `getByTestId` strictness
  and is a mobile-UX anti-pattern).
- Method and month filters may stay where they are.

Add an acceptance test asserting the search input **is in the viewport on
arrival** at 375x900 and 1280x900 (`toBeInViewport()`), so this cannot regress.

## 2. The brand mark is too small

`.topbar__mark` is `32px` (`src/components/Layout.css:70-76`). Increase it
**3x, to 96px**.

- Let the header grow to fit; keep it sticky and keep vertical rhythm sane.
- The mark must not overlap the app name or the nav at 375px. If 96px does not
  fit the 375 layout, scale it responsively there (for example 96px at >=768 and
  a smaller-but-still-large value at 375) rather than shrinking it everywhere --
  but it must never go back to 32.
- Re-check `fe-touch-targets`, `fe-safe-areas` and `fe-responsive-375` after: a
  taller sticky header eats viewport, and item 1 requires search above the fold.
  These two requirements pull against each other -- solve both, and if they
  genuinely cannot both hold at 375, say so with the measurements rather than
  quietly sacrificing one.

Capture the header at 375 and 1280 in both themes into `evidence/screenshots/`
and describe what you see.

## 3. The assistant opens by default on the home page

`AssistantPanel` currently opens on a click. On the **home route only**, it must
be open on arrival.

- Must not cover the primary content at 375px. If an always-open panel would
  obscure the hero on mobile, use a layout that does not overlap (for example
  inline below the hero on small screens, docked panel on large) rather than a
  modal over the content.
- The close control must still work, and a visitor who closes it should not have
  it reopen on every navigation within the session.
- `cold_visitor` must still pass: no console errors on arrival, and the primary
  flow still returns a real result for an unseeded visitor.
- Do not auto-send a request on load. Open, with its empty state -- an automatic
  model call on every page load is cost and noise.

## 4. A year-grid link in the top navigation

The full-year grid is the app's main reference view and it is reachable only by
scrolling the home page. Add it to the top nav beside Home / About / Contact.

Give it a real route (for example `/grid`) that renders the full-year grid as a
page, rather than a fragment link that scrolls the home page -- a route is
linkable, shareable and testable, and `fe-cross-link` and the sitemap can see it.
Add the route to `public/sitemap.xml` and give it its own title and meta
description like every other route.

The nav must still fit at 375px without overlapping the brand mark from item 2.
If four links plus a 96px mark cannot fit at 375, move overflow into a menu
(the rule pack allows that) rather than dropping a link.

Add an acceptance test that the nav link exists, navigates, and the grid renders
on its own route.

## 5. Switch zones by zone number, city, or ZIP

`Zone` is a declared entity (`.redanvil/claims.json`) and production D1 holds
exactly **one** row: `zone-cave-creek-85331`, Cave Creek AZ, last_frost 03-09,
first_frost 11-15. There is no way to change it.

**Read this constraint before writing any data.** Every one of the 45 crops' 83
planting windows traces to UA Cooperative Extension **az1005, which covers
Maricopa County low desert**. Re-using those windows for a mid- or
high-elevation Arizona town would render confidently wrong planting dates --
worse than shipping no feature. Real data only; no invented rows.

So:

- Add zones ONLY where you can cite a real UA Cooperative Extension (or
  equally authoritative) publication for that zone's planting windows and frost
  dates. Arizona's extension service publishes separate low / middle / high
  elevation guidance -- find the actual publications, cite them per row in the
  `sources` table exactly as az1005 is cited today, and record the retrieval
  date.
- If you can source frost dates for a town but NOT its planting windows, do not
  create a zone for it. Say so in your report and list what you could not source.
- **Open az1005 and read what it states about its own geographic coverage before
  adding a single town.** [UNVERIFIED] Treat every coverage claim in this spec and
  in any handoff document as a hypothesis until you have read the publication.
  Quote the coverage sentence into SOURCES.md with the URL and retrieval date.
  [UNVERIFIED] Restrict the town list to the coverage that publication states.
  Where it names a county, an elevation band, or a frost-date range, use that
  text to decide the list. Never guess which Phoenix suburbs count as "low
  desert". Source each town's frost dates individually; never interpolate them.
  This claim decides which planting dates a real gardener is shown, so it is the
  one thing in this spec that must not be taken on trust.

Lookup must accept all three:

- **zone id** (e.g. `zone-cave-creek-85331`)
- **city name** (case-insensitive, partial match acceptable)
- **ZIP code**

Build:

- `GET /api/zones` listing available zones; `GET /api/zones?q=` searching by
  city or ZIP. Zod-validated, parameterized D1.
- Accept a `zone` parameter on `/api/plantable`, `/api/grid` and the assistant,
  defaulting to the current zone so existing behaviour and tests hold.
- A zone selector in the UI (searchable by city or ZIP), with the chosen zone
  persisted and shown in the header context line that currently reads
  "Low desert - Cave Creek 85331".
- Every zone-dependent view must state which zone and which source it is using.
  A user must never see dates without knowing which publication they came from.
- A migration adding the new zones and their sources; apply it locally AND
  remotely, and report the row counts from a real query.

Tests: unit tests for the lookup (id / city / ZIP, and a miss), and an
acceptance test that switching zones changes what is displayed.

## 6. The missing prior-art artifacts (blocker)

`SOURCES.md`, `INTEGRATIONS.md` and `COMPETITORS.md` do not exist in the app.
`fe-prior-art` is a **blocker** and `u-integration-scan` / `u-competitor-scan`
are major rules. This was in the handoff's known-broken table and was never done.

- **SOURCES.md** -- the real data provenance: az1005, what it covers, the 45
  crops kept, the 8 dropped and why (`scripts/az1005-crops.json` already records
  each reason), plus any new zone publications from item 5.
- **INTEGRATIONS.md** -- what this app actually integrates: Cloudflare Pages
  Functions, D1, Workers AI (model id and why that one), and what was considered
  and rejected. Do not invent evaluations you did not do.
- **COMPETITORS.md** -- real competitor products for an Arizona planting
  calendar, with real scraped structure, AND a filled-in **Assessment** section
  drawing actual conclusions and a work list. `u-competitor-scan` scores the
  conclusions, not the evidence: an Assessment reading "Fill this in" has failed
  that rule before and will again.

## 7. Real imagery via Grok Imagine, and visual polish

Use your `image_gen` tool (Grok Imagine) for real raster art. Never an emoji,
never a placeholder, never a stock-looking gradient block. Visually review each
generated image before using it, and say what you saw.

Keep the existing brand mark -- it is user-approved and final. Add:

- A hero illustration or textured banner for the home page in the SAME visual
  language as the brand mark (flat desert illustration, saguaro greens, warm
  sand). It must not compete with the plantable list for attention and must not
  push the search input below the fold (item 1 wins if they conflict).
- Small method icons or illustrative accents for seed vs transplant, if they
  improve scanability over the current text chips. Only if they improve it.
- An About-page image using the full brand artwork at a large size.

Polish pass, measured not eyeballed:

- Consistent spacing scale, consistent card treatment, real visual hierarchy
  between the hero, the plantable list and the year grid.
- The 24-column year grid is the known hard problem at 375px -- it must remain
  usable and must not overflow the page (horizontal scroll INSIDE the grid
  container is fine and already works; page-level overflow is not).
- Every colour from theme tokens. Both themes still pass axe with zero
  violations -- re-run `.github/scripts/a11y_audit.mjs` against your local build
  in both themes and paste the output.

Do not regress anything in items 1-6 for the sake of appearance.

## 8. Schema gaps the plan required

From the original plan document (`docs/plan-source-taketheprdandjoyfulprism.md`,
copied into the repo as the spec of record):

- **`source_granularity` per planting window.** The plan required it explicitly:
  AZ1005's granularity (whole-month vs half-month columns) was an unresolved open
  item, and the schema was to carry per-window granularity "rather than the grid
  asserting a precision its citation may not support". Add the column, populate
  it from what the source actually supports, and surface it in the UI where a
  window is shown at half-month precision that its source only supports monthly.
- **`Zone` needs `county` and `elevation`.** The plan specified "region label,
  county, elevation, frost dates". Elevation is load-bearing here -- Cave Creek
  near 2,200 ft against Phoenix near 1,100 ft is why county-level dates run early
  locally, and the app is supposed to SAY that rather than present county dates
  as local.

Both need a migration applied locally and remotely, with real row counts from a
real query in your report.

## Definition of done

Report each with real output:

- `npm run typecheck`, `npm run lint`, `npm test`, `npx playwright test`,
  `npm run build` -- actual tails.
- The measured y-coordinate of the search input at 375x900 and 1280x900 after
  the change, proving it is above the fold.
- The measured rendered height of `.topbar__mark` at 1280 and at 375.
- Header screenshots at 375 and 1280 in both themes, described from looking.
- Confirmation the assistant is open on `/` and closable, with a screenshot at
  375 showing it does not cover the hero.

If any requirement conflicts with another, report the conflict with numbers
instead of choosing silently.
