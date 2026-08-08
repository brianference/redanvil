# Product brief — sushi-finder

Derived from `docs/PRD.md` by `roles/product.mjs`. Extraction only: nothing here
is invented, and a section the PRD does not contain is recorded as a gap rather
than filled in with plausible prose.

## Who it is for and the problem

A worldwide sushi finder: discover sushi restaurants near you or in any city, vs conveyor vs counter style, price band, whether they take walk-ins, and real reviews. Browse by photos, by map, or by when a seating is available.

Users need a single, citable reference for by photos — not a spreadsheet they rebuild each season, and not invented sample data. The app exists so the stated windows and criteria are visible end-to-end.

## What it does

The app solves the problem with a marketplace built on Cloudflare Pages (Vite + React + TypeScript SPA), Pages Functions for the API, and Cloudflare D1 for persistence (Simple D1 tables (CRUD + parameterized queries)). Domain entities in scope: **Sushi**. The product is fully public — no register/login, no session middleware, no user-owned scoping. Users complete MVP flows (F1, F2, F3, F4, F5, F6, F7, F8, F9) first: browse and manage the primary entity, open detail, and use the app anonymously. Each capability is delivered as a vertical slice (DB + API + UI + tests) so something works end-to-end after every slice, not only at the end of a horizontal phase plan.

## The one flow that must work

- As a **by photos user**, I want **by Photos grid**, so that **Users open a calendar grid or half-month window view of by photos. Criteria: photos; by map; or by when a seating is available. Seed vs transplant (or equivalent method markers) are visible when the dataset carries them**.
- As a **by photos user**, I want **filter by photos**, so that **The criteria named in the request are real filter controls, including filter by month when month is named: photos; by map; or by when a seating is available**.
- As a **by photos user**, I want **by Photos detail**, so that **Opening a by photos shows its detail: every related planting window, days to harvest (or equivalent metrics), notes, and source citations when present**.
- As a **by photos user**, I want **browse & search Sushi**, so that **Users can open the sushis list, search by title, and see matching rows or an empty state**.
- As a **by photos user**, I want **sushi detail**, so that **Clicking a list row opens the full Sushi record with title, description, and a back link**.
- As a **by photos user**, I want **public access**, so that **No login required; all product pages and APIs are public**.
- As a **by photos user**, I want **manage Sushi**, so that **Create, edit, and delete sushis with confirmation before delete**.
- As a **by photos user**, I want **search and filter Sushi**, so that **Users can search or filter the sushis collection with a control whose accessible name matches /search|find|filter/i; the query must narrow the visible results (a decorative box fails)**.
- As a **by photos user**, I want **ask the assistant about Sushi**, so that **A chat affordance reachable from the shell posts to functions/api/assistant.ts (or equivalent). The Worker calls Cloudflare Workers AI (env.AI) and grounds the

## What success looks like

Definition of done — observable, checkable statements (not aspirations):

- A user can complete the MVP flows (F1, F2, F3, F4, F5, F6, F7, F8, F9) without auth walls unless auth is in scope.
- Every MVP acceptance bullet under §9 is exercised by a named test in §10 and is green.
- `GET /api/health` returns JSON including `"status":"ok"` on a local Pages Functions serve.
- `npx tsc --noEmit`, `npx eslint . --max-warnings 0`, `npx vitest run`, and `npm run build` all exit 0.
- From monorepo root, `npm run gate -- by-photos --threshold 90` reports score >= **90** with zero tier-1 blockers.
- No incomplete stub copy remains in the product UI; all user-facing strings live in `src/i18n/en.ts`.
- The product named **By Photos** solves the problem stated in §2 for the MVP feature set alone.

## Explicitly out of scope

- Do not invent domain entities beyond the frontmatter list: **Sushi**.
- **No authentication** — every route is public; do not add register/login, sessions, or user-owned scoping.
- No payment processing, billing, or third-party integrations unless the mission names them (no Stripe, no vault, no secret files in the repo).
- No deploy automation inside the app itself (no CI push-to-prod buttons, no wrangler deploy from client code).
- **Single-tenant** — no multi-org, team workspaces, or tenant isolation layers.
- No Supabase, Express, bcrypt, or jsonwebtoken (Workers-incompatible).
- No Node-only globals (`process`, `Buffer`) or native modules (`better-sqlite3`) in Worker/browser code.
- No native mobile shell — full-stack web (Cloudflare Pages) only.

## Design direction — binding

The constraints in §7.3 are identical for every app RedAnvil generates. They are not a
design. This section is, and it is **binding**: an implementation that satisfies every
constraint while looking like a generic centred column under a sticky header has not built
this spec.

---

Source: `docs/PRD.md` (48887 chars), generated by the deployed RedAnvil
app-builder. See `docs/prd-provenance.json` for the wizard answers that produced it.
