-- Owner/sitter role plus the owner's shortlist of sitters they are considering.
-- display_name already exists on users (nullable); do not add another name column.
-- The catalog table is `sitter` (singular). sitter_id references that table.

alter table users add column role text;

create table shortlist (
  user_id   text not null references users(id) on delete cascade,
  sitter_id text not null references sitter(id) on delete cascade,
  added_at  integer not null,
  note      text,
  primary key (user_id, sitter_id)
);

create index if not exists idx_shortlist_user on shortlist (user_id);
