# Sources — RedAnvil Dashboard

Retrieval / verification date: **2026-08-03**.

## Data source (the only external input this app has)

| Field | Value |
| --- | --- |
| What it is | `results/all.json` in this repository, built by `.github/scripts/build_feed.mjs` from the per-app result files RedAnvil's own gate writes (`results/<slug>.json`) |
| Fetched from | `https://raw.githubusercontent.com/brianference/redanvil/master/results/all.json` (`dashboard/src/lib/useRuns.ts`) |
| Producer | This repository's own gate run (`node .github/scripts/reverify.mjs`), not a third-party API |
| Update mechanism | Every commit that changes a `results/*.json` file and pushes to `master`; `build_feed.mjs --check` in CI fails the build if the committed feed does not match a fresh rebuild from the per-app files, so the two cannot drift silently |
| Shape verified | `kind: "results"`, `slug`, `finalScore`, `threshold`, `passed`, `evaluated`, `total`, `rules[]` — read directly from `results/dashboard.json` and `results/all.json` in this repo on 2026-08-03 |

There is no second data source. The dashboard is a read-only view of gate output
that already lives in this repository; it does not call a hosted API, a
database, or any third-party service.

## What is NOT a source

- No live polling of GitHub Actions, Cloudflare, or any deploy provider — the
  dashboard only ever reads the committed JSON feed.
- No user accounts, telemetry, or analytics endpoint. There is nothing for a
  visitor to authenticate against, so there is no user data source to document.
- No invented or interpolated run history. A run that is not in `results/*.json`
  does not appear; the empty state (`en.pages.home.empty`) renders instead of a
  fabricated placeholder card.

## Why a feed file instead of a live API

The gate already produces the result files as its own durable output
(`results/<slug>.json`, aggregated into `results/all.json`). Standing up an API
to re-serve data that is already sitting in the repo as static JSON would be a
second copy of the same information with its own staleness and failure modes,
for a dashboard that has exactly one reader (a public, read-only status page).
`raw.githubusercontent.com` already serves static files over HTTPS with caching,
which is what this need actually is.
