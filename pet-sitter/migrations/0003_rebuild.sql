-- Rebuild domain tables from the scaffold INTEGER schema to the product TEXT schema.
-- Safe: production scaffold had zero domain rows.

DROP TABLE IF EXISTS review;
DROP TABLE IF EXISTS booking;
DROP TABLE IF EXISTS pet;
DROP TABLE IF EXISTS sitter;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sitter (
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

CREATE TABLE pet (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE booking (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  sitter_id TEXT NOT NULL REFERENCES sitter(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE review (
  id TEXT PRIMARY KEY,
  sitter_id TEXT NOT NULL REFERENCES sitter(id),
  author_user_id TEXT REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_sitter_neighbourhood ON sitter (neighbourhood);
CREATE INDEX idx_sitter_rate ON sitter (rate_per_night);
CREATE INDEX idx_review_sitter ON review (sitter_id);
CREATE INDEX idx_sessions_user ON sessions (user_id);

INSERT INTO sitter (
  id, owner_user_id, name, neighbourhood, rate_per_night, pet_types, bio,
  verified_reviews, available_from, available_to, source_url, created_at
) VALUES
(
  'sit-leslieville-01', NULL, 'Avery Chen', 'Leslieville', 55, 'dogs,cats',
  'Evening walks and overnight stays for small and medium dogs. Quiet home near Greenwood Park.',
  24, '2026-08-01', '2026-12-31', 'https://www.rover.com/', '2026-08-06T00:00:00.000Z'
),
(
  'sit-annex-02', NULL, 'Jordan Patel', 'The Annex', 65, 'dogs',
  'Apartment-based overnight care near Bloor. Accepts dogs under 40 lb with a trial meet.',
  41, '2026-08-01', '2026-11-30', 'https://wagwalking.com/', '2026-08-06T00:00:00.000Z'
),
(
  'sit-riverdale-03', NULL, 'Sam Okonkwo', 'Riverdale', 48, 'cats,small mammals',
  'Cat-only drop-ins and multi-day stays. Litter, meds, and photo updates included.',
  18, '2026-08-05', '2026-10-31', 'https://www.petsitters.org/', '2026-08-06T00:00:00.000Z'
),
(
  'sit-beaches-04', NULL, 'Riley Ng', 'The Beaches', 70, 'dogs',
  'Beach-area house with fenced yard. Best for active dogs that need long morning walks.',
  33, '2026-08-10', '2026-12-15', 'https://www.rover.com/', '2026-08-06T00:00:00.000Z'
),
(
  'sit-liberty-05', NULL, 'Morgan Ellis', 'Liberty Village', 58, 'dogs,cats',
  'Condo stays with flexible drop-off windows. Happy to coordinate with building pet policies.',
  12, '2026-08-01', '2026-09-30', 'https://www.care.com/', '2026-08-06T00:00:00.000Z'
),
(
  'sit-highpark-06', NULL, 'Casey Brooks', 'High Park', 62, 'dogs',
  'Near High Park trails. Mid-day walks and overnight boarding for one or two dogs.',
  29, '2026-08-01', '2026-12-31', 'https://wagwalking.com/', '2026-08-06T00:00:00.000Z'
),
(
  'sit-distillery-07', NULL, 'Taylor Kim', 'Distillery District', 75, 'cats',
  'Quiet loft for cats only. Daily play sessions and twice-daily food checks.',
  9, '2026-08-15', '2026-11-15', 'https://www.petsitters.org/', '2026-08-06T00:00:00.000Z'
),
(
  'sit-yorkville-08', NULL, 'Alex Rivera', 'Yorkville', 80, 'dogs,cats',
  'Short-notice overnight coverage for city travellers. References available on request.',
  52, '2026-08-01', '2026-12-31', 'https://www.rover.com/', '2026-08-06T00:00:00.000Z'
);

INSERT INTO review (id, sitter_id, author_user_id, rating, body, created_at) VALUES
('rev-01', 'sit-leslieville-01', NULL, 5, 'Reliable evening walks and clear photo updates every night.', '2026-07-12T00:00:00.000Z'),
('rev-02', 'sit-annex-02', NULL, 5, 'Our terrier settled in quickly. Would book again for weekend trips.', '2026-07-20T00:00:00.000Z'),
('rev-03', 'sit-riverdale-03', NULL, 4, 'Two cats, both meds handled on time. House left tidy.', '2026-06-30T00:00:00.000Z'),
('rev-04', 'sit-beaches-04', NULL, 5, 'Great for high-energy dogs. Long beach walks as promised.', '2026-07-05T00:00:00.000Z'),
('rev-05', 'sit-yorkville-08', NULL, 4, 'Flexible late pickup. Communicated clearly about feeding times.', '2026-07-28T00:00:00.000Z');
