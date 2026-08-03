-- USDA Plant Hardiness Zone designation per planning zone (e.g. "9b", "10a").
-- Requested so the zone picker shows the real USDA zone alongside each city.
--
-- Source: USDA Plant Hardiness Zone Map, 2023 revision (USDA-ARS / Oregon State
-- University PRISM Climate Group), https://planthardiness.ars.usda.gov/ --
-- 30-year average annual extreme minimum winter temperature, by location.
-- The official site is an interactive GIS tool with no static per-ZIP table, so
-- each city's zip-centroid coordinates were checked against two independent
-- 2023 USDA-zone polygon datasets, both returning the same zone for every point:
--   1) phzmapi.org ZIP-centroid lookup (community mirror of the 2023 raster;
--      S3 object timestamps Nov 2023, matching the map's publication date).
--   2) ArcGIS FeatureServer "USDA Plant Hardiness Zones 2023" (accessInformation
--      "USDA, OSU"), queried directly by point geometry:
--      https://services1.arcgis.com/rKbpcgHXWYYaP4pQ/arcgis/rest/services/phzm_us_zones_shp_2023_view/FeatureServer/0/query
-- Retrieved and cross-checked 2026-08-02.
-- Phoenix (85004) 10a additionally corroborated in press coverage of the 2023
-- update (Fox 10 Phoenix; ScienceInsights) as the downtown/urban-heat-island
-- core of Phoenix moving from 9b to 10a for the first time.
-- No zone here is guessed -- a city with no matching lookup would keep
-- usda_zone NULL rather than receive an invented value.

ALTER TABLE zones ADD COLUMN usda_zone TEXT;

UPDATE zones SET usda_zone = '9b'  WHERE id = 'zone-cave-creek-85331';
UPDATE zones SET usda_zone = '10a' WHERE id = 'zone-phoenix-85004';
UPDATE zones SET usda_zone = '9b'  WHERE id = 'zone-mesa-85201';
UPDATE zones SET usda_zone = '9b'  WHERE id = 'zone-tempe-85281';
UPDATE zones SET usda_zone = '9b'  WHERE id = 'zone-scottsdale-85251';
UPDATE zones SET usda_zone = '9b'  WHERE id = 'zone-glendale-85301';
UPDATE zones SET usda_zone = '9b'  WHERE id = 'zone-chandler-85224';
UPDATE zones SET usda_zone = '9b'  WHERE id = 'zone-buckeye-85326';
