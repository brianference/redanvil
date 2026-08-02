-- Fixed-window rate limit buckets for paid endpoints (assistant).
-- window_start is epoch milliseconds of the window floor.
-- window_type is 'minute' or 'day'.

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  client_key TEXT NOT NULL,
  window_type TEXT NOT NULL CHECK (window_type IN ('minute', 'day')),
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (client_key, window_type, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_window_start
  ON rate_limit_buckets (window_start);
