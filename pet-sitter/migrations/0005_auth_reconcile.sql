-- Reconcile Pet Sitter's original bespoke auth tables with the shared auth kit.
--
-- WHY THIS IS A REBUILD AND NOT AN ALTER
--
-- Pet Sitter already had `users` and `sessions`, created outside the tracked
-- migrations, in shapes the kit cannot use:
--
--   users     id, email, password_hash, password_salt, display_name, created_at
--             - no password_iters, so a hash cost cannot be recorded per row
--             - no email_verified / updated_at
--             - display_name is NOT NULL with no default, so the kit's insert fails
--             - created_at is TEXT; the kit stores epoch ms as INTEGER
--   sessions  keyed on token_hash; the kit keys on id
--
-- `create table if not exists` in 0004_auth_core.sql therefore silently did
-- nothing for these two tables, and registration failed at runtime with a 500.
-- SQLite cannot alter a column's default or a primary key, so an ALTER path
-- cannot reach the target shape.
--
-- SAFETY: verified against the REMOTE database on 2026-08-29 before writing this
-- file -- `select count(*) from users` returned 0 and `select count(*) from
-- sessions` returned 0. No account data is destroyed because there is none.
-- If either table is ever non-empty, DO NOT run this; write a copy-forward
-- migration instead.

drop table if exists sessions;
drop table if exists users;

create table users (
  id             text primary key,          -- uuid
  email          text unique not null,      -- stored lowercase; sign-in is case-insensitive
  created_at     integer not null,          -- epoch ms
  updated_at     integer,
  password_hash  text,                      -- base64 PBKDF2 output, null = passwordless account
  password_salt  text,                      -- base64, 16 random bytes
  password_iters integer,                   -- PBKDF2 iterations used for THIS row
  email_verified integer not null default 0,
  -- Kept from the original schema because Pet Sitter is a two-sided marketplace
  -- and a sitter profile needs a name to show. Nullable so the kit's insert,
  -- which does not know about it, still succeeds.
  display_name   text
);

create table sessions (
  id         text primary key,              -- random id, stored in the httpOnly cookie
  user_id    text not null references users(id) on delete cascade,
  created_at integer not null,
  expires_at integer not null
);

create index if not exists idx_sessions_user on sessions(user_id);
