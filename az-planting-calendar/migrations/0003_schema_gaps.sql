-- Schema gaps from the plan of record:
-- 1) source_granularity per planting window (az1005 uses half-month columns)
-- 2) Zone county + elevation_ft (Cave Creek ~2200 ft vs Phoenix ~1100 ft)

ALTER TABLE planting_windows ADD COLUMN source_granularity TEXT NOT NULL DEFAULT 'half-month'
  CHECK (source_granularity IN ('month', 'half-month'));

ALTER TABLE zones ADD COLUMN county TEXT;
ALTER TABLE zones ADD COLUMN elevation_ft INTEGER;

-- az1005 chart headers are "Jan. 1 / Jan. 15 … Dec. 15" (half-month columns).
UPDATE planting_windows SET source_granularity = 'half-month';

-- Cave Creek: Maricopa County. Elevation from nearest NOAA climate station
-- used for frost normals on Almanac (Carefree, AZ station, 2529 ft).
-- Frost dates updated to match NOAA 1991-2020 30% probability (Almanac) for consistency
-- with other Maricopa zones added in 0004. Prior seed values were 03-09 / 11-15.
UPDATE zones
SET
  county = 'Maricopa',
  elevation_ft = 2529,
  last_frost = '02-20',
  first_frost = '12-06'
WHERE id = 'zone-cave-creek-85331';
