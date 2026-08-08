-- Sushi entity (PRD §7.2 DDL). All queries parameterized at the Function layer.
CREATE TABLE IF NOT EXISTS sushis (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sushis_title ON sushis (title);
