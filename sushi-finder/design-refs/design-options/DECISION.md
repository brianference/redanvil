# Layout decision — sushi-finder

**DECIDED: three views, recorded 2026-08-08 from the owner's pick across the
six-variation gallery.**

| view | composition | from |
|------|-------------|------|
| **1. Photos** (default) | **Editorial stack hero ON TOP of the photo grid** -- a full-bleed featured restaurant with its story, then the dense square tile grid beneath it | var-04 + var-01 |
| **2. Map** | Full-bleed map canvas, pin cluster with bottom-sheet rows | var-02 |
| **3. List** | Dense utility rows, 40px thumbs, segmented control | var-05 |

Owner's words: "combine editorial stack on top of photogrid and save the map view
as another view, utility list also is a third view under the map view".

**Read as three views, with List ordered after Map in the switcher.** "Under the
map view" is taken as position in the view order, not as a panel nested inside the
Map view. If he meant the latter -- a list rendered beneath the map on the same
screen -- say so and it is a small change.

**Palette: Mon Crest (palette-05)**, confirmed again here. Indigo ink, coral
action heat, Cormorant Garamond over Manrope. Its treatment travels with it:
14px radius cards, indigo ring insets on photos, ceremonial filled chips, airy
padding.

**Brand mark: mark-06** (maki finder lens). Decided, not open.

### Forbidden -- this is what shipped on pet-sitter and was rejected

- A shared marketing hero above every view. The editorial hero belongs to the
  Photos view ONLY. **Map opens on the map. List opens on the rows.**
- One search control reused by all three. Each view's entry control belongs to its
  own architecture.
- Collapsing the three into one shell with three swapped widgets.

### Not chosen, but kept

**var-03 Timeline board** and **var-06 Split rail** are not in this app. Both are
preserved in the shared skeleton library at `/design-system/skeletons/` for future
apps -- the owner asked that all six be kept, not discarded with the losers.

### Shared across views

Restaurant data, filter state surviving a view switch, the view in the URL, the
mark-06 brand mark, and the Mon Crest token layer so light and dark work
everywhere.

### Forbidden -- this is what shipped on pet-sitter and was rejected

- A shared hero paragraph above every view. **Map opens on the map. Seating opens
  on the timeline.** Neither gets a generic marketing hero above it.
- One search control reused by all three. Each view's entry control belongs to its
  own architecture: A searches from a capsule, B from the map header, C from the
  zone bar.
- One palette flattening the views. The Mon Crest tokens are shared, but each view
  keeps its own accent identity.
- Collapsing the three into one shell with three swapped widgets. That is the
  precise failure this section exists to prevent.

### Shared across views

Restaurant data, filter state (query, city, style, price, walk-in) surviving a view
switch, the view in the URL, the mark-06 brand mark, and the Mon Crest token layer
so light and dark both work everywhere.

# Layout decision — sushi-finder

Status: **OPEN** — no winner selected. Owner picks.

Three structurally distinct discovery architectures. They differ in **what owns
the fold** and **what the result unit is**. Recolouring any one does not produce
either of the others. Palette and logo are separate choice axes (also OPEN).

## Options

| Option | File | Owns the fold | Result unit | Secondary chrome |
|--------|------|---------------|-------------|------------------|
| **A — Photos grid** | `option-a.html` | Dense square **photo tile grid** (by-photos first) | Photo tile with name on image; style/price foot | Slim style chips; search as icon; Photos/Map/Seating/Ask tabs |
| **B — Map canvas** | `option-b.html` | Full-bleed **map** | Map **pin** + bottom-sheet **list row** (thumb, name, style, km) | Floating city/near-me pill over the map; no tab shell on fold |
| **C — Seating board** | `option-c.html` | **Tonight seating timeline** (Now / 18:00 / 19:00… with open counts) | **Availability row** (clock column, walk-in/reserve badge, style tags) | City zone bar; style facets; Ask as text control — no photo grid, no map |

### How they differ structurally (one line)

A is image-first tiles; B is geography-first canvas + sheet; C is time/availability-first board + ranked rows. Swapping palettes cannot turn a map canvas into a photo grid or a seating timeline.

### Separable pieces (for a mix)

| Piece | A | B | C |
|-------|---|---|---|
| Fold hero | Photo grid | Map | Seating timeline |
| Result unit | Photo tile | Pin + sheet row | Availability row |
| Search placement | Icon in thin strip | Floating pill on map | Not on fold (zone bar only) |
| Style filters | Horizontal chips | Implicit in sheet rows | Facet buttons under board |
| Assistant | Tab “Ask” | (not on this mock) | “Ask” pill in zone bar |

Mixing is allowed (e.g. fold of C + tiles of A). Record the mix when choosing.

## Direction from SOURCES.md

Intake ranked real App Store food apps (Kura Rewards, Sushi Shop, Amberjack, etc.).
Insight used, not cloned:

- Photo-led browse → Option A (plates own discovery)
- Place / near-me finder → Option B (map owns geography)
- Availability and trust signals → Option C (seating model on screen as a control)

No app layout, palette, or mark was copied.

## Forbidden

A decision that only lists what is **shared** collapses into one shell with three
widgets. That already happened on another app and had to be rebuilt. Do **not**
ship any of the following as “the three options”:

1. **A shared hero above every view** — same marketing/search hero, with only the
   body widget swapped (photos / map / seating as interchangeable panels).
2. **One search control reused by all** — a single search placement and behaviour
   that every option inherits, so options differ only in the result chrome.
3. **One palette everywhere treated as layout identity** — colour tokens are a
   separate axis (`design-refs/palettes/`); they do not distinguish layouts.

If two “options” share the same fold owner and the same result unit, they are
one option. Re-split before DECIDED.

## Choice

**Left open for the product owner.** Open `gallery.html`, compare fold owner and
result unit (not which coral is nicer), and name the winning file
(e.g. `option-a.html`) or a mix when ready.

Status token for decide role: leave as OPEN until the owner writes DECIDED.
