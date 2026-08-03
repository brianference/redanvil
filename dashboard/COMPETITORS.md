# Competitors — RedAnvil Dashboard

Inspected structure (2026-08-03). This is a build/quality-gate status page, so
the comparison set is CI status pages and dashboarding tools, not other
"dashboard" products in the generic sense. Every factual claim below is either
directly observable in this repository or cited to a primary source.

## 1. GitHub Actions — repo Actions tab

- **URL pattern:** `github.com/<owner>/<repo>/actions`
- **Structure:** Per-repo list of workflow runs with status icon (success/
  failure/in-progress), commit, branch, duration; drilling into a run shows
  per-job logs.
- **Strengths:** Zero setup — it is the CI system itself. Always current, no
  separate feed to keep in sync.
- **Gaps for this use case:** Shows CI pass/fail, not a quality-gate score.
  There is no per-rule rubric view (typing, tests, legal pages, structured
  data, …), no cross-app KPI roll-up, and it requires a GitHub account to
  browse a private repo's Actions tab — this dashboard is meant to be a public,
  no-login status page.

## 2. Grafana (self-hosted or Grafana Cloud)

- **URL:** https://grafana.com
- **Structure:** Panels/dashboards over a time-series or SQL data source
  (Prometheus, InfluxDB, Postgres, …); widely used for CI metrics when a
  pipeline exports build duration, pass rate, or coverage as time series.
- **Strengths:** Mature, general-purpose, real alerting and time-series
  drilldown; AGPL-3.0 open source since 2021 ([grafana/grafana LICENSE,
  GitHub](https://github.com/grafana/grafana/blob/main/LICENSE); [Grafana
  Labs licensing
  page](https://grafana.com/licensing/)), or Grafana Cloud (hosted).
- **Gaps for this use case:** Requires standing up and maintaining a data
  source and exporter pipeline. This app's entire dataset is one committed
  JSON file (`results/all.json`) with no time-series shape yet (one row per
  app, not per run-over-time) — adopting Grafana today would mean building the
  metrics pipeline this dashboard doesn't have, to render data it can already
  render directly.

## 3. Cloudflare Pages / Vercel deployment dashboards

- **URL pattern:** Cloudflare Pages project dashboard; Vercel project overview.
- **Structure:** Per-deployment list with build status, preview URL, commit,
  and duration, scoped to that one hosting provider's own deployments.
- **Strengths:** Built into the host already used for this app's deploys; no
  extra infrastructure.
- **Gaps:** Shows "did the build succeed," not "did the app clear a 90-point
  quality bar across typing, tests, legal content, SEO, and accessibility."
  Each app in this repo deploys to its own Pages project, so there is no
  cross-app roll-up view there either.

## 4. Shields.io style status badges

- **URL pattern:** `img.shields.io/badge/...`, often embedded in a README
  ([badges/shields, GitHub](https://github.com/badges/shields): "Concise,
  consistent, and legible badges in SVG and raster format").
- **Structure:** A single badge image (pass/fail, version, coverage %).
- **Strengths:** Trivial to embed anywhere; no hosting of your own.
- **Gaps:** One number, no drilldown, no history, no per-app comparison — the
  opposite end of the spectrum from Grafana, and too shallow for "which of our
  four apps needs work and on which rule."

## Assessment

### What this dashboard needs that the alternatives miss

1. **A quality-gate score per app**, not a CI pass/fail bit — RedAnvil's own
   79-rule rubric, not GitHub's binary workflow status.
2. **A public, no-login view** — a status page anyone can open, not a
   provider dashboard gated behind repo or project membership.
3. **Cross-app comparison** — one KPI strip across every app this repo builds,
   not four separate provider dashboards to tab between.
4. **Zero new infrastructure** — reading the gate's own committed JSON output
   is simpler than exporting metrics into a time-series database for a
   four-app portfolio.

### How this app positions

| Need | This dashboard | GitHub Actions | Grafana | Host deploy dashboard | Badges |
| --- | --- | --- | --- | --- | --- |
| Per-rule gate score | Yes | No | Possible, needs pipeline | No | No |
| Public, no login | Yes | No (private repos) | Depends on hosting | No | Yes |
| Cross-app roll-up | Yes | No | Possible, needs pipeline | No | No |
| Zero extra infra | Yes | Yes | No | Yes | Yes |
| Run history over time | No (yet) | Yes | Yes | Yes | No |

### Work list (product, not marketing filler)

1. `results/all.json` is currently one row per app (latest run only), not a
   time series — a "score over time" view is the natural next capability, and
   is exactly where Grafana would be re-evaluated (see below).
2. Keep the feed derived, not hand-edited: `build_feed.mjs --check` in CI is
   the guard that keeps this file's only real advantage (fidelity to the gate's
   own output) from rotting.
3. Prior-art docs (`SOURCES.md`, `INTEGRATIONS.md`, this file) stay in-repo so
   `fe-prior-art` can score evidence and conclusions, not just their existence.

### Features and controls we are missing

| Missing control | Competitor that has it | Plan |
| --- | --- | --- |
| Run history / trend line per app | Grafana, GitHub Actions | Deferred until `results/*.json` carries more than the latest run; adding a chart now would be speculative (see `INTEGRATIONS.md`) |
| Alerting on regression | Grafana | Out of scope — this is a read-only status page, not a monitoring system with on-call routing |
| Per-job log drilldown | GitHub Actions | Out of scope — the gate's own rule list is the drilldown unit here, not raw CI logs |
| Embeddable single-metric badge | Shields.io | Could add later as a static SVG per app; not built because nothing currently links to it |

### Components worth borrowing

- **GitHub Actions' status-icon-first list row:** a glanceable pass/fail icon
  before any text, mirrored in this app's run cards (status badge leads the
  card, not a paragraph).
- **Grafana's KPI-tile-above-detail layout:** summary numbers first, drilldown
  below — the same "Metric board" archetype this app's `design.archetype`
  already records.

### What we deliberately will not do

- **Will not** stand up a time-series database or exporter pipeline before the
  data justifies it — that is the speculative-abstraction failure mode
  `INTEGRATIONS.md` already ruled out for charting.
- **Will not** require login. A public build-status page loses its main value
  (anyone can check it) the moment it is gated.
- **Will not** hand-edit `results/all.json` to make a number look better; the
  feed is derived and CI-checked specifically so that cannot happen quietly.
