-- Auth kit core schema, MULTI-TENANT variant (Cloudflare D1 / SQLite).
--
-- Use this INSTEAD OF 0001_auth_core.sql when several apps share one database.
-- Cloudflare's free tier caps D1 at 10 databases per account, so agent-tower,
-- social-pulse and yt-intel-one share this one rather than costing three slots.
--
-- THE ONE DIFFERENCE THAT MATTERS: `users` carries an `app` column and its
-- uniqueness is on (app, email), not on email alone. Without that, registering
-- on social-pulse would hand you an account on yt-intel-one, because a single
-- `email unique` constraint makes the three user bases one user base. Every
-- lookup by email in the kit must therefore also filter by app; the kit does
-- this whenever APP.scope is set in appconfig.ts.
--
-- The child tables (sessions, tokens, resets) need no app column: they key on
-- user_id, and a user row already belongs to exactly one app.
--
-- rate_limits needs no app column either. Its bucket key is a hash of
-- endpoint|RATE_LIMIT_SALT|identifier, and RATE_LIMIT_SALT is a per-app secret,
-- so two apps cannot collide on a bucket or read each other's counters.

create table if not exists users (
  id             text primary key,          -- uuid
  app            text not null,             -- owning app slug, e.g. 'social-pulse'
  email          text not null,             -- stored lowercase; sign-in is case-insensitive
  created_at     integer not null,          -- epoch ms
  updated_at     integer,
  password_hash  text,                      -- base64 PBKDF2 output, null = passwordless account
  password_salt  text,                      -- base64, 16 random bytes
  password_iters integer,                   -- PBKDF2 iterations used for THIS row
  email_verified integer not null default 0
);

-- The tenancy boundary. An index alone would not enforce it.
create unique index if not exists idx_users_app_email on users(app, email);

create table if not exists sessions (
  id         text primary key,
  user_id    text not null references users(id) on delete cascade,
  created_at integer not null,
  expires_at integer not null
);

create table if not exists auth_tokens (
  token_hash text primary key,
  user_id    text not null references users(id) on delete cascade,
  expires_at integer not null,
  used_at    integer
);

-- Confirmation tokens are kept apart from sign-in tokens so a confirmation link,
-- which sits in an inbox for a day, can never be replayed as a sign-in.
create table if not exists email_verifications (
  token_hash text primary key,
  user_id    text not null references users(id) on delete cascade,
  expires_at integer not null,
  used_at    integer
);

create table if not exists password_resets (
  token_hash text primary key,
  user_id    text not null references users(id) on delete cascade,
  expires_at integer not null,
  used_at    integer
);

create table if not exists rate_limits (
  bucket       text primary key,
  window_start integer not null,
  count        integer not null default 0
);

-- `app` here is for attribution: three apps deliver to the same operator inbox,
-- and a stored message should say which one it came from.
create table if not exists contact_messages (
  id         text primary key,
  app        text not null,
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
create index if not exists idx_contact_created on contact_messages(app, created_at);
