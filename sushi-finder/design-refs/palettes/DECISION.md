# Palette decision — sushi-finder

Status: **OPEN** — no winner selected. Owner picks.

Colour is its own choice axis. Layout and logo decisions do not inherit a palette.
All five directions ship complete tokens (bg, surface, text, muted, border, primary,
primary-contrast, success) plus a display face and a body face, shown on the **same**
Photos-grid screen in **light** and **dark**.

## Candidates

| # | File | Name | Role | Temperature | Contrast strategy | Type voice |
|---|------|------|------|-------------|-------------------|------------|
| 1 | `palette-01.html` | Night Counter | Dark-first | Cool charcoal + warm coral actions | High lacquer contrast | Syne + DM Sans |
| 2 | `palette-02.html` | Ink Line | Near-monochrome + single accent | Neutral greys only; vermillion accent | Hard ink-on-paper | Inter + Inter |
| 3 | `palette-03.html` | Omakase Paper | Warm editorial serif | Cream paper, brick primary | Soft magazine (no pure black/white) | Fraunces + Source Serif 4 |
| 4 | `palette-04.html` | Harbor Mist | Cool low-chroma | Slate teal, mist greys | Low-chroma value hierarchy | IBM Plex Sans + IBM Plex Sans |
| 5 | `palette-05.html` | Mon Crest | Strongest idea | Cool indigo + warm koi coral | Ceremonial indigo fields, coral signal | Cormorant Garamond + Manrope |

## Explicit naming

**palette-05** is **Mon Crest** (indigo ink + coral primary, dual-temperature brand system
aligned with the mon-crest logo direction). It is listed as a candidate only — not chosen,
not shortlisted by default. Dark tokens: bg `#0c0b1a`, surface `#16142a`, text `#eeeef8`,
muted `#a8a4c4`, border `#2e2a4a`, primary `#ff6b75`, primary-contrast `#0c0b1a`,
success `#2dd4bf`.

## WCAG AA (axe-core, measured — not hand-computed)

Tool: **axe-core** 4.x via Chromium (Playwright). Script: `measure-a11y.mjs`.
Evidence: `axe-results.json`.

Each file was opened with **both light and dark phones** on the page (same Photos grid).
axe-core ran against the full document with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.

| File | Violations | color-contrast rule | Pass rules |
|------|------------|---------------------|------------|
| palette-01.html | **0** | pass | 29 |
| palette-02.html | **0** | pass | 29 |
| palette-03.html | **0** | pass | 29 |
| palette-04.html | **0** | pass | 29 |
| palette-05.html | **0** | pass | 29 |

**All five directions pass WCAG AA in both light and dark themes** under axe-core.
Measured at: see `measuredAt` in `axe-results.json`.

## How to pick

Open `gallery.html` — one column per direction, light + dark phones of the same screen.
Compare temperature, contrast strategy, and type voice (not “which coral is nicer”).
Name the winning file (e.g. `palette-0N.html`) when ready. Mixing is allowed
(e.g. tokens from 05, type from 03) — record the mix in a later CHOSEN note.

## Choice

**Left open for the product owner.**
