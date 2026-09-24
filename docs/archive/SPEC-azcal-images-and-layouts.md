# Spec — crop imagery and three home-page layout options

Scope: **only** `az-planting-calendar/`. No git add/commit/push, no deploy.

Inherited rules — see `rules/base-15.md` and `rules/per-app-pack.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function.
- Use theme tokens for colour. Never hardcode a hex value in a component.
- Keep all user-facing copy in `src/i18n/en.ts`.
- Write `--`. Never a unicode em dash.

## 1. A real image for every crop

Generate a Grok Imagine (`image_gen`) illustration for **each of the 45 crops** in
D1. Query the crop list rather than typing one; a hand-typed list will drift from
the data.

Style must match the approved brand mark: flat vegetable/fruit illustration,
desert-adjacent palette, no photoreal, no 3D bevels, no text baked into the art,
transparent or single flat background.

Hard requirements:

- **Look at every image before you use it.** Say which ones you rejected and
  regenerated. An unreviewed image is not shippable.
- **Optimise.** 45 images must not wreck load performance. Target WebP, sized to
  the largest slot they render in (not larger), and state the total added
  transfer weight in KB.
- **Lazy-load anything below the fold** (`loading="lazy"`, `decoding="async"`)
  and set explicit `width`/`height` so nothing shifts layout as they arrive.
- **Fail closed on a missing image**: a crop with no art renders its existing
  text card, never a broken image icon and never an empty box.
- Filenames keyed to crop id (`public/crops/<crop-id>.webp`) so the mapping is
  data-driven, not a hardcoded switch.

Measure and report: total added KB, largest single image, Lighthouse-style
first-load transfer for `/` before and after, and confirmation that the
cold-visitor console stays clean.

## 2. Three home-page layout options — for a pick, not a decision

`docs/plan-source-taketheprdandjoyfulprism.md` (§7.3a, line 204) makes this a
**blocker**: "three structurally distinct options presented for a pick before any
of it is built". It was skipped when the app was built. Do it now.

Build **three** options, each a real rendered HTML mockup using the app's actual
tokens and the real crop imagery from item 1:

- They must be **structurally distinct**. If recolouring one produces another, it
  is one option, not two. Vary what dominates the first viewport, how the crop
  cards are arranged, and where search, the zone selector and the assistant sit.
- Each renders **dark and light**, at **375 and 1280** — four frames per option.
- The current layout may be one of the three only if you say so plainly.
- Do not break what is already measured: search above the fold at both widths,
  brand mark >= 48px at 1280, no truncation at 375, and every colour from tokens.

Assemble them into `design-refs/home-options/gallery.html`: a multi-column
comparison, one column per option, dark and light phone frames stacked per
column, with the desktop frame below. Dark page background, large images,
numbered labels. The user will likely want a MIX ("layout of 2, hero of 3"), so
design them to blend and note in each column what is separable.

Write `design-refs/home-options/DECISION.md` with a one-line statement of how the
three differ **structurally** — leave the chosen option blank; the user picks.

**Do not implement any option.** Stop after the gallery.

## Definition of done

Report each with real output:

- The crop list you queried, and the count of images generated.
- Which generated images you rejected and why, from actually viewing them.
- Total added KB and the largest single image.
- `npm run typecheck`, `npm run lint`, `npm test`, `npx playwright test`,
  `npm run build` — real tails.
- The four frames per option exist on disk, and the gallery opens.
- Re-measured: search y at 375 and 1280, brand mark height, truncated element
  count at 375 (must stay 0).

If 45 images cannot be generated in the time available, generate as many as you
can, report exactly which crops are covered and which are not, and make the
missing ones fall back cleanly. Do not fabricate coverage.
