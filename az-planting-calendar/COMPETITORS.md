# Competitors — Arizona planting calendars

Scraped / inspected structure (2026-08-02). Assessment is filled in; this is not a stub.

## 1. UA Cooperative Extension az1005 (source, not a product UI)

- **URL:** https://extension.arizona.edu/publication/vegetable-planting-calendar-maricopa-county  
  PDF: https://extension.arizona.edu/sites/default/files/2024-08/az1005-2018.pdf
- **Structure:** Static PDF. Title + author, climate/seasons prose, then a county table: crop × half-month columns (1/15), S/T/X marks, time-to-harvest column.
- **Strengths:** Authoritative for Maricopa low desert; half-month precision; free educational publication.
- **Gaps for a gardener on a phone:** PDF is hard to filter; no “plantable now”; no zone switcher; no search; no crop detail page with shareable URLs.

## 2. Old Farmer’s Almanac planting calendar / frost pages

- **URL pattern:** https://www.almanac.com/gardening/planting-calendar and frost pages such as https://www.almanac.com/gardening/frostdates/AZ/Phoenix
- **Structure:** Location-based frost table (nearest climate station, altitude, last/first frost, growing season). Separate planting calendars by crop and ZIP (national product, not AZ1005).
- **Strengths:** Familiar brand; ZIP lookup; NOAA-backed frost normals.
- **Gaps:** Planting recommendations are not the UA Maricopa table; using Almanac planting dates for low-desert AZ can invert heat-limited seasons. Frost pages are useful; planting calendar is a different dataset.

## 3. Dave’s Garden / garden.org frost dates

- **URL pattern:** https://garden.org/apps/frost-dates/…  
- **Structure:** Per-place frost probability tables at multiple temperature thresholds.
- **Strengths:** Fine-grained frost stats.
- **Gaps:** Not a vegetable planting grid; no seed vs transplant for Maricopa; not AZ Extension-cited windows.

## 4. Generic “Arizona planting calendar” blogs / nursery PDFs

- Various nursery and lifestyle blogs restate monthly lists (often whole-month, mixed elevations).
- **Structure:** Article prose or simple month lists; rarely half-month; rarely primary citations per cell.
- **Gaps:** Hard to verify against a primary publication; often mix low/mid desert without saying so.

## Assessment

### What real gardeners need that PDF/blog competitors miss

1. **Plantable now** for today’s half-month, with seed vs transplant marked.
2. **Full-year half-month grid** that survives a phone width (scroll inside the grid, not the page).
3. **Search and filters** that actually narrow the grid.
4. **Citations on every window** back to az1005 — not anonymous monthly tips.
5. **Honest zone context:** Maricopa low desert only for these windows; elevation and frost shown as planning aids, not fake microclimate models.

### How this app positions

| Need | This app | az1005 PDF | Almanac planting | Blogs |
| --- | --- | --- | --- | --- |
| Maricopa half-month S/T | Yes (transcribed) | Yes (source) | No (different data) | Rare |
| Plantable-now hero | Yes | No | Partial | Rare |
| Mobile year grid | Yes | No | No | No |
| Per-window citation | Yes | Implicit | Varies | Rare |
| Zone frost + elevation | Yes (NOAA normals) | Prose only | Yes (frost) | Rare |
| Mid/high elevation windows | No (honest) | N/A (Maricopa) | Sometimes wrong | Often wrong |

### Work list (product, not marketing filler)

1. Keep windows fail-closed: only character-verified az1005 rows (already).
2. Keep zones Maricopa-only until another Extension planting calendar is transcribed with its own source rows.
3. Surface source granularity when a coarser source appears (column + UI note shipped).
4. Do not absorb Almanac **planting** dates; frost metadata only.
5. Prior art docs (`SOURCES.md`, `INTEGRATIONS.md`, this file) stay in-repo so `fe-prior-art` can score evidence + conclusions.
