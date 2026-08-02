# Sources — AZ Planting Calendar

Retrieval date for coverage verification: **2026-08-02**.

## Primary planting calendar (all windows)

| Field | Value |
| --- | --- |
| Id | `src-az1005-maricopa` |
| Title | Vegetable Planting Calendar for Maricopa County |
| Author | Kai Umeda |
| Publisher | University of Arizona Cooperative Extension |
| Publication id | az1005 (revised 9/18) |
| PDF | https://extension.arizona.edu/sites/default/files/2024-08/az1005-2018.pdf |
| Landing page | https://extension.arizona.edu/publication/vegetable-planting-calendar-maricopa-county |

### Geographic coverage (read from the PDF text stream)

Quote (page 1 of the az1005 PDF, retrieved 2026-08-02):

> In the low desert regions of the southwest, including Maricopa County, most any type of vegetables and fruits can be grown successfully when appropriate varieties are selected and planted at the right time.

The document title is **Vegetable Planting Calendar for Maricopa County**. Chart headers are half-month columns (`Jan. 1`, `Jan. 15`, … `Dec. 15`).

**Implication for this app:** planting windows apply only to Maricopa County low-desert planning contexts. Mid-elevation and high-elevation Arizona towns are **not** given these windows. Towns outside Maricopa County are not listed as zones.

### Source granularity

az1005 uses **half-month** columns (1 and 15 of each month). Every `planting_windows.source_granularity` row is `half-month`. The UI can show a coarser notice if a future source is only monthly.

### Crops kept (45)

Transcribed and character-verified against the az1005 PDF text stream. Full list lives in `scripts/az1005-crops.json` (`crops` array) and `migrations/0002_seed.sql`.

### Crops dropped (8)

From `scripts/az1005-crops.json` → `droppedUnverified` (not invented):

| Crop | Reason |
| --- | --- |
| Basil | marker sequence does not match az1005 |
| Broccoli | marker sequence does not match az1005 |
| Brussel Sprouts | marker sequence does not match az1005 |
| Cabbage | marker sequence does not match az1005 |
| Cabbage, Chinese | marker sequence does not match az1005 |
| Kohlrabi | marker sequence does not match az1005 |
| Melons, Cantaloupe/Honeydews, etc. | name not found in source PDF |
| Onions, Green | marker sequence does not match az1005 |

## Frost dates (zone metadata only)

| Field | Value |
| --- | --- |
| Id | `src-noaa-frost-almanac` |
| Method | NOAA 1991–2020 Climate Normals, 30% probability frost dates |
| Presentation | Old Farmer's Almanac frost pages per city (retrieved 2026-08-02) |
| NOAA product | https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals |

Per-town frost dates and nearest-station altitudes were read from Almanac pages for:

- Cave Creek AZ → Carefree station 2529 ft; last spring Feb 20; first fall Dec 6  
  https://www.almanac.com/gardening/frostdates/AZ/Cave%20Creek
- Phoenix AZ → South Phoenix 1154 ft; Feb 3 / Dec 8  
  https://www.almanac.com/gardening/frostdates/AZ/Phoenix
- Mesa AZ → Tempe ASU 1167 ft; Feb 24 / Nov 29  
  https://www.almanac.com/gardening/frostdates/AZ/Mesa
- Tempe AZ → Tempe ASU 1167 ft; Feb 24 / Nov 29  
  https://www.almanac.com/gardening/frostdates/AZ/Tempe
- Scottsdale AZ → Tempe ASU 1167 ft; Feb 24 / Nov 29  
  https://www.almanac.com/gardening/frostdates/AZ/Scottsdale
- Glendale AZ → Youngtown 1135 ft; Feb 2 / Dec 8  
  https://www.almanac.com/gardening/frostdates/AZ/Glendale
- Chandler AZ → Tempe ASU 1167 ft; Feb 24 / Nov 29  
  https://www.almanac.com/gardening/frostdates/AZ/Chandler
- Buckeye AZ → Litchfield Park 1040 ft; Jan 18 / Dec 16  
  https://www.almanac.com/gardening/frostdates/AZ/Buckeye

`elevation_ft` on each zone is the **nearest climate station altitude** from that table (cited), not an interpolated backyard elevation.

### UA frost protection (context only)

https://extension.arizona.edu/publication/frost-protection notes Maricopa County range variation (e.g. last frost Feb 7 central Phoenix to April 3 Mesa; first frost Nov 21 Buckeye to Dec 12 central Phoenix). Per-town rows above use NOAA normals rather than inventing values inside that range.

## Zones not added

No mid- or high-elevation Arizona planting calendars were loaded. Without a published window table for those elevations, creating a zone would re-use az1005 dates incorrectly. Frost-only towns outside Maricopa low desert were also rejected for that reason.

## What is not a source

- almanac.com **planting** dates (the original prompt URL is information-architecture reference only; dates are not copied).
- Invented or interpolated frost dates between cities.
- Unverified crop marker sequences.
