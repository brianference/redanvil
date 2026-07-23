-- Initial app-builder D1 schema (jobs queue + saved PRDs).
-- Safe to re-run: CREATE TABLE/INDEX IF NOT EXISTS.
-- Apply with: wrangler d1 migrations apply app-builder-db --remote
--   (or --local for local dev). Do not invent ad-hoc SQL against prod.

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  prompt TEXT NOT NULL,
  target_type TEXT NOT NULL,
  threshold INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prds (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  markdown TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- List endpoints ORDER BY created_at DESC LIMIT 50.
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs (created_at);
CREATE INDEX IF NOT EXISTS idx_prds_created_at ON prds (created_at);
