# Competitors — pet-sitter

Competitor study for **Pet Sitter Finder**. The Assessment is the work list, not the scrape (R31). Checked against live product surfaces on **2026-08-06**.

## Landscape

| Competitor | What it is | Primary surfaces | Money model | Fit vs us |
|---|---|---|---|---|
| [Rover.com](https://www.rover.com/) | Largest US pet-care marketplace (boarding, house sitting, drop-ins, walking, daycare, training) | Service picker → location search → sitter cards/map → profile → book | On-platform payments; service fees; Rover Guarantee | Closest product analogue |
| [Wag!](https://wagwalking.com/) | On-demand dog walking / sitting, app-heavy | Map + request flow, walker matching, live walk tracking | Payments in-app; walker network | Ops-heavy; less “browse profiles for a trip” |
| [TrustedHousesitters](https://www.trustedhousesitters.com/) | Global house + pet sits; sitters get lodging, not cash between members | Membership browse of sits / sitters, applications | Annual memberships both sides | Different exchange (trust + stay, not nightly rate) |
| [NAPPS / petsitters.org](https://petsitters.org/) | National Association of Professional Pet Sitters directory | Zip locator → professional sitter listings | Association membership for sitters | Directory / trust badge, not full marketplace |
| [Pet Sitters International (petsit.com)](https://www.petsit.com/) | Trade association + Pet Sitter Locator | Locator directory for owners | Membership / insurance / education for sitters | Professional network, thin booking UX |
| [PetSitter.com](https://petsitter.com/) | Hire-a-pro marketplace (seeker / provider onboarding) | Get-started flows, sitter cards | Lead / platform marketplace | Mid-tier marketplace pattern |
| [Care.com pet care](https://www.care.com/pet-care) | Horizontal care marketplace; pet is one vertical | Filters (location, rate, services, reviews), profiles, messaging | Subscriptions / screening fees for full access | Multi-vertical; pet UX is secondary |

Rover and Care.com define owner expectations for **search → filter → profile → book**. Wag! defines on-demand walking UX we are not copying. TrustedHousesitters and NAPPS/PSI show alternate trust models (membership swap vs professional association).

## Assessment

Pet Sitter Finder is a **local overnight / multi-day sitter marketplace** with neighbourhood, verified reviews, per-night rates, accepted pet types, real availability, and a **booking request** (not payment capture) in MVP. Competitors set the bar on discovery chrome and trust signals. We win on a focused scope: Cloudflare-hosted, no fee stack, honest empty/error states, calendar availability as product data, and an in-app assistant grounded in our own sitters database.

### Features and controls we are missing

Relative to Rover / Care.com / Wag! today:

1. **Background-check and platform guarantee badges** as first-class, third-party verified claims (Rover Guarantee, screening products).
2. **On-platform messaging and photo updates** during a stay.
3. **Payments, payouts, refunds, and service-fee transparency**.
4. **Live GPS walk tracking** (Wag!) and real-time sitter location.
5. **Multi-service catalogue** as separate product lines (boarding vs walking vs training) with dedicated funnels.
6. **Native mobile apps** and push notifications.
7. **Map-primary browse with pin clustering** and draw-search-area (Rover/Wag patterns).
8. **Insurance / emergency vet support** productized into the booking.
9. **Sitter calendar sync** with external calendars and automatic block-out of booked nights at platform scale.
10. **Owner pet profiles with medical history** as a rich managed entity (our Pet entity is beyond full MVP CRUD UI).

MVP still must ship the controls that make the job real: text search, neighbourhood / reviews / rate / pet-type / availability filters, sitter detail, booking request for dates, auth, and assistant over local data.

### Components worth borrowing

Borrow one idea at a time (R23); do not clone brand, palette, or whole screens.

| Source | Component / pattern | How we use it |
|---|---|---|
| Rover | Service + location entry, then dense **sitter cards** (photo, rating count, rate, services) | Option A card body fields and verified chip |
| Rover | Clear **service types** and pet preferences on profile | Pet-type tags on card + detail; no fake six-service mega-nav in MVP |
| Care.com | **Filter by rate, availability, services, reviews** with results that actually change | Chip filters under sticky search; clear-all restores full set |
| Care.com | Profile → message / meet-and-greet framing | “Request booking” as the primary CTA (no fake chat network) |
| Wag! | **Map + list rail** when location is the query | Optional later results mode; not default MVP home |
| TrustedHousesitters | **Date-led matching** and “free for the whole window” framing | Date range under search + F3 half-month availability grid |
| NAPPS / PSI | **Professional trust** without claiming we are the association | “Verified reviews” as app-local verification language only; no false NAPPS badge |
| Rover app store listing | Trust copy: background checks, support, guarantee — as **product truth**, not decoration | Only claim what our Terms/Privacy and data model support |

### What we deliberately will not do

- **No payments in MVP** (no Stripe, in-app checkout, payouts, or fee calculator). Booking is a **request** against dates; money stays off-platform.
- **No OAuth / social login** and no third-party IdP; Web Crypto sessions only.
- **No Supabase, Express, bcrypt, or jsonwebtoken** (Workers runtime and platform rules).
- **No live walk tracking, GPS, or on-demand “walker in 20 minutes”** product.
- **No membership swap** model (TrustedHousesitters) as the primary exchange — we show **per-night rates**.
- **No multi-vertical care** (childcare, eldercare, housekeeping).
- **No invented platform guarantee or insurance product** in UI copy unless it is real and documented.
- **No multi-tenant orgs**, native mobile shell, or Node-only native modules in Worker/browser code.
- **No scraping competitor content** into our seed data; seed from real examples we are allowed to use, not their listings.

## Implications for build

1. Home / browse follows **Option A** (card grid + sticky search); see `design-refs/design-options/DECISION.md`.
2. Trust UI is limited to **verified reviews** and fields we store — not Rover-style guarantee badges.
3. Assistant answers only from **our D1 sitters data**, not general pet-care advice competing with Wag content marketing.
4. Legal pages must describe a **booking-request marketplace without payments**, not a payments processor.
