-- Job runner columns, claim index, and hashed-IP rate limits.
-- Do not edit 0001/0002. Apply with wrangler; this task does not apply it.
--
-- ALTER TABLE ADD COLUMN has no IF NOT EXISTS in the SQLite surface D1
-- documents (https://developers.cloudflare.com/d1/sql-api/sql-statements/),
-- so the ADD COLUMN statements are not re-runnable. CREATE INDEX and
-- CREATE TABLE below are idempotent.

ALTER TABLE jobs ADD COLUMN entities TEXT NOT NULL DEFAULT '';
ALTER TABLE jobs ADD COLUMN claimed_at TEXT;
ALTER TABLE jobs ADD COLUMN claimed_by TEXT;
ALTER TABLE jobs ADD COLUMN step TEXT;
ALTER TABLE jobs ADD COLUMN detail TEXT;
ALTER TABLE jobs ADD COLUMN execution_id TEXT;
ALTER TABLE jobs ADD COLUMN deploy_url TEXT;
ALTER TABLE jobs ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

-- Oldest queued row: WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1.
CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at ON jobs (status, created_at);

-- bucket_key is an HMAC-SHA-256 hex digest under the RATE_LIMIT_KEY secret, never a raw IP address.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT PRIMARY KEY,
  hit_count INTEGER NOT NULL,
  window_start TEXT NOT NULL
);
