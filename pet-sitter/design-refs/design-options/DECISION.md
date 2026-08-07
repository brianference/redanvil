# Design options - Pet Sitter Finder

**Date:** 2026-08-05  
**Status:** Choice open - owner has not picked.  
**Artifacts:** `option-a.html`, `option-b.html`, `option-c.html`, `gallery.html`  
**Brand mark:** `mark-01.png` (approved coral house with dog + cat) in every option. Favicon should derive from the same mark when implementing.

## One-line per option

| Option | Architecture | Visual direction |
|--------|--------------|------------------|
| **A** | Floating multi-field search capsule, then full-bleed photo cards with faces, then sticky booking bar on detail | Warm coral on cream, soft 20px radii, Airbnb-class depth; price-on-photo badges |
| **B** | Map stage owns the canvas; results in a bottom sheet (phone) or side rail (desktop) with avatar pins | Sage trust green, soft map wash; face pins and distance-sorted rail rows |
| **C** | Date-first funnel: check-in/out + half-month calendar hero, then timeline rows with week availability bars | Honey amber + charcoal editorial type (Fraunces + Source Sans); availability strips |

## Shared requirements (all three)

- mark-01 logo only - never invent a new mark
- Real seed sitters (8 rows from `0003_rebuild.sql`): names, neighbourhoods, rates, pet types, availability, review counts
- Pet types as pills; ratings as score + stars when a review row exists (else Verified + count); availability on every card
- Light and dark via semantic tokens; 44px targets; 16px body; no RedAnvil shell (no plain white sticky header + bordered 2-col white cards)
- Home + sitter detail at 375 and 1280 in both themes

## Structural differences (not palette swaps)

| | A | B | C |
|--|---|---|---|
| What owns the fold | Search capsule + first photo cards | Map | Calendar + date range |
| Result unit | Large photo card | Compact rail row | Timeline row + week bar |
| Spatial model | Vertical page flow | Split map + sheet/rail | Calendar column + list |
| Absent in that option | No map, no calendar hero | No photo grid page, no calendar hero | No map, no photo card grid |

## Choice

**DECIDED 2026-08-05 by the owner: ship all three as switchable views of one app.**

Not a pick-one. A, B and C become three view modes over the same sitter data,
selected by a segmented control in the results header:

| View | From | What it is for |
|------|------|----------------|
| **Photos** (default) | Option A | Browsing faces and homes; search capsule over full-bleed photo cards |
| **Map** | Option B | "Who is near me" — avatar pins, bottom sheet on phone, side rail on desktop |
| **Dates** | Option C | "I need Aug 12-16" — calendar hero with availability dots, then timeline rows |

Owner note: "i like how you added photos" — real sitter faces are a kept
requirement in every view, not decoration.

### Binding for implementation -- CORRECTED 2026-08-06

The first version of this section was wrong and produced a bad build. It said
the view switch changes "presentation only", that palettes must not switch per
view, and that Fraunces must not be confined to one screen. The build followed
that faithfully and shipped ONE page shell -- one hero, one search capsule, one
pill row -- with only the results region swapping. That is not what was chosen.
Three architectures were chosen. The homogenising came from this document.

**Each view keeps its own full-page architecture and its own visual direction,
as built in `option-a.html`, `option-b.html` and `option-c.html`. Those files
are the specification. Match them.**

| View | Architecture -- what owns the fold | Visual direction |
|------|-----------------------------------|------------------|
| **Photos** | Floating multi-field search capsule, then full-bleed photo cards | Warm coral on cream, soft 20px radii, price-on-photo badges |
| **Map** | **The map owns the canvas.** Results in a bottom sheet on phone, side rail on desktop | Sage trust green, soft map wash, face pins |
| **Dates** | **The calendar owns the fold.** Check-in/out plus half-month calendar, then timeline rows | Honey amber on charcoal, Fraunces + Source Sans editorial type, availability strips |

Specifically forbidden, because it is what shipped and was rejected:

- A shared hero paragraph above every view. Map opens on the map. Dates opens on
  the calendar.
- A single search capsule reused across all three. Each view's entry control is
  part of its architecture -- B searches from the map header, C searches under
  the calendar.
- One palette everywhere. Each view carries its own, and the shift between them
  is the point, not a defect.
- Dropping Fraunces. The Dates view is editorial; that is its identity.

What stays genuinely shared: the sitter data, the filter state, the brand mark,
the header and footer chrome, and the semantic token layer that makes light and
dark work. Switching views preserves the query, the dates, the neighbourhood and
the pet-type filter, and the view is in the URL.

### Defects found in visual review -- fix as the first build step, not later

Found by opening the renders, not by reading the markup.

1. **B at 375px: the wordmark is overlapped by the search field.** The header
   paints `Sit...` because the search input sits on top of it. This is the
   "no overlapping text at 375px" blocker.
2. **C at 375px: the calendar grid overflows.** The Saturday column is clipped
   mid-cell -- the `SA` header and the `15` are cut by the viewport edge.
3. **All three: the "Ask about sitters" pill overlaps content** -- the first
   photo in A, the second sitter card in B, the footer in C. The live site has
   the same defect; the assistant affordance needs to reserve its own space.
4. **Render coverage was narrower than this file claimed.** The shared
   requirements above promised home and sitter detail at 375 and 1280 in both
   themes; what existed was 10 renders -- detail for A only, desktop in light
   only, no dark desktop at all. Implementation must produce the full matrix.

Item 4 is the reusable lesson: a requirements list in a decision doc is not
evidence that the requirement was met. Count the artifacts.
