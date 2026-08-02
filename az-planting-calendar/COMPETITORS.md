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

### Features and controls we are missing

Compared to Almanac frost pages, garden.org frost tools, and what a full nursery app would ship, this product still lacks:

| Missing control | Competitor that has it | Plan |
| --- | --- | --- |
| Live frost probability curves by station | Dave’s Garden / garden.org | Stay on static NOAA normals per zone until we can cite station-level tables without inventing precision |
| ZIP-level national planting recommendations | Old Farmer’s Almanac | Will not import; wrong dataset for low-desert AZ heat seasons |
| Multi-elevation county switcher with different window tables | Some nursery PDFs claim it | Only add when another Extension publication is transcribed with its own source_id |
| Saved garden lists / accounts | Almanac accounts | Deliberately out of scope (public reference tool) |
| Offline PDF export of the year grid | az1005 PDF itself | Optional later; UI grid already covers half-month scan |
| Push reminders for “plant this half-month” | Generic garden apps | Not planned; no accounts, no push infrastructure |

### Components worth borrowing

- **Almanac frost table layout:** compact station meta (altitude, last/first frost) near the top — mirrored as zone frost lines in the filter drawer and topbar, not as a separate frost product.
- **az1005 half-month column headers (1 / 15):** kept as the grid’s 24-column model and timeline labels so gardeners who already know the PDF can transfer muscle memory.
- **Citation-on-row pattern from academic tools:** every plantable card and crop window carries a source link; we borrow the “never anonymous cell” discipline, not a third-party component library.
- **Mobile horizontal scroll for wide tables:** year grid scrolls inside a constrained shell so the page does not force full-page sideways pan (lesson from every PDF competitor failing on phone).

### What we deliberately will not do

- **Will not** merge Almanac or generic “Arizona planting calendar” blog months into the az1005-derived windows. That is how elevation and heat-season errors get laundered into a cited product.
- **Will not** invent mid/high-elevation planting grids without a primary Extension table for those zones.
- **Will not** add accounts, newsletters, or ad pixels; the privacy notice is built around their absence.
- **Will not** call live weather APIs for frost or plantable-now; frost fields stay static normals with clear labels so a network outage cannot invent a planting date.
- **Will not** present API bulk scrape of Extension content as an official UA product or as a rebranded commercial dataset.
