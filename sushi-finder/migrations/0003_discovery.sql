-- Discovery attributes for Photos / Map / Seating views (design-refs DECISION).
-- Optional columns; title + description remain the CRUD contract (PRD §7.2).
ALTER TABLE sushis ADD COLUMN style TEXT NOT NULL DEFAULT '';
ALTER TABLE sushis ADD COLUMN price_band TEXT NOT NULL DEFAULT '';
ALTER TABLE sushis ADD COLUMN walk_in INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sushis ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE sushis ADD COLUMN lat REAL;
ALTER TABLE sushis ADD COLUMN lng REAL;
ALTER TABLE sushis ADD COLUMN photo_url TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_sushis_style ON sushis (style);
CREATE INDEX IF NOT EXISTS idx_sushis_city ON sushis (city);
CREATE INDEX IF NOT EXISTS idx_sushis_walk_in ON sushis (walk_in);
