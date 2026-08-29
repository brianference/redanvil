-- Auth kit core schema (Cloudflare D1 / SQLite).
--
-- Access control is enforced server-side in Pages Functions: every query is
-- scoped to the session's user_id and the client never touches D1 directly.
--
-- This file is identical in every app that uses the kit. Each app's own feature
-- tables (saved trips, boards, tracked brands) belong in a LATER migration, so
-- this one can be re-copied verbatim when the kit is updated.
--
-- Passwords use PBKDF2-SHA256 via Web Crypto: bcrypt and argon2 are native Node
-- modules and cannot load in the Workers runtime. The iteration count is stored
-- per row so it can be raised later without invalidating existing hashes.

create table if not exists users (
  id            text primary key,          -- uuid
  email         text unique not null,      -- stored lowercase; sign-in is case-insensitive
  created_at    integer not null,          -- epoch ms
  updated_at    integer,
  password_hash text,                      -- base64 PBKDF2 output, null = passwordless account
  password_salt text,                      -- base64, 16 random bytes
  password_iters integer,                  -- PBKDF2 iterations used for THIS row
  email_verified integer not null default 0
);

create table if not exists sessions (
  id         text primary key,             -- random id, stored in the httpOnly cookie
  user_id    text not null references users(id) on delete cascade,
  created_at integer not null,
  expires_at integer not null
);

-- One-time magic-link sign-in tokens.
create table if not exists auth_tokens (
  token_hash text primary key,             -- sha-256 hex of the emailed token
  user_id    text not null references users(id) on delete cascade,
  expires_at integer not null,             -- epoch ms, ~15 min out
  used_at    integer                       -- epoch ms once redeemed, else null
);

-- Email confirmation tokens are kept apart from sign-in tokens so a confirmation
-- link, which sits in an inbox for a day, can never be replayed as a sign-in.
create table if not exists email_verifications (
  token_hash text primary key,
  user_id    text not null references users(id) on delete cascade,
  expires_at integer not null,             -- epoch ms, 24h out
  used_at    integer
);

-- Password reset tokens are separate again, so a leaked sign-in link can never
-- be replayed as a password change.
create table if not exists password_resets (
  token_hash text primary key,
  user_id    text not null references users(id) on delete cascade,
  expires_at integer not null,             -- epoch ms, 60 min out
  used_at    integer
);

-- Fixed-window rate limiting for auth endpoints. Keyed by endpoint + a salted
-- hash of the identifier (IP or email), so the table never holds a raw address
-- or an address-to-email mapping.
create table if not exists rate_limits (
  bucket       text primary key,           -- sha-256 of endpoint|salt|identifier
  window_start integer not null,           -- epoch ms of the current window
  count        integer not null default 0
);

-- Contact submissions are retained so a Brevo delivery failure never loses a message.
create table if not exists contact_messages (
  id         text primary key,
  name       text not null,
  email      text not null,
  subject    text not null,
  message    text not null,
  user_id    text references users(id) on delete set null,
  created_at integer not null,
  delivered  integer not null default 0
);

create index if not exists idx_sessions_user   on sessions(user_id);
create index if not exists idx_rate_limits_win on rate_limits(window_start);
create index if not exists idx_contact_created on contact_messages(created_at);
