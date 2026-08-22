CREATE TABLE IF NOT EXISTS jobs (
  dedupe_key TEXT PRIMARY KEY,
  company TEXT,
  title TEXT,
  url TEXT,
  match_pct INTEGER,
  source TEXT,
  status TEXT,
  lane TEXT,
  submitted_at TEXT,
  posted TEXT,
  work_type TEXT,
  updated_at TEXT
);
