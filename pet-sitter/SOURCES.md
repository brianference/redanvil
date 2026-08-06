# Sources — pet-sitter

Prior-art / design-source record (R23 / R11.3). App Store and web product references for pet sitting / pet care marketplace UI, checked before building UI.

## App Store / design references

| app | genre | notes | store / web URL | checked |
|---|---|---|---|---|
| Rover – Pet Sitters | Pet care marketplace | Canonical browse → profile → book; service types (boarding, house sitting, drop-ins, walking); ratings and rates on cards | https://apps.apple.com/us/app/rover-pet-sitters/id547320928 · https://www.rover.com/ | 2026-08-06 |
| Wag! | On-demand dog walking / sitting | Map-led request, walker matching, live walk UX — borrow sparingly; not our primary job | https://apps.apple.com/us/app/wag-dog-walkers-sitters/id922694818 · https://wagwalking.com/ | 2026-08-06 |
| TrustedHousesitters | House + pet sitting (membership) | Date- and listing-led trust swap; no peer payments between members; strong “whole trip” framing | https://apps.apple.com/us/app/trustedhousesitters/id1292606611 · https://www.trustedhousesitters.com/ | 2026-08-06 |
| Care.com | Horizontal care marketplace (pet vertical) | Filter stack: location, rate, services, availability, reviews; profile messaging | https://www.care.com/pet-care · https://www.care.com/pet-sitters | 2026-08-06 |
| NAPPS Pet Sitter Locator | Professional association directory | Zip → professional sitter list; trust via membership, thin booking chrome | https://petsitters.org/ · https://pro.petsitters.org/ | 2026-08-06 |
| Pet Sitters International | Trade association + locator | Owner-facing locator; insurance/education for sitters | https://www.petsit.com/ | 2026-08-06 |
| PetSitter.com | Pet sitter hire marketplace | Seeker/provider get-started; professional sitter cards | https://petsitter.com/ | 2026-08-06 |

## What we take from the category (not from a single brand)

1. **Card-first marketplace scan** — photo, name, neighbourhood or distance, star + review count, nightly or service rate, pet/service tags (Rover, Care.com, PetSitter.com).
2. **Text search plus real filters** that change the result set (Care.com, Rover location/service entry).
3. **Availability as a first-class field** — dates for the trip, not only “open now” (TrustedHousesitters date matching; Rover calendar on profiles).
4. **Trust signals that are true** — verified reviews we can store; do not paint guarantee/insurance badges we do not offer.
5. **Map as optional**, not required for a working MVP (Wag!/Rover map modes exist; our Option B documents the pattern for later).

## Borrowing rules

- Borrow **one structural idea** at a time (search slab, card metrics row, date range under filters).
- Never copy a brand mark, palette, illustration set, or entire screen layout.
- Seed data is our own catalogue, not scraped competitor listings.

## Link to design options

Structural options derived from this intake live in `design-refs/design-options/`:

- **A** Card grid marketplace (chosen) — aligned with Rover/Care browse patterns.
- **B** Map-first + list rail — aligned with Wag!/Rover map modes; deferred as default.
- **C** Calendar availability hero — aligned with date-led house-sit flows; informs F3 grid mode.

Decision writeup: `design-refs/design-options/DECISION.md`.
