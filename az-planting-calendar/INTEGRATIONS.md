# Integrations — AZ Planting Calendar

What this app actually wires up. No invented evaluations.

## Cloudflare Pages

- Static SPA (`vite build` → `dist/`) served as a Pages project.
- `wrangler.toml`: `pages_build_output_dir = "dist"`, `compatibility_date = "2025-07-18"`.
- Local preview: `wrangler pages dev ./dist` (see `package.json` `preview` and Playwright `webServer`).

## Cloudflare Pages Functions

- API under `functions/api/*` (health, plantable, grid, crops, zone(s), assistant).
- Shared helpers in `functions/lib/` (D1 access, dates, HTTP headers).
- Middleware in `functions/_middleware.ts` ensures unmatched `/api/*` paths return JSON 404 (not SPA HTML).

## Cloudflare D1

- Binding: `DB`
- Database name: `az-planting-calendar`
- Migrations: `migrations/0001_init.sql`, `0002_seed.sql`, `0003_schema_gaps.sql`, `0004_zones_maricopa.sql`
- Holds: `sources`, `zones`, `crops`, `planting_windows`
- All queries are parameterized; no string-concatenated SQL for user input.

## Cloudflare Workers AI

- Binding: `AI`
- Model id: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- Why this model: `@cf/meta/llama-3.1-8b-instruct` was deprecated and returned AiError 5028 in this project; the 3.3 70b fp8-fast id was verified working for filter extraction.
- Use: map a free-text gardening question to JSON filters only; **answers are built in code from D1 rows**, not from model prose.
- Fail-closed: missing AI binding → 503; model failure → 502; invalid model JSON → 422.

## Client libraries

| Package | Role |
| --- | --- |
| React 18 + react-router-dom 6 | UI and routing |
| Zod | Shared request/response validation (client + Functions) |
| Vite 5 | Build |
| Vitest | Unit tests |
| Playwright + axe-core | Acceptance and a11y |

## Considered and not used

| Option | Why not |
| --- | --- |
| Supabase | Project rule: free-tier pauses; not used on this app |
| OpenAI / Anthropic direct | Assistant is Workers AI on Cloudflare; no extra vendor key path |
| Weather / frost live API | Out of scope; frost dates are static NOAA normals per zone |
| User accounts / auth | Product is a public reference calendar |

## Secrets

- No planting secrets in the client.
- Workers AI and D1 use Cloudflare bindings, not browser-exposed keys.
- Local `.env` / `.dev.vars` are not committed (and were not required for the local D1 migrations in this pass).
