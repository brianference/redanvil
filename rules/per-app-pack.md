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
- **Never put untrusted data into `href` or remote `src` without scheme validation.** A `javascript:` (or `data:`, protocol-relative `//evil`, whitespace/case-tricked scheme) URI in a data field executes on click. Use the shared `safeHttpUrl` / `safeHref` helpers (scaffolded as `src/lib/safeHttpUrl.ts`, canonical copy in monorepo `design-system/safeHttpUrl.ts`) or `SafeExternalLink`. When validation fails, render **no** anchor — not a dead link and not the raw value. Gated by `u-sec-safe-href`.

## Required pages and SEO

- Every app ships: Home, About, Terms and Conditions, Privacy Policy, Contact.
- Full SEO: title/description per route, Open Graph tags, a real OG image, sitemap, robots.txt, semantic headings.

## Standard features (every app)

These ship with every generated app. The gate scores them as blockers (`fe-search-present`, `fe-assistant-present`); a 90+ score without both is a hole, not a pass.

- **Text search on every browsable collection.** A collection nobody can search is a list, not a product. The collection view must expose a **text** input whose accessible name matches `/search|find/i` (a bare `<select>` filter is not text search). The gate drives the live app with Playwright and requires the result count to strictly decrease after a known-subset query. If a collection API takes `q`/`search`/`query`, that param must change the response. A search box that renders and does nothing is worse than none. n/a only when the app has no collection route at all.
- **AI assistant grounded in the app's own data.** An app that cannot answer a question about its own data makes the user do the reading. Ship a chat affordance reachable from the shell and a Worker endpoint (`functions/api/assistant.ts` or similar) that calls a model and grounds the answer in the app's database — not general knowledge, not a canned stub. **Cloudflare Workers AI is the default binding** (`env.AI.run` in the Worker, never in the browser). QuickFlight's `functions/api/assistant.ts` is a working reference — read it before writing a new one. The assistant reads its binding from env; no secrets in code. A failed model call must surface an error state, not an empty success. n/a only when the app genuinely has no queryable domain data.

## UI baseline

- Follow the mobile-ux design rules in `/design-system/mobile-design-rules.md` (leveled must/should/prefer: touch targets, safe areas, 16px body floor, non-color state, loading/empty/error, sticky-CTA safe-area padding, anti-patterns) and the layout recipes in `/design-system/screen-patterns.md`. When delegating UI to Grok Build, inject those rules and build 2-3 variants before polishing. Also available as the `mobile-ux` skill.

## Premium site/app requirements (enforced)

- Light AND dark mode with a visible theme toggle. Every color comes from semantic tokens that resolve per theme; default follows the system, and the choice persists. Both themes pass WCAG AA and get a visual review.
- Premium navigation: a polished sticky top nav with the brand mark and primary links that have clear hover and active states, not bare text links. Overflow goes in a menu. On inner/detail pages show breadcrumbs.
- Professional, organized footer (multi-column) and a clean, prominent header logo (a real brand mark, not an emoji).
- The full app checklist: register/login where the app needs accounts (Web Crypto), search + detail pages where relevant, loading/error/empty states, confirmation before destructive actions, responsive with no overlapping text at 375px, the required pages (Home, About, Terms, Privacy, Contact) with full SEO (sitemap, OG image, JSON-LD), and no "made with" attribution text.
- All user-facing copy follows the Human Writing Guidelines: no banned words, `--` not unicode em-dashes (max 2 per page), sentence-case headings, plain direct wording. This applies to the app UI, the README, and release notes.
- Real brand logo and OG/social image, generated via Grok Imagine (the grok CLI `image_gen` tool) or a hand-authored SVG mark — never an emoji or placeholder icon. Visually review every generated image before shipping it.
- Clean, modern, responsive, mobile-first. Sticky header. Organized professional footer.
- No overlapping text at 375px. Verified at 375 / 768 / 1280. An ellipsis is not overflow: a truncated label still fails, and only a rendered screenshot shows it.

## Desktop width (blocker)

- Every route's **painted content** occupies at least **80% of the viewport** at both 1440 and 1920. Measure what is drawn — text via its own client rects, plus anything painting a background/border/shadow — **never a container box**. A `div` or `h1` is 100% wide by default, so measuring the container reports ~93% for a page whose content sits in the left third. That mistake hid four narrow pages in RedAnvil's own apps.
- **No `maxWidth` cap in a JS style object.** Width belongs in a CSS class where a media query can lift it; an inline style beats a class, so an inline cap is unliftable by definition. (`100%` is fine — it caps nothing. A fixed `width` on an icon, badge or 1px divider is fine. `minWidth: 0` is the flex/grid shrink idiom and is fine.) Enforced by `fe-no-inline-width`.
- Protect the line measure with **column counts, never by starving the container** — and let the column count follow the CONTENT (a `:has()` quantity query), or a page with two sections leaves an empty third column and reads as 60% of the screen.

## Design direction

- Constraints are not a design. This rule pack is identical for every app, so following only these produces the same centred column under a sticky header every time. The PRD's **§7.3a Design direction** names a layout archetype and a visual direction for THIS app, and it is binding — build that, and do not fall back to the shells it rules out.
- A reference implementation of these rules is not a template. Do not reproduce RedAnvil's own shell, palette or component structure.
- Theme tokens only (see `/design-system`); WCAG AA contrast; confirmation before destructive actions.
- Loading, error, and empty states on every screen; no failure rendered as a clean empty success.
- **A first-time visitor gets a working app.** Verified with NOTHING forced -- no theme assigned, no storage primed, no route seeded, only an emulated operating-system preference. The default theme follows the system (a stored choice still wins), the primary flow returns a real result for an input nobody seeded, and the console is clean on arrival. `scripts/cold-visitor.mjs` ships with the app and is scored by `fe-cold-visitor`.

  This exists because every other check sets up the state it then measures: the accessibility audit assigns the theme before it looks, the acceptance suite seeds the route it searches, the control audit crawls a page already populated. Each is right for its own purpose, and together they left nothing observing arrival. Two defects shipped through that gap -- a light theme served to every visitor whose OS asked for dark, and a search that answered an empty list for almost any route a person would type. Both were found by a human opening the site.
