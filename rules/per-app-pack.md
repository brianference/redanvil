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

- Follow the mobile-ux design rules in `/design-system/mobile-design-rules.md` (leveled must/should/prefer: touch targets, safe areas, 16px body floor, non-color state, loading/empty/error, sticky-CTA safe-area padding, anti-patterns) and the layout recipes in `/design-system/screen-patterns.md`. When delegating UI to Grok Build, inject those rules and build 2-3 variants before polishing. Also available as the `mobile-ux` skill.
- Real brand logo and OG/social image, generated via Grok Imagine (the grok CLI `image_gen` tool) or a hand-authored SVG mark — never an emoji or placeholder icon. Visually review every generated image before shipping it.
- Clean, modern, responsive, mobile-first. Sticky header. Organized professional footer.
- No overlapping text at 375px. Verified at 375 / 768 / 1280.
- Theme tokens only (see `/design-system`); WCAG AA contrast; confirmation before destructive actions.
- Loading, error, and empty states on every screen; no failure rendered as a clean empty success.
