# Decision — where search lives on the dashboard home page

Three structurally distinct placements for the new run-search control were
mocked up in this directory before writing any React:

- `option-1-toolbar.html` — a dedicated toolbar row between the KPI band and
  the run list.
- `option-2-sidebar.html` — a persistent left sidebar filter panel, list
  pushed right.
- `option-3-header.html` — search embedded directly in the sticky top header
  next to the brand mark.

## Chosen: option 1 — toolbar above the list

**Why:** The home page is already a "Metric board" archetype (KPI tiles, then
a list — recorded in `.redanvil/claims.json`). A toolbar row keeps that same
top-to-bottom reading order (numbers, then the thing you filter) and adds
exactly one new row, rather than restructuring the page around a second
navigation surface.

Option 2 (sidebar) was rejected because this app already has a left-side
navigation surface — `MobileDrawer` — and a second, permanent sidebar would
either collide with it on desktop or have nowhere to go on a 375px viewport,
which is where this dashboard is used most (mobile-first, per this app's own
`CLAUDE.md`). Adding a fixed-width sidebar column also fights the KPI band's
full-width three-tile layout.

Option 3 (header-embedded) was rejected because the sticky header already
carries the brand mark and primary nav; adding a search input there crowds a
control that must stay ≥44px tall next to nav items that also need to stay
≥44px, on the same 375px-wide row this app is measured at. It reads as
"header does everything" rather than "each region has one job."

**Structural distinctness:** all three differ in layout architecture, not
just color — option 1 is a single-column toolbar-then-list stack, option 2 is
a two-column sidebar-plus-content split, option 3 moves the control into the
persistent header chrome instead of the scrolling content area. Option 1 wins
on fit with the existing Metric-board archetype and the mobile-first
constraint; the other two were real candidates, not filler.
