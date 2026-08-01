# AZ Planting Calendar

Arizona low-desert planting calendar for home gardeners. Default zone: **Cave Creek AZ 85331** (Maricopa County).

Answers: **what can I plant right now, and as seed or transplant?**

## Stack

- Vite + React + TypeScript (strict)
- Cloudflare Pages + Pages Functions + D1
- Zod at request/response boundaries
- Vitest unit tests + Playwright acceptance tests

## Data

Planting windows are sourced from the University of Arizona Cooperative Extension publication:

- **Vegetable Planting Calendar for Maricopa County** (az1005), Kai Umeda  
- HTML table with **text** month headers:  
  https://extension.arizona.edu/publication/vegetable-planting-calendar-maricopa-county

We do not invent or estimate dates. Re-generate seed SQL with:

```bash
node scripts/generate-seed.mjs
```

## Local development

```bash
npm install
npm run build
npx wrangler d1 migrations apply az-planting-calendar --local
npx wrangler pages dev dist --port 8788 --ip 127.0.0.1
```

- App: http://127.0.0.1:8788/
- Health: http://127.0.0.1:8788/api/health → `{"status":"ok"}`

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run build` | Typecheck + Vite build → `dist/` |
| `npm test` | Vitest unit tests |
| `npx playwright test` | Acceptance tests (starts wrangler pages dev) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck only |

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | `{ "status": "ok" }` |
| GET | `/api/plantable?date=YYYY-MM-DD&method=S\|T` | Crops plantable in that half-month |
| GET | `/api/grid?method=&month=` | Full-year S/T grid |
| GET | `/api/crops?q=` | Crop list (optional name search) |
| GET | `/api/crops/:id` | Crop detail + citations |
| GET | `/api/zone` | Default zone metadata |
