-- Index for pruning expired rate-limit buckets.
-- Do not edit 0001-0003 (0003 is applied in production).
--
-- functions/lib/rateLimit.ts deletes up to 100 buckets per new bucket with
--   DELETE FROM rate_limits WHERE bucket_key IN
--     (SELECT bucket_key FROM rate_limits WHERE window_start < ? LIMIT ?)
-- Without this index the subquery scans the table on every prune. The code
-- is correct without it (only slower), so deploy order does not matter.
-- Idempotent: CREATE INDEX IF NOT EXISTS.

CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits (window_start);
