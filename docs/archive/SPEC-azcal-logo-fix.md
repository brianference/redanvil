# Spec — az-planting-calendar brand mark, correction pass

Scope: **only** `az-planting-calendar/`. No git add/commit/push, no deploy.
Leave the footer, the assistant and the search tests alone — they are accepted.

Inherited rules — see `rules/per-app-pack.md` and `rules/base-15.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function.
- Use theme tokens for colour. Never hardcode a hex value in a component.
- Keep all user-facing copy in `src/i18n/en.ts`.
- Write `--`. Never a unicode em dash.

## What is wrong

The previous pass invented a new flat SVG mark (`src/components/BrandMark.tsx`,
`public/mark.svg`) and put that in the header. **The logo is finalized and is not
up for redesign.** The user confirmed the artwork in
`design-refs/logos/v2/01-calendar-behind-edit.jpg` — a saguaro cactus with a
leafy seedling in desert sand in front of a calendar grid — as both the mark and
the style. That artwork must be what ships.

Five defects, each measured rather than guessed:

1. `src/components/Layout.tsx:25` renders `<BrandMark />`, the invented SVG. The
   finalized art is not in the header at all.
2. `public/brand-mark.png` is **127x128** and only **10.1% of its pixels are
   fully transparent**. The keying removed the outer white margin and left the
   calendar card's flat fill opaque, so composited on the dark surface
   (`--bg: #0a0e12`) it renders as a **pale plate** — the exact white-box failure
   the transparency was supposed to prevent. Verified by compositing it and
   looking at the result.
3. `public/favicon-32.png` is **771 bytes**. `fe-brand-mark` has a hard floor of
   `MIN_FAVICON_BYTES = 1024`
   (`orchestrator/scripts/checks/fe-brand-mark.mjs:31`), so this **fails the
   gate** as a hand-drawn stub.
4. `public/brand-full.png` has **no alpha channel** (`hasAlpha: false`), so the
   About page shows a white plate around it on the dark theme.
5. The favicon was derived from the invented SVG rather than from the finalized
   artwork.

## What to build

### 1. A transparent master that works on both themes

Re-derive `public/brand-mark.png` from
`design-refs/logos/v2/01-calendar-behind-edit.jpg`.

The naive key (drop near-white only) is what produced defect 2. Key out **both**
the outer near-white background **and the calendar card's flat light fill**,
while KEEPING:

- the calendar's grid rule lines and its outer border,
- the cactus, the seedling, and the sand.

The result is the same illustration — a cactus and seedling in front of an open
calendar grid — with nothing behind it. Mid-grey grid lines read on both the
light surface (`#eef1f4`) and the dark one (`#0a0e12`); a flat light card does
not, which is the whole reason the card fill goes.

Do not redraw the artwork. This is background removal, tuned.

Export at **at least 256px on the long edge** (the current 127px is below 2x the
32px header render and cannot be used anywhere else).

If a grid line or the sand drops below visibility on either surface, adjust that
element's tone — do not replace the illustration.

### 2. Put it in the header

In `Layout.tsx`, replace `<BrandMark />` with the finalized art
(`public/brand-mark.png`), beside the existing app-name text. Render height
28-32px. It must not change the sticky header's height. Keep the accessible name
on the home link; the mark is decorative (`aria-hidden`) while the name is
present.

Then **delete `src/components/BrandMark.tsx` and `public/mark.svg`** — the repo
forbids dead code (`u-conc-dead-code` is a blocker), and leaving an unused
alternate mark in the tree is how the wrong one gets picked up later.

### 3. Favicon, cropped from the finalized art

A plain downscale of the full mark is unreadable (verified: the grid vanishes and
the cactus becomes a smudge). Produce the favicon by **cropping the finalized
artwork to the cactus and seedling** — drop the calendar grid and the sand, which
are what turn to mush — then export:

- `public/favicon-32.png`
- `public/apple-touch-icon.png` (180px)
- `public/favicon.svg` may remain as a fallback only if it embeds the cropped
  raster; otherwise delete it and reference the PNGs.

`public/favicon-32.png` **must exceed 1024 bytes** or `fe-brand-mark` fails.
Cropping the real raster will clear that comfortably; a flat vector will not.

### 4. Full art on the About page and the OG image

- `public/brand-full.png`: re-export **with an alpha channel** so the dark theme
  does not show a white plate. Minimum 240px wide as rendered on About.
- `public/og.png` (1200x630): keep, but the OG image is composited on a solid
  brand background, so it may stay opaque.

## Proof required — artifacts, not assertions

Your report must include, for each:

1. `public/brand-mark.png`: its dimensions and its measured percentage of fully
   transparent pixels. Composite it on `#eef1f4` and on `#0a0e12`, save both to
   `design-refs/logos/v2/verify/`, and describe what you see on each — in
   particular whether any pale plate remains on the dark composite.
2. `public/favicon-32.png`: its **byte size** (must be > 1024) and a 4x
   nearest-neighbour blowup saved to the verify directory, described from
   actually looking at it. If the cactus is not identifiable, tighten the crop
   and re-render.
3. The running app's header captured at 1280 in **both** light and dark, saved to
   `evidence/screenshots/`, described. The mark must be the finalized artwork,
   with no white box behind it on dark.
4. `npm run typecheck`, `npm run lint`, `npm test`, `npx playwright test`,
   `npm run build` — the real tail of each.

A claim that something "should" look right is not proof. If a step is blocked,
say so plainly and finish the rest.
