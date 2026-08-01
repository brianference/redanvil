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

## Still to do
- [ ] simplified favicon variant, verified by opening the 32px render
- [ ] transparent background version for the header (current has a light plate)
- [ ] OG image derived from the full-size mark
- [ ] wire into the shell, replacing the literal text `AZ` in Layout.tsx
