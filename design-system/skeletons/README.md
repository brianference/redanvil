# Skeleton library — reusable layout architectures

Every new app generates **at minimum these six**, plus at least one further
variation chosen for that app's domain. Kept at the owner's instruction: "save
these layout options including split and all of them for other future apps at
minimum create these 6 always plus others but with variation".

The point is that "make it different" produces variations of whatever the agent
built first. A named set stops that convergence — you pick from a list rather
than asking for variety and hoping.

| # | skeleton | what owns the fold | result unit | wins when |
|---|----------|--------------------|-------------|-----------|
| 1 | **Photo grid** | dense square tile grid | tile, name on image | the thing is visual and browsing is the job |
| 2 | **Map canvas** | full-bleed map | pin + bottom-sheet row | proximity is the primary filter |
| 3 | **Timeline board** | time columns with counts | availability row | *when* matters more than *what* |
| 4 | **Editorial stack** | full-bleed hero | magazine card, generous air | trust and story carry the decision |
| 5 | **Utility list** | dense rows, 40px thumbs | compact row, segmented control | scanning many, comparing fast |
| 6 | **Split rail** | list left, persistent detail right | rail row + detail pane | desktop-first comparison work |

Further skeletons worth reaching for, per R41: **wizard funnel** (complex input,
one answer) and **board/kanban** (state progression is the mental model).

## They combine

sushi-finder shipped **editorial stack on top of photo grid** as a single view.
The six are architectures, not mutually exclusive products — stacking a hero
skeleton above a browse skeleton is a legitimate and often better answer than
either alone.

## Rules that travel with them

- Each variation is a **complete screen with real content**, never a swatch or a
  wireframe. The owner is deciding what the product looks like.
- **Light AND dark for every one.** A direction judged in one theme is half-judged.
- Each pairs its skeleton with its own **palette and type voice**; a colour set on
  a shared skeleton is a recolour and reads as one design (R40).
- **Same real data across all variations** so the comparison is honest.
- State the **closest pair** and why they are separable. If two read the same,
  say which.

## Known defects in these reference files

Recorded rather than hidden, because they will be inherited by anything copied
from here:

- `var-02` renders an **empty black map** — a placeholder, not a map. Any app
  using this skeleton must supply a real map layer.
- `var-06` **does not work at 375px**: a split rail needs two columns and reads
  cramped on a phone. It is a desktop-first skeleton and should collapse to a
  list on mobile.
- Chip rows **clip labels** ("Cou", "Walk-i"). They are horizontal scrollers with
  a fade, which is a permitted pattern, but the affordance is too subtle and
  reads as broken text.
- `var-01` declares "filled chips" and paints **bare text**. Whatever a treatment
  line claims, it must actually render.

`reference-build.mjs` generates all six; run it to regenerate the set.
