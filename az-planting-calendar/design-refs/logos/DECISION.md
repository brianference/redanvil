# Brand mark — decided

**Chosen: `v2/01-calendar-behind-edit.jpg`** — user approved.

Derived from option `01-cactus-seedling.png` (also user-chosen) with a calendar
grid added behind, per direct instruction.

## What it is
A saguaro cactus with a young leafy seedling sprouting beside it, rooted in
desert sand, against a simple calendar grid backdrop.

## Verified by opening the image
- **Full size: good.** The cactus and seedling read clearly in front of the grid;
  the sand base grounds it. Flat shading, no glossy 3D bevels.
- **32px: FAILS.** Opened `v2/01-calendar-behind-edit-32.png`. The calendar grid
  disappears into a pale empty square and the cactus becomes a green smudge.

## Consequence — do not skip this
The favicon must be a SEPARATE simplified mark, not a downscale of this file:
cactus silhouette only, no grid, high contrast, one or two colours. Deriving the
favicon by resizing this image will ship an unreadable icon.

## Shipped assets
- [x] simplified favicon: `public/favicon.svg` (cactus silhouette only, green on
      dark; verified by opening `v2/verify/favicon-32.png` and
      `v2/verify/favicon-32-4x.png` — cactus arms read at 32px, no pale grid square)
- [x] transparent header mark: `public/brand-mark.png` (outer light plate keyed
      out; calendar panel is part of the approved artwork)
- [x] OG image: `public/og.png` (1200×630 from full-size mark + title)
- [x] wired into shell: Layout uses `<img src="/brand-mark.png">`, not the
      literal text `AZ`
