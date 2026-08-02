# Integrations — AZ Planting Calendar

What this app actually wires up. No invented evaluations.

- **Capability:** low-desert vegetable planting calendar (Maricopa / Cave Creek) with plantable-now, year grid, citations, and a grounded assistant
- **Target runtime:** Cloudflare Pages + Pages Functions (Workers), React 18, TypeScript strict, D1
- **Search terms:** `planting calendar`, `vegetable calendar Arizona`, `half-month grid`, `Workers AI gardening`, `D1 crop database`
- **Candidates found:** 12 (libraries and hosted APIs considered before build)

## Candidates

| repo | stars | language | licence | last push | flags |
|---|---:|---|---|---|---|
| [cloudflare/workers-sdk](https://github.com/cloudflare/workers-sdk) | 3400+ | TypeScript | MIT | active | wrangler / Pages tooling |
| [colinhacks/zod](https://github.com/colinhacks/zod) | 37000+ | TypeScript | MIT | active | request/response validation |
| [remix-run/react-router](https://github.com/remix-run/react-router) | 54000+ | TypeScript | MIT | active | SPA routing |
| [vitejs/vite](https://github.com/vitejs/vite) | 72000+ | TypeScript | MIT | active | build |
| [university of Arizona az1005 PDF](https://extension.arizona.edu/publication/vegetable-planting-calendar-maricopa-county) | n/a | PDF | educational | 2018/2024 host | source data, not a library |
| [OpenWeatherMap API](https://openweathermap.org/api) | n/a | HTTP | proprietary free tier | active | live weather / frost |
| [NOAA Climate Data Online](https://www.ncei.noaa.gov/cdo-web/) | n/a | HTTP | public | active | frost normals |
| [supabase/supabase](https://github.com/supabase/supabase) | 80000+ | TypeScript | Apache-2.0 | active | hosted Postgres + auth |
| [openai/openai-node](https://github.com/openai/openai-node) | 9000+ | TypeScript | MIT | active | assistant LLM |
| [garden.org frost](https://garden.org/apps/frost-dates/) | n/a | web | proprietary | active | frost tables only |
| [almanac.com planting calendar](https://www.almanac.com/gardening/planting-calendar) | n/a | web | proprietary | active | national planting dates |
| [ag-grid/ag-grid](https://github.com/ag-grid/ag-grid) | 15000+ | TypeScript | mixed | active | heavy grid UI |

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
- Migrations: `migrations/0001_init.sql` through zone and guide seeds
- Holds: `sources`, `zones`, `crops`, `planting_windows`, optional `crop_guides`
- All queries are parameterized; structure fragments are module-level constants, never request values.

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
| Supabase | Project rule: free-tier pauses; D1 never pauses and binds into Pages Functions |
| OpenAI / Anthropic direct | Assistant is Workers AI on Cloudflare; no extra vendor key path in the browser |
| Live weather / frost API | Out of scope; frost dates are static NOAA normals per zone row |
| Almanac planting dates | Different national dataset; not az1005 Maricopa half-month windows |
| ag-grid | Overkill for a 45×24 educational grid; CSS scroll grid is enough |
| User accounts / auth | Product is a public reference calendar |

## Connectors considered

Checked **before** searching the open web (R33). Tools already attached to the
session need no key, no signup and no quota, so they outrank anything on the
open web. Recorded even when they all lose here, because "we looked and there
was nothing" is a different claim from "we never looked".

| connector | relevant to a planting calendar? | usable as a backend? | checked | source |
|---|---|---|---|---|
| x-search (local MCP) | No — X/Twitter search, not Extension tables | No | 2026-08-02 | https://github.com/brianference/workspace/tree/main/projects/x-search-mcp-server |
| cloudflare-docs MCP | Yes — Pages/D1/Workers AI docs | Docs only | 2026-08-02 | https://developers.cloudflare.com/ |
| Expedia / Kiwi / Booking / lastminute | No — travel inventory | No | 2026-08-02 | https://claude.ai/settings/connectors |
| Viator / Tripadvisor / Resy / StubHub / Uber | No — bookings | No | 2026-08-02 | https://claude.ai/settings/connectors |
| Google Drive / Gmail / Calendar | No — planting data is D1 seed, not user files | No | 2026-08-02 | https://claude.ai/settings/connectors |
| Figma / Jam | No — design tooling, not crop data | No | 2026-08-02 | https://claude.ai/settings/connectors |

**Why none of them fit, in one line:** the product data is a character-verified
transcription of UA Extension az1005 into D1, plus static NOAA frost normals on
zone rows. No travel or productivity connector holds that table. Cloudflare
bindings (D1, Workers AI) are the runtime, not an MCP connector.

## Decision

**Build / integrate / hybrid:** hybrid — **build** the product UI and D1 seed from az1005 verification, **integrate** Cloudflare Pages + Functions + D1 + Workers AI bindings, **do not integrate** live weather, national planting calendars, or third-party auth.

**Why:** The hard problem is honest transcription and citation of a single Extension table for one low-desert county, not charting infrastructure or a multi-tenant backend. Workers AI is already on the same account as Pages; answers stay grounded in D1 so the model cannot invent windows. OpenWeather and Almanac planting APIs would mix datasets gardeners cannot audit against the cited PDF. Supabase was rejected by standing project policy (free-tier pause). Zod + parameterized D1 is the validation/query stack every other RedAnvil app uses, so reuse beats a new data layer.

## Secrets

- No planting secrets in the client.
- Workers AI and D1 use Cloudflare bindings, not browser-exposed keys.
- Local `.env` / `.dev.vars` are not committed.
