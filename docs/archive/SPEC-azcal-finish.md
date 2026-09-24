# Spec — finish az-planting-calendar (4 items)

Scope: **only** `az-planting-calendar/`. Do not touch `orchestrator/`, `rules/`,
`prompts/`, `docs/`, `dashboard/`, `app-builder/` — another agent owns those
right now. Do not run `git add`, `git commit`, `git push`, or any deploy.

Inherited rules — see `rules/per-app-pack.md` and `rules/base-15.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function.
- Validate every boundary input with Zod.
- Parameterize every D1 query. Never build SQL by concatenation.
- Use theme tokens for colour. Never hardcode a hex value.
- Keep all user-facing copy in `src/i18n/en.ts`.
- Never reference `process` or `Buffer` in `functions/` or `src/`.
- Write `--`. Never a unicode em dash.

---

## 1. Brand mark — wire the finalized art, working on both themes

Today `src/components/Layout.tsx:22-24` renders the literal text `AZ` in a
`<span>`. That is the defect.

**The logo is FINALIZED and is not up for redesign.** The user confirmed
`design-refs/logos/v2/01-calendar-behind-edit.jpg` — a saguaro cactus with a
leafy seedling in desert sand in front of a pale calendar grid — as the mark and
the style. Do not author a different mark, do not substitute a simplified
silhouette of your own invention, and do not fall back to text or an emoji. Ship
this artwork.

Facts established by opening the images — do not re-litigate them:

- Full size it reads well.
- It has a **near-white background baked into the pixels**. Dropped into the
  header as-is it renders as a white box on the dark theme.
- `design-refs/logos/v2/01-calendar-behind-edit-32.png` is **unreadable**: the
  grid vanishes and the cactus becomes a green smudge. A plain downscale is ruled
  out as the favicon.

Build:

1. **Transparent master.** Remove the baked near-white plate from the artwork and
   export `public/brand-mark.png` with a real alpha channel, trimmed to the art's
   bounding box, at 2x the largest render size. Keep the artwork itself
   untouched — this is background removal, not a redraw. Verify the alpha is real
   (a transparent-background check, not a white-background assumption).
2. **Both themes.** The remaining ink must read on the dark surface as well as
   the light one: the greens and the tan sand are fine, and the pale grey
   calendar grid must stay visible rather than disappearing into a light page or
   vanishing on a dark one. If any element drops below visibility on either
   theme, adjust that element's tone — do not redraw the mark.
3. **Header lockup.** In `Layout.tsx`, replace the `AZ` span with the mark beside
   the existing app-name text. Keep an accessible name on the home link; the mark
   is decorative (`aria-hidden`) while the name text is present. Render height
   28-32px, and it must not change the sticky header's height.
4. **Favicon, same artwork, legible at 32px.** A straight downscale fails, so
   produce the favicon by **cropping to the cactus and seedling** from this same
   art (drop the calendar grid and the sand, which are what turn to mush) and
   export `public/favicon-32.png`, `public/favicon.svg`, and
   `public/apple-touch-icon.png` (180px). Same illustration, tighter crop — not a
   different drawing.
5. **Full art where it is large.** Show the full mark on the About page at a
   minimum of 240px wide, and derive `public/og.png` (1200x630) from it with the
   app name. Replace the `public/og.svg` reference in the head with the real PNG.

**Proof required, in your report:**

- The 32px favicon rendered to a real PNG, described from actually looking at
  it. If the cactus is not identifiable, tighten the crop and re-render.
- The header captured at 1280 in **both** light and dark, with the mark visible
  and no white plate behind it on dark.

A claim that either "should" look right is not proof.

## 2. Footer — real multi-column

`Layout.tsx:56-66` is one row of four links plus one line. The rule pack requires
a "professional, organized footer (multi-column)".

Build a footer with at least three labelled column groups, each with a heading:

- **The calendar** — Home, the year grid, current plantable list.
- **About** — About, Contact, and the data sources (link to the az1005 source
  used by the crop rows; the citation already exists in the `sources` table and
  on the crop detail page — reuse it, do not invent a URL).
- **Legal** — Terms, Privacy.

Plus a bottom bar with the existing rights line. Stack to one column at 375px
with no overlap. All strings go through `src/i18n/en.ts`. Columns must use a CSS
grid in `Layout.css` with no `maxWidth` in a JS style object (`fe-no-inline-width`
is a blocker).

## 3. `/api/assistant` — grounded in this app's own D1

Does not exist. Create `functions/api/assistant.ts`.

Read `C:\Users\brian\RedAnvil-apps\quickflight\functions\api\assistant.ts` first
— it is the working reference and it encodes two hard-won facts:

- The model id is `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. An older
  `llama-3.1-8b-instruct` was deprecated and every call 502'd for two months.
- Workers AI returns text in **either** `{ response }` **or**
  `{ choices: [{ message: { content } }] }`. Read both, or a successful call
  reads as empty.

Shape for this app:

- `POST /api/assistant`, body `{ message: string }` (Zod, trimmed, 1..500).
- Guard `env.AI` missing -> 503 with a real reason.
- The model's job is to turn a gardening question into **filter values only**,
  returned as one JSON object: `{ half_month?: 0..23, method?: 'S'|'T',
  crop?: string }`. Never let it write prose answers about horticulture and never
  let its output reach SQL as text.
- Zod-validate the model output. Invalid -> 422.
- **Ground the answer**: use the validated filters to query D1 through the
  existing helpers in `functions/lib/db.ts` (`getWindowsForHalf`, `listCrops`) —
  add a helper only if none fits. Return
  `{ answer: string, crops: [...], filters: {...} }` where `answer` is built by
  your own code from the real rows (e.g. "12 crops can go in during the first
  half of August"), not by the model.
- A model failure returns a 502 naming the model id. Never an empty 200.
- Add `AI` to the env type in `functions/lib/env.ts` and the `[ai]` binding to
  `wrangler.toml`.
- CORS preflight via the existing `optionsResponse` helper.

UI: an assistant affordance reachable from the shell (a panel or sheet opened
from the header), with a text input, a loading state, an error state that shows
the real message, and a result that renders the returned crops. Empty/failed
states must not render as a clean success.

Tests: unit tests for the text-extraction and answer-building helpers (both
Workers AI response shapes, and the empty case), plus an acceptance test that
opens the assistant, submits a question, and asserts a visible response.

## 4. Search — prove it narrows, end to end

The server filter (`functions/api/crops.ts` -> `listCrops` with
`LIKE ? ESCAPE '\'`) and the UI input (`Filters.tsx`, `data-testid="filter-search"`)
both already exist. Two acceptance tests exist at
`tests/acceptance.spec.ts:181` and `:197`. Nobody has run them.

Do:

1. Run the acceptance suite and read the real output. Fix whatever actually
   fails.
2. Make the two search tests prove **narrowing**, not rendering:
   - the API test asserts `count(q=tomato) < count(no q)` **and** `> 0`, and that
     every returned name matches `/tomato/i`;
   - the UI test counts grid rows before and after typing, asserts the count
     strictly decreases and is non-zero, and waits on the real response
     (`page.waitForResponse` on the `/api/crops` or `/api/grid` call), never a
     fixed `waitForTimeout`.
3. Prove the tests are not vacuous: **in a temporary copy of the handler, never
   in the working tree**, make `listCrops` ignore `q`, confirm both tests fail,
   then discard the copy. Report the failure output.

---

## Definition of done for this spec

Every one of these is a measured artifact, not a claim. Report each with the
actual output:

- `npm run typecheck` exits 0 (paste the tail).
- `npm run lint` exits 0.
- `npm test` — paste the summary line.
- `npx playwright test` — paste the summary line.
- `npm run build` exits 0.
- The 32px favicon render, described from actually looking at it.
- The vacuous-test proof from item 4, with the failing output.

Do not report an item done without its artifact. If something is blocked, say so
and finish the rest.
