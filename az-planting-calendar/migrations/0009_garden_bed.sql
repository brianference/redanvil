-- AZ Planting Calendar's own account feature: a signed-in gardener's bed.
--
-- Kept in a separate migration from 0008_auth_core.sql on purpose: the auth kit
-- file is identical in every app and must stay re-copyable when the kit changes.
-- Anything specific to this app belongs here instead.
--
-- crops.id is TEXT (e.g. crop-tomatoes). users.id is TEXT (uuid).
-- zone stores the planning-zone id selected when the crop was added
-- (e.g. zone-cave-creek-85331). Planting windows themselves come from
-- planting_windows (az1005, Maricopa low desert), not a per-USDA-zone table.

create table if not exists garden_bed (
  user_id    text not null references users(id) on delete cascade,
  crop_id    text not null references crops(id) on delete cascade,
  zone       text not null,              -- planning zone id at add time
  added_at   integer not null,           -- epoch ms
  planted_at integer,                    -- epoch ms, null until marked planted
  notes      text,
  primary key (user_id, crop_id)
);

-- Account view reads every row for one user, then sorts by next window in JS.
create index if not exists idx_garden_bed_user on garden_bed(user_id, added_at);
