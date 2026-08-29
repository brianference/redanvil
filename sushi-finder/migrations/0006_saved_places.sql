-- Sushi Finder's own account feature: the list a signed-in person keeps.
--
-- Kept in a separate migration from 0005_auth_core.sql on purpose: the auth kit
-- file is identical in every app and must stay re-copyable when the kit changes.
-- Anything specific to this app belongs here instead.

create table if not exists saved_places (
  user_id    text not null references users(id) on delete cascade,
  sushi_id   text not null references sushis(id) on delete cascade,
  saved_at   integer not null,           -- epoch ms
  been_there integer not null default 0, -- 1 once marked visited
  visited_at integer,                    -- epoch ms of the visit, null until marked
  notes      text,
  primary key (user_id, sushi_id)
);

-- The list view reads every row for one user, newest first.
create index if not exists idx_saved_places_user on saved_places(user_id, saved_at desc);

-- "How many people saved this place" reads the other way round.
create index if not exists idx_saved_places_sushi on saved_places(sushi_id);
