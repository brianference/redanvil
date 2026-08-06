# Product brief — Pet Sitter Finder

**Slug:** `pet-sitter`  
**Authoritative PRD:** `docs/pet-sitter-prd.md` (source of truth; this brief does not override it)  
**Role owner:** product  
**Rows owned by product:** `fe-product-completeness`, `u-claims-covered`  
**Gate threshold:** score >= 90  

This brief is the product contract used before design and build. Every promise below maps to a checklist or rubric row that a named team role owns. A promise with no owning row is a hard error.

---

## Product in one line

**Pet Sitter Finder** is a marketplace that lets a pet owner find and book trusted local pet sitters: browse by neighbourhood with verified reviews, per-night rates, accepted pet types, and real availability, then request a booking for specific dates.

---

## Core user job (end to end)

Primary actor: a **registered pet owner** (auth is in scope).

1. **Arrive** at the home or sitters surface with a working default (system theme, clean console, real seeded catalog — not an empty success).
2. **Search or browse** sitters. Enter a text query; the app returns matching sitters ordered by best match, or an empty state that explains how to widen the search.
3. **Constrain** the list with real filter controls (not prose): neighbourhood / verified reviews, per-night rates, pet types the sitter accepts, real availability, and booking dates. Active filters stay visible; clearing them restores the full set.
4. **Scan availability** on a calendar grid or half-month window when that view is open; empty and error states never invent sample rows.
5. **Open a sitter detail** from a list or grid row. See title, description, care-relevant metrics and notes, and source citations when present. Unknown ids show a not-found path back.
6. **Request a booking** for specific dates against a chosen sitter (booking entity and flow in MVP search/filter acceptance; full booking CRUD is Beyond MVP F13).
7. **Optional assistants to the job:** sign in / register so domain rows stay scoped to the signed-in user; manage own sitter listings (create, edit, delete with confirm); ask the in-app AI assistant a question grounded in this app's sitters data (Workers AI binding, fail closed).

Supporting surfaces that must still ship with the product shell: Home, About, Terms, Privacy, Contact, theme toggle, sticky nav, breadcrumbs on detail, multi-column footer, real brand mark.

**Out of scope (not promises):** payments, OAuth/social login, multi-tenant orgs, native mobile shell, Supabase/Express/bcrypt/jsonwebtoken, inventing entities beyond Sitter / Pet / Booking / Review. See PRD §5.

---

## Promises

Every line below is a product promise from the PRD (MVP F1–F11 plus required shell commitments in §4 / §7.3 / F15). Format is parseable by the product precondition (`owns: <row-or-rule-id>`).

### MVP domain promises

- Search sitters returns ordered matches for a valid query | owns: fe-search-present
- Search empty and error states never look like a successful empty list | owns: fe-product-completeness
- Filter and sort sitters by neighbourhood with verified reviews | owns: B4
- Filter and sort sitters by per-night rates | owns: B4
- Filter and sort sitters by pet types each sitter accepts | owns: B4
- Filter and sort sitters by real availability | owns: B4
- Filter sitters toward booking dates and clear filters restore the full set | owns: B4
- Sitters calendar grid or half-month window renders without inventing missing data | owns: fe-product-completeness
- Sitter detail shows care metrics, notes, and source citations when present | owns: B1
- Browse sitters list with title search and empty state | owns: fe-search-present
- Sitter detail page shows title, description, and a path back; unknown id is not-found | owns: B3
- Register and sign in with Web Crypto sessions; domain data scoped to the signed-in user | owns: B2
- Create, edit, and delete sitters with confirmation before delete | owns: B1
- Collection text search control named search/find/filter narrows visible results | owns: fe-search-present
- AI assistant reachable from the shell, grounded in app data, fails with an error state | owns: lg-bindings-bound
- End-to-end find-and-book job produces usable output, not an input-only dead end | owns: fe-product-completeness

### Shell and trust promises (required with MVP)

- Required pages Home, About, Terms, Privacy, Contact render as distinct real pages | owns: fe-required-pages
- Terms and Privacy meet substance floors and only claim what this app does | owns: fe-legal-substance
- SEO assets sitemap, robots, and structured data ship with the build | owns: fe-seo-assets
- Light and dark themes with a visible theme toggle and token-only colour | owns: fe-light-dark
- Sticky premium nav, breadcrumbs on inner/detail routes | owns: fe-premium-nav
- Breadcrumbs present on sitter detail and other inner pages | owns: fe-breadcrumbs
- Real brand mark, not emoji or letter placeholders | owns: fe-brand-mark
- Painted content uses desktop width correctly (no starved column) | owns: fe-desktop-width
- No overlapping or clipped primary UI at 375px | owns: fe-responsive-375
- Cold visitor gets a working app with no primed state | owns: fe-cold-visitor
- Every product claim is named by a real test in the suite | owns: u-claims-covered
- Acceptance tests encode PRD §9 criteria, not only the implementation | owns: u-test-acceptance
- Deployed API routes return real non-empty bodies from D1 where claimed | owns: u-api-real-output
- A first-time stranger can complete the stated purpose or refuse with named complaints | owns: product-as-stranger

### Beyond MVP (deferred; not ship blockers for MVP)

These are named in the PRD so later work is not invented, but they are **not** current ship promises. Do not gate MVP on them.

| Feature | PRD id | When |
|---------|--------|------|
| Manage Pet | F12 | After MVP green |
| Manage Booking (full CRUD UI) | F13 | After MVP green |
| Manage Review | F14 | After MVP green |
| Required pages & SEO polish as a named slice | F15 | Largely overlapped by shell promises above; finish any remaining SEO gaps with MVP |

---

## Acceptance evidence per promise

Evidence is what someone opens to prove the promise — not a plan. PRD §9 bullets and §10 named tests are the binding acceptance set. Rubric/checklist rows are the ownership and gate hooks.

### P1 — Search sitters (PRD F1)

| | |
|--|--|
| **Promise** | User submits a query; matching sitters render ordered by best match |
| **Owning row** | `fe-search-present` (engineer) |
| **Product row** | `fe-product-completeness` (product) for empty/error honesty |
| **§9 bullets** | Ordered results; empty state on no match; error + retry on 500; timeout message on slow upstream |
| **§10 tests** | `rankSittersResults_ordersByTheBestMatch`; `POST /api/search returns 200 with ordered results`; `search-sitters returns ordered results`; `search empty state`; `search error + retry` |
| **Artifact when done** | Playwright summary + live collection response showing count drop on a known subset query |

### P2 — Filter and sort sitters (PRD F2)

| | |
|--|--|
| **Promise** | Neighbourhood/reviews, rates, pet types, availability, booking dates are real controls |
| **Owning row** | `B4` (engineer) — query/filter parameters change row counts |
| **§9 bullets** | Each named filter narrows results and shows active state; clear restores full set; all-exclude empty state names filters |
| **§10 tests** | `filterSitters_byNeighbourhoodWithVerifiedReviews`; `filterSitters_byPerNightRates`; `filterSitters_byThePetTypesEachSitterAccepts`; `filterSitters_byRealAvailability`; matching E2E filter cases |
| **Artifact when done** | Two API or UI captures with **different** result counts for the same route under different filters |

### P3 — Sitters grid (PRD F3)

| | |
|--|--|
| **Promise** | Calendar grid / half-month window of sitters without invented cells |
| **Owning row** | `fe-product-completeness` (product) |
| **§9 bullets** | Grid renders real rows/columns; method markers when present; empty and error states |
| **§10 tests** | Grid load, empty, error + retry cases under F3 in §10 |
| **Artifact when done** | Screenshot of grid at 375 and 1280 + API body for the grid dataset |

### P4 — Filter sitters on the grid (PRD F4)

| | |
|--|--|
| **Promise** | Same constraint set as F2 applied to the grid surface |
| **Owning row** | `B4` (engineer) |
| **§9 / §10** | Mirror of F2 acceptance and filter tests against the grid view |
| **Artifact when done** | Grid with active filter chip visible and reduced row set |

### P5 — Sitters detail (PRD F5)

| | |
|--|--|
| **Promise** | Detail shows windows/metrics/notes and citations; unknown id is not-found |
| **Owning row** | `B1` (engineer / qa-runtime) |
| **§9 bullets** | Metrics and notes render; citations link to real sources; windows without source do not render; unknown id not-found |
| **§10 tests** | Detail happy path, citation link, not-found under F5 |
| **Related** | `D5` / `fe-resource-links` (qa-data) when citations are external |
| **Artifact when done** | Captured detail HTML/JSON for a known id and a 404 for an unknown id |

### P6 — Browse and search Sitter list (PRD F6)

| | |
|--|--|
| **Promise** | List shows titles and detail links; title search narrows; empty and error states |
| **Owning row** | `fe-search-present` (engineer) |
| **§9 / §10** | F6 bullets and list/search E2E names |
| **Artifact when done** | List screenshot + search narrowing proof (result count strictly decreases) |

### P7 — Sitter detail page (PRD F7)

| | |
|--|--|
| **Promise** | `/sitters/:id` shows title, description, back link; not-found and error states |
| **Owning row** | `B3` (engineer) for not-found; `fe-breadcrumbs` (engineer) for path back |
| **§9 / §10** | F7 bullets and detail E2E |
| **Artifact when done** | Live `nav` breadcrumb + 404 body for missing id |

### P8 — Accounts (PRD F8)

| | |
|--|--|
| **Promise** | Register/sign-in/sign-out via Web Crypto; rows scoped per user; bad credentials 401 |
| **Owning row** | `B2` (engineer) — responses from DB, not literals; session-scoped queries |
| **§9 / §10** | F8 bullets; register, sign-in, scope isolation, invalid credentials tests |
| **Artifact when done** | Two users' list responses with disjoint ids; session cookie present only after success |

### P9 — Manage Sitter (PRD F9)

| | |
|--|--|
| **Promise** | Create, edit, delete with confirm/cancel; validation fails closed on empty title |
| **Owning row** | `B1` (engineer) |
| **§9 / §10** | F9 bullets; create/edit/delete/cancel/validation tests |
| **Artifact when done** | Before/after list counts around create and confirmed delete |

### P10 — Collection search control (PRD F10)

| | |
|--|--|
| **Promise** | Accessible name matches `/search\|find\|filter/i`; query narrows results; no-match and error states |
| **Owning row** | `fe-search-present` (engineer) |
| **§9 / §10** | F10 bullets; accessible-name and narrowing E2E |
| **Artifact when done** | Gate/Playwright proof that result count drops on a known subset query |

### P11 — Ask the assistant about Sitter (PRD F11)

| | |
|--|--|
| **Promise** | Chat from shell → Worker AI grounded in D1 sitters data; model failure is an error state |
| **Owning row** | `lg-bindings-bound` (qa-runtime) — AI binding present in deploy |
| **Product row** | `fe-product-completeness` for usable grounded answers vs dead-end chrome |
| **§9 / §10** | F11 bullets; assistant reachable, grounded answer, 502/error state, empty message 400 |
| **Artifact when done** | Captured `/api/assistant` success body referencing real sitter fields; captured error body when binding missing |

### P12 — End-to-end product completeness

| | |
|--|--|
| **Promise** | The stated core job (find trusted local sitters and move toward a dated booking) works end to end |
| **Owning row** | `fe-product-completeness` (product) |
| **Checklist** | DONE-CHECKLIST C10 (result where the person is looking); user-refuse `product-as-stranger` |
| **Artifact when done** | `evidence/qa-visual-pet-sitter.json` + `evidence/refusal-pet-sitter.json` + screenshots of the happy path |

### P13 — Required pages and legal substance

| | |
|--|--|
| **Promise** | Distinct Home, About, Terms, Privacy, Contact; legal copy true of this app |
| **Owning rows** | `fe-required-pages`, `fe-legal-substance` (content); D1/D2/D3/D4/D8 |
| **§9** | F15 unique titles/descriptions; sitemap + robots non-empty; unique OG per route |
| **Artifact when done** | `design_audit` word/section counts; per-route titles |

### P14 — Claims covered by tests

| | |
|--|--|
| **Promise** | Every capability this product claims is named by a test |
| **Owning row** | `u-claims-covered` (product); suite authorship `u-test-acceptance` (testwriter) |
| **Mechanism** | `.redanvil/claims.json` features inventory vs test corpus (see orchestrator `u-claims-covered.mjs`) |
| **Artifact when done** | Gate verdict pass for `u-claims-covered` with claims file present and every feature word-matched in tests |

### P15 — Deployed reality

| | |
|--|--|
| **Promise** | Production serves this app with real API output and bound services |
| **Owning rows** | `u-api-real-output`, `lg-bindings-bound` (qa-runtime); `lg-shipped` (pm) |
| **Artifact when done** | `evidence/qa-runtime-pet-sitter.json`; production URL 200; asset hash match |

---

## Ownership matrix (promise → role)

| Promise group | Primary owning row | Role |
|---------------|-------------------|------|
| Text / collection text search | `fe-search-present` | engineer |
| Filters change results | `B4` | engineer |
| Core E2E job / grid / no dead-end | `fe-product-completeness` | product |
| List/detail API bodies | `B1` | engineer |
| Not-found paths | `B3` | engineer |
| Auth + user-scoped data | `B2` | engineer |
| Assistant binding + live API | `lg-bindings-bound`, `u-api-real-output` | qa-runtime |
| Required + legal pages | `fe-required-pages`, `fe-legal-substance` | content |
| Theme | `fe-light-dark` | engineer |
| Nav / breadcrumbs | `fe-premium-nav`, `fe-breadcrumbs` | qa-visual / engineer |
| Brand mark | `fe-brand-mark` | logo |
| Desktop width / 375 / cold visitor | `fe-desktop-width`, `fe-responsive-375`, `fe-cold-visitor` | qa-visual |
| Claims named in tests | `u-claims-covered` | product |
| Acceptance suite from §9 | `u-test-acceptance` | testwriter |
| Stranger can finish the job | `product-as-stranger` | user-refuse |

No promise in the **MVP domain promises** or **Shell and trust promises** sections lacks an owning row. Beyond MVP rows are deferred and are not current promises.

---

## Success outcome (from PRD §4, product view)

- A user can complete MVP flows F1–F11 without unexpected auth walls (auth is in scope for account-scoped data).
- Every MVP §9 bullet is exercised by a named §10 test and is green.
- `GET /api/health` returns JSON including `"status":"ok"`.
- Local quality bar: `tsc`, eslint, vitest, and `npm run build` exit 0.
- Gate: `npm run gate -- pet-sitter --threshold 90` (or monorepo equivalent for this slug) score >= 90, zero tier-1 blockers.
- No stub copy in the UI; user-facing strings live in `src/i18n/en.ts`.
- The product named **Pet Sitter Finder** solves §2 for the MVP feature set alone.

---

## Non-goals (must not appear as promises)

- Payment processing, Stripe, billing
- OAuth / social login / third-party IdPs
- Multi-org or team workspaces
- Native mobile shells
- Supabase, Express, bcrypt, jsonwebtoken, Node-only globals in Worker/browser code
- Entities beyond Sitter, Pet, Booking, Review

---

## Design direction note (binding on design roles; not re-decided here)

PRD §7.3a starts from **Command canvas** + **Brutal utility** as a hypothesis. Product does not pick the final visual option. Layout must still present three structurally distinct options (`proc-design-options` / C9) before build. Product only requires that the **core job above remains primary** on the canvas: search, filters, results, detail, booking request — chrome must not bury the work.

---

## How product owns its rubric rows

### `fe-product-completeness`

Pass only when a stranger can complete the core user job and get usable output (ordered sitters, working filters, detail, path to request dates). Input-only dead ends fail. Evidence: happy-path screenshots, live API bodies, and user-refuse notes — not a description of intent.

### `u-claims-covered`

Pass only when `.redanvil/claims.json` lists every shipped capability and each claim is named by a real test file. This brief is the human map; claims.json is the machine inventory. A feature the builder skipped must fail here even if control audit and API audit see a smaller app as fine.

---

## Handoff

| Next role | Needs from this brief |
|-----------|------------------------|
| brainstorm | Rank gaps the PRD forgot; do not invent entities outside the frontmatter list |
| logo / layout | Brand and three options; keep the core job primary on the command canvas |
| testwriter | Author acceptance tests from §9 **before** engineer implements |
| engineer | Implement vertical slices Slice 0→11 for MVP; honor §7 contracts |
| content | Real legal and about pages true of this app |
| qa-* / user-refuse | Measure against promises above, not against agent summaries |

**PRD path:** `docs/pet-sitter-prd.md`  
**This brief:** `docs/pet-sitter-product-brief.md`  
)
