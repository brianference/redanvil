# Candidate features — sushi-finder (By Photos)

Ranked by user value for the mission: discover sushi restaurants near you or in
any city by style (omakase / conveyor / counter), price band, walk-ins, photos,
map, and seating — with real reviews where data exists. Derived from
`docs/PRODUCT-BRIEF.md` and `docs/PRD.md`. Extraction and ranking only; no new
APIs invented.

**Rule used here:** a feature whose **data source** is not a confirmed real API,
a seeded D1 table defined in this app, or user input is **blocked**, not built.
The PRD forbids inventing third-party integrations (`§5`, `§7.1 Integrations:
None specified`). Confirmed runtime sources only:

| Source | Confirmed by |
|--------|----------------|
| Cloudflare D1 table `sushis` (seed + CRUD) | PRD §7.2 DDL + API |
| User input (forms, search box, browser geolocation permission) | PRD F7 / client |
| Cloudflare Workers AI (`env.AI`) | PRD F9 |
| GET `/api/health` | PRD §7.2 |

Nothing else (Google Places, Yelp, OpenTable, Resy, live photo CDNs, live
review feeds) is named or wired in this project. Those may exist in the world;
they are not this app's **data source** until listed in the PRD and bound.

---

## Ranked list (build candidates first)

### 1. Browse & search sushi restaurants **[build]**

Users open a list of sushi places, search by title, and see matches or an empty
state — the minimum discovery surface for a finder.

**data source:** Cloudflare D1 `sushis` via `GET /api/sushis` (optional `?q=`
title search); seed rows for first paint; never fabricated client-side rows.

### 2. Search and filter the collection **[build]**

A real search/filter control (accessible name matching `/search|find|filter/i`)
that narrows visible results — decorative search boxes fail the PRD.

**data source:** same D1 `sushis` rows; filter/query applied in
`GET /api/sushis` (and/or client filter over the fetched set). Only columns that
exist on seeded rows may filter. Extending filters (style, price, walk-in)
requires those columns on `sushis` plus seed values — still D1, not an external
API.

### 3. Restaurant (Sushi) detail **[build]**

Open one place and read its full record with a path back to the list.

**data source:** D1 `sushis` via `GET /api/sushis/:id` (title, description,
timestamps; extra fields only if present on the row and in the Zod contract).

### 4. Style / price / walk-in attributes on each place **[build — schema extend]**

Mission criteria: omakase vs conveyor vs counter, price band, walk-ins. Highest
product value after basic browse, but the default PRD DDL only has
`title` / `description`.

**data source:** D1 `sushis` columns added in migration + seed (user-curated or
cited seed data). **Not** a live Places/Yelp attribute feed. If no migration
adds these columns and no seed populates them, this rank item collapses into
title/description-only detail and the filters stay blocked for those facets.

### 5. Ask the assistant about sushi data **[build]**

Chat from the shell; answers must ground in this app's data, not generic model
knowledge. Failures surface as errors, never empty success.

**data source:** Cloudflare Workers AI (`env.AI.run`) for generation, grounded
by read-only queries over D1 `sushis` (and only those rows). User message text
is user input. No second knowledge base.

### 6. Public access (no login) **[build]**

Anonymous use of every product page and API — required so discovery is not
gated.

**data source:** none required (capability / routing). Confirmed by absence of
auth middleware and public `GET /api/health` + domain routes.

### 7. Manage Sushi (create / edit / delete) **[build — lower visitor value]**

Operators or early curators can add and correct places. Useful for a marketplace
bootstrap; not the primary visitor flow.

**data source:** user input on create/edit forms → D1 via `POST /api/sushis`
(and update/delete as specified); list refresh from D1.

### 8. Near-me / city entry as query inputs **[build — location only]**

“Near you or in any city” needs a location signal for ranking or filtering.

**data source:** user input (city text box and/or browser Geolocation API with
permission). Matching still runs against D1 rows that carry city/lat/lng if
those fields exist on seed. Without lat/lng/city on `sushis`, the UI can accept
location but cannot rank distance — treat distance sort as blocked until columns
+ seed exist.

### 9. Browse by photos (photo grid / gallery) **[build only if seeded URLs]**

Mission: browse by photos. High value for a visual category; empty galleries are
worse than no gallery.

**data source:** photo URL(s) stored on D1 `sushis` (or a related seed table)
pointing at assets we host or that resolve from a cited seed. **Not** a live
Google/Yelp photo API (unlisted, unconfirmed for this app). If seed has no
photo fields, this feature is **blocked** (see blocked section).

### 10. Map browse of places **[build only if coords + tiles decided]**

Mission: browse by map. Map chrome alone without points is empty.

**data source:** lat/lng on D1 `sushis` (seed or user input). Map tiles are a
display concern (e.g. public OSM tile usage via a client library such as Leaflet
— reuse scan lists Leaflet; tiles are not restaurant data). Place markers come
only from D1 coords. If rows have no coordinates, map browse is **blocked**.

---

## Blocked (do not build empty screens)

### B1. Live worldwide restaurant discovery from an external places API **[blocked]**

Pulling a global, current catalog of sushi restaurants would need a places
search provider. The PRD lists integrations as none and forbids inventing them.
No Places/Foursquare/Yelp key or binding exists in this project.

**data source:** none confirmed for this app. Do not call invent an unlisted
API. Scope stays D1 seed + user-curated rows until a real integration is named
in the PRD and verified.

### B2. Real third-party reviews and ratings **[blocked]**

Mission asks for “real reviews.” No review API is named; inventing Yelp/Google
review scrape or API use would violate the PRD and licence/ToS risks.

**data source:** none confirmed. Optional later path: user-written review text
stored in D1 (user input) — that is not “real reviews” from the public web and
must not be labelled as Yelp/Google scores.

### B3. Live seating / reservation availability **[blocked]**

“When a seating is available” implies live bookable inventory. No OpenTable,
Resy, TableCheck, or similar API is named or confirmed here.

**data source:** none confirmed. Do not show fake “available tonight” chips.
Static “takes walk-ins: yes/no” can ship only as a D1 boolean/seed field (rank
4), not as live table status.

### B4. Live photo streams from restaurant platforms **[blocked]**

Without a confirmed photo CDN or Places photos API bound to this app, a “photo
browse” that hits the open web is unsourced.

**data source:** none confirmed for live streams. Seeded photo URLs (rank 9)
are the only allowed path.

### B5. PRD template “planting window / days to harvest / AZ1005” grid **[blocked as domain]**

F1–F3 copy still contains planting-calendar language (seed vs transplant, days
to harvest, AZ1005 citations). That is template bleed, not sushi domain data.
There is no AZ1005 (or equivalent) sushi planting dataset for this product.

**data source:** none for planting windows in sushi-finder. Implement the
mission equivalents (photo grid, map, walk-in/style filters) only via the D1
sources above; do not ship empty “harvest window” cells.

### B6. Payments, auth, multi-tenant, native mobile **[blocked by non-goals]**

Explicitly out of scope in the product brief and PRD §5.

**data source:** N/A — not a missing feed; do not build.

---

## Summary for builders

| Rank | Feature | Status | data source (short) |
|------|---------|--------|---------------------|
| 1 | Browse & search restaurants | build | D1 `sushis` / `GET /api/sushis` |
| 2 | Search & filter control | build | D1 + query params / user input |
| 3 | Detail page | build | D1 `GET /api/sushis/:id` |
| 4 | Style / price / walk-in fields | build if migrated+seeded | D1 columns + seed |
| 5 | AI assistant | build | Workers AI + D1 grounding |
| 6 | Public access | build | no entity data |
| 7 | Manage CRUD | build | user input → D1 |
| 8 | Near-me / city input | build input; distance needs coords | user input + D1 location fields |
| 9 | Photo browse | build if photo URLs seeded | D1 photo URLs |
| 10 | Map browse | build if lat/lng seeded | D1 coords + map tiles for chrome |
| B1–B5 | Live places, real reviews, live seating, live photos, planting template | **blocked** | no confirmed external **data source** |

Ship ranks 1–7 on D1 + Workers AI first. Treat ranks 8–10 as schema/seed
extensions of the same D1 source, not as free live data. Never paint B1–B5 UI
until a real **data source** is confirmed and written into the PRD.
