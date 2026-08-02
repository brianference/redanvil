-- Additional Maricopa County low-desert planning zones.
-- Planting windows: UA Cooperative Extension az1005 (Maricopa County) — same for all rows.
-- Coverage quote (az1005, Kai Umeda, rev 9/18, retrieved 2026-08-02 from PDF text stream):
--   "In the low desert regions of the southwest, including Maricopa County, most any type
--    of vegetables and fruits can be grown successfully when appropriate varieties are
--    selected and planted at the right time."
-- Title of publication: "Vegetable Planting Calendar for Maricopa County".
-- Towns listed here are inside Maricopa County only. Mid/high-elevation Arizona towns
-- are NOT added (no sourced planting-window publication for those elevations in this app).
--
-- Frost dates + station altitude: Old Farmer's Almanac frost pages for each city, which
-- cite NOAA 1991-2020 Climate Normals at 30% probability (retrieved 2026-08-02).
-- Elevation stored is the nearest climate station altitude from that table (cited), not
-- an interpolated backyard elevation.

INSERT OR REPLACE INTO sources (id, title, author, publisher, url, retrieved_at) VALUES (
  'src-noaa-frost-almanac',
  'Average first and last frost dates (NOAA 1991-2020 Climate Normals, 30% probability) via Old Farmer''s Almanac frost date pages',
  'National Oceanic and Atmospheric Administration (NOAA) Climate Normals; presented by Old Farmer''s Almanac',
  'NOAA / Old Farmer''s Almanac',
  'https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals',
  '2026-08-02'
);

-- Cave Creek already exists; ensure county/elevation/frost match migration 0003.
INSERT OR REPLACE INTO zones (id, name, zip, last_frost, first_frost, county, elevation_ft) VALUES (
  'zone-cave-creek-85331',
  'Cave Creek AZ (low desert, Maricopa County)',
  '85331',
  '02-20',
  '12-06',
  'Maricopa',
  2529
);

INSERT OR REPLACE INTO zones (id, name, zip, last_frost, first_frost, county, elevation_ft) VALUES (
  'zone-phoenix-85004',
  'Phoenix AZ (low desert, Maricopa County)',
  '85004',
  '02-03',
  '12-08',
  'Maricopa',
  1154
);

INSERT OR REPLACE INTO zones (id, name, zip, last_frost, first_frost, county, elevation_ft) VALUES (
  'zone-mesa-85201',
  'Mesa AZ (low desert, Maricopa County)',
  '85201',
  '02-24',
  '11-29',
  'Maricopa',
  1167
);

INSERT OR REPLACE INTO zones (id, name, zip, last_frost, first_frost, county, elevation_ft) VALUES (
  'zone-tempe-85281',
  'Tempe AZ (low desert, Maricopa County)',
  '85281',
  '02-24',
  '11-29',
  'Maricopa',
  1167
);

INSERT OR REPLACE INTO zones (id, name, zip, last_frost, first_frost, county, elevation_ft) VALUES (
  'zone-scottsdale-85251',
  'Scottsdale AZ (low desert, Maricopa County)',
  '85251',
  '02-24',
  '11-29',
  'Maricopa',
  1167
);

INSERT OR REPLACE INTO zones (id, name, zip, last_frost, first_frost, county, elevation_ft) VALUES (
  'zone-glendale-85301',
  'Glendale AZ (low desert, Maricopa County)',
  '85301',
  '02-02',
  '12-08',
  'Maricopa',
  1135
);

INSERT OR REPLACE INTO zones (id, name, zip, last_frost, first_frost, county, elevation_ft) VALUES (
  'zone-chandler-85224',
  'Chandler AZ (low desert, Maricopa County)',
  '85224',
  '02-24',
  '11-29',
  'Maricopa',
  1167
);

INSERT OR REPLACE INTO zones (id, name, zip, last_frost, first_frost, county, elevation_ft) VALUES (
  'zone-buckeye-85326',
  'Buckeye AZ (low desert, Maricopa County)',
  '85326',
  '01-18',
  '12-16',
  'Maricopa',
  1040
);
