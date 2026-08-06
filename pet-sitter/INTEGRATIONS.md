# Integrations — pet-sitter

What already existed before anything was built, and what we chose to build ourselves (R29 / R33).

## Decision summary

**Build** Pet Sitter Finder on **Cloudflare Pages + Pages Functions + D1 + Workers AI**.

Do not integrate a separate BaaS, Express API server, or Node-native auth libraries. Auth is Web Crypto in the Worker. The AI assistant uses the **Workers AI binding** (`env.AI`), not a browser-side model key.

## Connectors considered

| Candidate | Role it would play | Verdict | Why |
|---|---|---|---|
| **Cloudflare Pages** | Static SPA hosting (Vite + React + TS) | **Adopt** | Required platform; edge deploy; fits RedAnvil gate |
| **Cloudflare Pages Functions** | API routes under `functions/api/*` | **Adopt** | Same deploy as the SPA; no second server |
| **Cloudflare D1** | SQL persistence for Sitter / Pet / Booking / Review | **Adopt** | Never pauses free tier for inactivity; binds as `env.DB`; parameterized SQL |
| **Cloudflare Workers AI** | Grounded assistant (`env.AI.run`) | **Adopt** | Binding only; no API key in client; fail closed on model errors |
| **Web Crypto (PBKDF2 + HMAC-SHA256)** | Password hash + session tokens | **Adopt** | Runs on Workers; no Node native addons |
| **Supabase** | Auth + Postgres + client SDK | **Reject** | Free-tier projects **pause after inactivity**, which broke production apps in this org; also outside the Cloudflare-only stack for this product |
| **Neon** | Hosted Postgres | **Reject for MVP** | Real Postgres only if approved later; D1 covers Simple CRUD tables |
| **Express / long-running Node** | Custom API server | **Reject** | Not Workers; adds process management and a second host; gate forbids it |
| **bcrypt** | Password hashing | **Reject** | Native Node module; does not run on Workers |
| **jsonwebtoken (`jws`/`jsonwebtoken`)** | JWT sessions | **Reject** | Node-oriented; Workers path is Web Crypto HMAC session cookies |
| **better-sqlite3** | Local SQL in Node | **Reject** | Native module; not available in Workers or the browser |
| **Stripe / payment processors** | Checkout and payouts | **Reject for MVP** | Explicit non-goal; booking is request-only |
| **Mapbox / Google Maps** | Map-first browse (Option B) | **Defer** | Optional after MVP; default UX is card grid without a maps SDK |
| **SendGrid / Resend / etc.** | Transactional email | **Defer** | Not required for MVP acceptance; avoid inventing integrations |
| **OAuth providers (Google, Apple)** | Social login | **Reject for MVP** | Auth scope is email/password via Web Crypto only |

## Candidates (open-source / reusable)

No third-party marketplace SaaS or pet-sitting API is licensed and runtime-fit to drop in as the product. Below are building blocks evaluated for reuse vs rewrite.

| repo | stars | language | licence | last push | checked | source | flags |
|---|---:|---|---|---|---|---|---|
| cloudflare/workers-sdk | n/a | TS | Apache-2.0 | active | 2026-08-06 | https://github.com/cloudflare/workers-sdk | Chosen runtime |
| colinhacks/zod | high | TS | MIT | active | 2026-08-06 | https://github.com/colinhacks/zod | Adopt boundary validation |
| vitejs/vite | high | TS | MIT | active | 2026-08-06 | https://github.com/vitejs/vite | Adopt SPA toolchain |
| facebook/react | high | TS | MIT | active | 2026-08-06 | https://github.com/facebook/react | Adopt SPA UI |
| microsoft/playwright | high | TS | Apache-2.0 | active | 2026-08-06 | https://github.com/microsoft/playwright | Adopt acceptance harness |
| supabase/supabase-js | high | TS | Apache-2.0 | active | 2026-08-06 | https://github.com/supabase/supabase-js | Reject hosting model |
| expressjs/express | high | JS | MIT | active | 2026-08-06 | https://github.com/expressjs/express | Reject long-lived Node server |
| dcodeIO/bcrypt.js | high | JS | MIT | active | 2026-08-06 | https://github.com/dcodeIO/bcrypt.js | Reject; Web Crypto instead |
| auth0/node-jsonwebtoken | high | JS | MIT | active | 2026-08-06 | https://github.com/auth0/node-jsonwebtoken | Reject; HMAC session cookies |

Star counts move constantly; the decision is driven by **Workers runtime fit** and **org platform rules**, not star rank.

## Decision

**Build / integrate / hybrid:** **Build** on Cloudflare (Pages + Functions + D1 + Workers AI) with **integrate** limited to open tools that run in that environment (Zod, Vite, React, Playwright). **No hybrid BaaS.**

**Why:**

1. **Runtime parity.** Pages Functions run on the Workers runtime. Anything that needs `process`, `Buffer`, native addons, or a always-on Node process fails production even if unit tests pass in Node.
2. **Persistence without pause.** D1 does not hard-pause the project after a week of idle traffic the way Supabase free tier has. That failure mode is an explicit org ban on Supabase for new and existing work.
3. **Auth without Node crypto packages.** PBKDF2 + HMAC-SHA256 via Web Crypto is documented, auditable, and Worker-safe.
4. **Assistant without secret sprawl.** Workers AI is a binding (`env.AI`), so the browser never holds a model key. Failures surface as error states.
5. **Scope match.** Domain is Simple D1 tables for Sitter, Pet, Booking, Review — not a multi-tenant SaaS data plane that would justify Neon on day one.
6. **Non-goals stay non-goals.** Payments, OAuth, Express, and maps SDKs would expand surface area past the PRD without unblocking search, filter, detail, or booking request.

**Revisit when:**

- Product needs **multi-region relational features** D1 cannot express cleanly → re-evaluate **Neon** with an explicit approval.
- MVP booking request is green and owners demand **checkout** → evaluate Stripe (or similar) as a named later epic, not a silent add.
- Map-first browse is prioritized after Option A ships → evaluate Mapbox/Google with cost and privacy review.
- Email confirmation of booking requests becomes an acceptance criterion → pick one transactional mail provider and document it here before wiring secrets.

## What we will not reinvent

- Password hashing primitives (use Web Crypto PBKDF2, do not invent a KDF).
- SQL engine (D1 / SQLite dialect).
- Model hosting (Workers AI binding).
- Browser test runner (Playwright + project harness scripts).

## What we will write ourselves

- Domain schema and migrations (`migrations/`).
- Pages Function handlers with Zod boundaries and parameterized D1 queries.
- Session cookie issue/verify helpers in `functions/lib/`.
- SPA routes, search/filter UI, sitter detail, booking request, theme shell.
- Assistant route that loads sitters context from D1 and calls `env.AI`.
