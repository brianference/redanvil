-- Arizona low-desert planting calendar schema.
-- Half-months: 0..23 = Jan-1, Jan-15, Feb-1, ... Dec-15.

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  publisher TEXT NOT NULL,
  url TEXT NOT NULL,
  retrieved_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  zip TEXT NOT NULL,
  last_frost TEXT NOT NULL,
  first_frost TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  days_to_harvest_min INTEGER,
  days_to_harvest_max INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS planting_windows (
  id TEXT PRIMARY KEY,
  crop_id TEXT NOT NULL REFERENCES crops(id),
  start_half_month INTEGER NOT NULL CHECK (start_half_month >= 0 AND start_half_month <= 23),
  end_half_month INTEGER NOT NULL CHECK (end_half_month >= 0 AND end_half_month <= 23),
  method TEXT NOT NULL CHECK (method IN ('S', 'T')),
  source_id TEXT NOT NULL REFERENCES sources(id)
);

CREATE INDEX IF NOT EXISTS idx_windows_crop ON planting_windows (crop_id);
CREATE INDEX IF NOT EXISTS idx_windows_method ON planting_windows (method);
CREATE INDEX IF NOT EXISTS idx_windows_half ON planting_windows (start_half_month, end_half_month);
