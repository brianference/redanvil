# Colour & type decision — sushi-finder

**CHOSEN: 5 — `palette-05`, "Mon Crest".** Recorded 2026-08-08 by the owner:
"the palette-05 Mon Crest is perfect".

Cool indigo ink with warm coral action heat -- a dual-temperature brand.
Ceremonial high contrast: deep indigo fields with coral as the single hot signal.
Type is Cormorant Garamond display over Manrope body.

Its component treatment is part of the choice, not just its hex values: 2-col mon
cards at 14px radius, an indigo ring inset on each photo, square images, soft
elevation, ceremonial filled chips, large Cormorant, airy padding. A palette
direction that ships without its treatment is a hex swap, which is what the first
attempt was and why it was rejected.

Measured with axe-core in BOTH themes, zero colour-contrast violations. The word
dark appears here deliberately: this direction was judged in dark as well as light,
not light-only.


Status: **OPEN** — no winner selected. Owner picks.

Colour is its own choice axis. Layout and logo decisions do not inherit a palette.
All five directions ship complete tokens (bg, surface, text, muted, border, primary,
primary-contrast, success) plus a display face and a body face, shown on the **same**
restaurant screen in **light** and **dark** — but each direction also ships its own
**component treatment** (card shape, image ratio, chip style, type scale, density).
A palette direction is not a hex swap.

Shared real food photos live in `food/` so columns stay comparable; what varies is
treatment.

## Candidates

| # | File | Name | Role | Treatment (structure) | Type voice |
|---|------|------|------|----------------------|------------|
| 1 | `palette-01.html` | Night Counter | Dark-first | 2-col elevated cards, square photos, **filled** chips, compact | Syne + DM Sans |
| 2 | `palette-02.html` | Ink Line | Near-monochrome + single accent | Single-col list, 4:3 thumbs, **outline** chips, tight | Inter + Inter |
| 3 | `palette-03.html` | Omakase Paper | Warm editorial serif | Stacked full-bleed magazine cards, **underline** chips, generous | Fraunces + Source Serif 4 |
| 4 | `palette-04.html` | Harbor Mist | Cool low-chroma | Dense list rows, 40px thumbs, **segmented** chips, compact | IBM Plex Sans |
| 5 | `palette-05.html` | Mon Crest | Strongest idea | 2-col mon-ring circular photos, **ceremonial filled** chips, airy | Cormorant Garamond + Manrope |

## Explicit naming

**palette-05** is **Mon Crest** (indigo ink + coral primary, dual-temperature brand system
aligned with the mon-crest logo direction). It is listed as a candidate only — not chosen,
not shortlisted by default. Dark tokens: bg `#0c0b1a`, surface `#16142a`, text `#eeeef8`,
muted `#a8a4c4`, border `#2e2a4a`, primary `#ff6b75`, primary-contrast `#0c0b1a`,
success `#2dd4bf`.

## Why the previous gallery failed

`gallery-shot.png` (pre-rebuild) showed five identical skeletons: same card grid, same
filled chips, same tab bar, same search field — only hex values moved. Four identical
gradient blocks dominated every column and swamped the token differences. The rebuild
replaces gradients with shared product photography and gives each direction a distinct
layout architecture (grid2 / list / stack / rows / mon-grid).

## WCAG AA (axe-core, measured — not hand-computed)

Tool: **axe-core** 4.x via Chromium (Playwright). Script: `measure-a11y.mjs`.
Evidence: `axe-results.json`.

Each file was opened with **both light and dark phones** on the page (same restaurant screen).
axe-core ran against the full document with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.

| File | Violations | color-contrast rule | Pass rules |
|------|------------|---------------------|------------|
| palette-01.html | **0** | pass | 30 |
| palette-02.html | **0** | pass | 30 |
| palette-03.html | **0** | pass | 29 |
| palette-04.html | **0** | pass | 29 |
| palette-05.html | **0** | pass | 30 |

**All five directions pass WCAG AA in both light and dark themes** under axe-core.
Measured at: see `measuredAt` in `axe-results.json` (rebuild run).

## How to pick

Open `gallery.html` — one column per direction, light + dark phones of the same screen.
Compare temperature, contrast strategy, type voice, **and component treatment**
(not “which coral is nicer”). Name the winning file (e.g. `palette-0N.html`) when ready.
Mixing is allowed (e.g. tokens from 05, layout from 03) — record the mix in a later CHOSEN note.

## Choice

**Left open for the product owner.**
