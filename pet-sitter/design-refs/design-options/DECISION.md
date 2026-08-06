# Design decision — Pet Sitter Finder

**Date:** 2026-08-06  
**App:** Pet Sitter Finder (`pet-sitter`)  
**Artifacts:** `option-a.html`, `option-b.html`, `option-c.html`, `gallery.html`

## Chosen option

**Option A — Card grid marketplace with top search bar**, with two ideas pulled from C:

1. Surface **booking date range** early (check-in / check-out chips or a compact range control under the sticky search), because the core job ends in a booking request for specific dates.
2. Keep a path to a **calendar / half-month availability view** (PRD F3) as a secondary mode on the sitters surface, not as the home architecture.

Option B’s map remains a **secondary view** (link or toggle from the results footer), not the default home layout for MVP.

## Why A wins for this product

- The primary actor is a pet owner who **searches and constrains a catalogue** (neighbourhood, reviews, rate, pet types, availability). A sticky search + filter chip row + scannable cards matches that job without requiring a maps SDK on day one.
- Cards make the fields owners compare legible in one glance: neighbourhood, verified badge, pet types, per-night rate, short availability line. That is the marketplace scan pattern Rover and Care.com train users on.
- MVP scope includes text search that must **narrow result counts**, filters that restore the full set when cleared, and sitter detail from a list/grid row. Option A implements that path with the fewest moving parts.
- Cloudflare Pages + D1 + no payment rails: A ships the job without geo tiles, clustering, or a real map provider. B would either fake a permanent map panel or force an integration we are not building in MVP.
- PRD §7.3a’s “command canvas” hypothesis still fits A: the sticky search slab is the command bar; the card grid is the full-bleed work surface; contextual CTAs (request booking) sit at the bottom when relevant.

## Structural differences (not palette swaps)

These are different architectures. Recoloring one does not produce another.

| | Option A | Option B | Option C |
|--|----------|----------|----------|
| **Primary surface** | Full-width sitter **card grid** | **Map stage** with pins | **Calendar / date hero** |
| **Search placement** | Sticky slab under nav with chip filters | Compact bar **over the map** | **Below** the calendar after dates |
| **Result unit** | Photo rail + body **card** | Compact **rail row** by distance | **Timeline row** with week bars |
| **Spatial model** | Vertical page flow | Split canvas + bottom sheet rail | Date-first funnel, list secondary |
| **What owns the fold** | Search + first cards | Map | Check-in/out + half-month grid |
| **Absent in that option** | No map, no calendar hero | No card grid page, no calendar hero | No map, no photo card grid |

## What we deliberately did not choose

- **Option B as default:** Neighbourhood is a filter and a field, not a live map product. A mock map panel would either mislead users or pull in map tiles, geocoding, and pin clustering before search and booking request work. Map can return after MVP as an alternate results mode.
- **Option C as default home:** Calendar-first is right for airline or house-sit inventory where the date is the only entry key. Here owners often start with place + pet type + rate, then confirm dates. C still informs F3 (sitters grid / half-month window) and the date chips under A’s search.

## Implementation contract

Build the home / sitters browse surface to match **Option A**’s structure:

- Sticky top nav with brand mark and primary links.
- Sticky search control whose accessible name matches `/search|find/i`, with active filter chips.
- Result cards showing verified state, neighbourhood, pet types, rate, short availability.
- Primary CTA path: open sitter detail → request booking for dates.
- Light and dark themes from semantic tokens; brutal-utility edges (strong borders, hard offset shadows, heavy type) as visual direction, not a second layout.
- Secondary: date range control; optional calendar mode; optional map mode later.

Mockups in this folder are the layout contract. Do not re-center a generic column shell and call it done.

## Brand mark

Logo PNG generation is owned by a separate role. Expected production path: `public/brand-mark.png`. See `design-refs/BRAND-NOTE.md`.
