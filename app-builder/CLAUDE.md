# app-builder — build rules (inherited from RedAnvil corpus 1.0.0)

# Base rules (v1.0.0)

The core of the standard. A diff that honors these rarely trips the detailed lanes. This block is injected as the SessionStart summary for every RedAnvil run.

1. Strict typing everywhere: mypy strict, tsc strict, zero `any`, no untyped defs.
2. Concise, reviewable code: the smallest diff that does the job; no padding, no speculative abstraction, no line that does what one clear line can.
3. Use what exists before writing or adding anything: stdlib, then framework, then shared library; a new dependency is a reviewable event.
4. Comments explain why, never what; every TODO carries a ticket.
5. Fail closed with typed errors; never swallow exceptions broadly.
6. Never log secrets or PII; never commit keys, binaries, or copy-paste duplication.
7. Tests assert the change, not just exist; behavior over implementation.
8. Small, single-purpose files and functions, sized from the corpus norm.
9. A shared library's public API is a contract: deprecation alias or version bump, never a silent break.
10. Security is structural: allowlisted JWT validation, parameterized SQL, explicit timeouts, no stubbed auth paths, SAST clean.
11. Frontend: theme tokens only, central style sheet, pages compose named components, all copy in the locale bundle, WCAG AA.
12. CI workflows: SHA-pinned actions, least-privilege permissions, no injection surfaces.
13. PR discipline: ticket-prefixed title, conventional commits, full local suite before push.
14. When the surrounding file uses an older idiom, a minimal diff matches it; consistency beats a style island.
15. Validate every input at the boundary and fail closed everywhere: unknown or partial state is an explicit error, in code and on screen; silent success is forbidden.


# Per-app rule pack (v1.0.0)

Injected into every app RedAnvil generates, on top of the base-15 and the rubric lanes. Scaffolded into the app's own `CLAUDE.md`, scored by the gate, and injected into every build session.

## Platform

- Cloudflare Pages + Pages Functions for the backend. No Express, no long-running Node server.
- Cloudflare D1 for the database. No Supabase. Neon only if real Postgres is genuinely required and approved.
- Auth via Web Crypto: PBKDF2 for password hashing, HMAC-SHA256 for session tokens. No `bcrypt`, no `jsonwebtoken` — both are native Node modules that do not run on Workers.
- No Node-only globals (`process`, `Buffer`) or native modules (`better-sqlite3`) in Worker or browser code. Runtime parity is gated.

## Data and secrets

- Real data only. No dummy, fake, placeholder, or lorem ipsum content. Seed from real examples.
- Secrets in `.env` / Cloudflare secrets only, never in code, config, or output. `.env` gitignored.
- All inputs validated with Zod at the boundary; parameterized D1 queries only.

## Required pages and SEO

- Every app ships: Home, About, Terms and Conditions, Privacy Policy, Contact.
- Full SEO: title/description per route, Open Graph tags, a real OG image, sitemap, robots.txt, semantic headings.

## UI baseline

- Clean, modern, responsive, mobile-first. Sticky header. Organized professional footer.
- No overlapping text at 375px. Verified at 375 / 768 / 1280.
- Theme tokens only (see `/design-system`); WCAG AA contrast; confirmation before destructive actions.
- Loading, error, and empty states on every screen; no failure rendered as a clean empty success.

