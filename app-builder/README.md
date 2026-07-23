# app-builder

Vite + React wizard that queues build jobs and saves PRDs to Cloudflare D1 via Pages Functions.

## D1 schema / migrations

Schema lives in version control under `migrations/`. The D1 binding in `wrangler.toml` sets `migrations_dir = "migrations"` so Wrangler can discover them.

Create a fresh local or remote database schema (never invent tables by hand):

```bash
# local (wrangler pages dev / miniflare D1)
npx wrangler d1 migrations apply app-builder-db --local

# remote production D1 (only when intentionally migrating prod)
npx wrangler d1 migrations apply app-builder-db --remote
```

`migrations_dir` is a standard `[[d1_databases]]` key (Workers and Pages). Applying migrations is a separate CLI step — Pages deploys do not auto-run SQL.

## Scripts

```bash
npm run dev
npm run build
npm test
npm run typecheck
npm run lint
```
