-- Pet Sitter Finder schema (D1).
-- Auth: users + sessions. Domain: sitter, pet, booking, review.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sitter (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  neighbourhood TEXT NOT NULL,
  rate_per_night INTEGER NOT NULL,
  pet_types TEXT NOT NULL,
  bio TEXT NOT NULL,
  verified_reviews INTEGER NOT NULL DEFAULT 0,
  available_from TEXT,
  available_to TEXT,
  source_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pet (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS booking (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  sitter_id TEXT NOT NULL REFERENCES sitter(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review (
  id TEXT PRIMARY KEY,
  sitter_id TEXT NOT NULL REFERENCES sitter(id),
  author_user_id TEXT REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sitter_neighbourhood ON sitter (neighbourhood);
CREATE INDEX IF NOT EXISTS idx_sitter_rate ON sitter (rate_per_night);
CREATE INDEX IF NOT EXISTS idx_review_sitter ON review (sitter_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
