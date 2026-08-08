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
