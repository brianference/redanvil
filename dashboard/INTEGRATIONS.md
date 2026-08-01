# Integration scan — render RedAnvil gate run results as a dashboard: score history, per-rule outcomes, coverage trend and deploy links

Ran before building. **Reuse beats rebuild**, but only when the licence, the
runtime and the maintenance status all hold — so each candidate is recorded with
those facts and a verdict, not just a link.

- **Capability:** render RedAnvil gate run results as a dashboard: score history, per-rule outcomes, coverage trend and deploy links
- **Target runtime:** Cloudflare Pages + Pages Functions (Workers runtime), React 18, TypeScript strict
- **Search terms:** `chart`, `dashboard`, `data table`, `csv`, `sparkline`, `date formatting`
- **Candidates found:** 34

## Candidates

| repo | stars | language | licence | last push | flags |
|---|---:|---|---|---|---|
| [d3/d3](https://github.com/d3/d3) | 113311 | Shell | ISC | 2026-05-28 | - |
| [PanJiaChen/vue-element-admin](https://github.com/PanJiaChen/vue-element-admin) | 90236 | Vue | MIT | 2024-10-24 | - |
| [nexu-io/open-design](https://github.com/nexu-io/open-design) | 82920 | TypeScript | Apache-2.0 | 2026-08-01 | - |
| [koala73/worldmonitor](https://github.com/koala73/worldmonitor) | 77445 | TypeScript | NOASSERTION | 2026-08-01 | licence unclear |
| [grafana/grafana](https://github.com/grafana/grafana) | 75895 | TypeScript | AGPL-3.0 | 2026-08-01 | - |
| [strapi/strapi](https://github.com/strapi/strapi) | 72759 | TypeScript | NOASSERTION | 2026-07-31 | licence unclear |
| [chartjs/Chart.js](https://github.com/chartjs/Chart.js) | 67618 | JavaScript | MIT | 2026-05-27 | - |
| [apache/echarts](https://github.com/apache/echarts) | 66944 | TypeScript | Apache-2.0 | 2026-07-29 | - |
| [pi-hole/pi-hole](https://github.com/pi-hole/pi-hole) | 60149 | Shell | NOASSERTION | 2026-07-27 | licence unclear |
| [metabase/metabase](https://github.com/metabase/metabase) | 48472 | Clojure | NOASSERTION | 2026-08-01 | licence unclear |
| [AykutSarac/jsoncrack.com](https://github.com/AykutSarac/jsoncrack.com) | 44268 | TypeScript | Apache-2.0 | 2026-06-15 | - |
| [hugohe3/ppt-master](https://github.com/hugohe3/ppt-master) | 42199 | Python | MIT | 2026-07-31 | - |
| [PhilJay/MPAndroidChart](https://github.com/PhilJay/MPAndroidChart) | 38190 | Java | NOASSERTION | 2025-06-05 | licence unclear |
| [SheetJS/sheetjs](https://github.com/SheetJS/sheetjs) | 36308 | ? | Apache-2.0 | 2024-04-18 | stale |
| [liquidslr/leetcode-company-wise-problems](https://github.com/liquidslr/leetcode-company-wise-problems) | 27637 | ? | none | 2026-06-26 | licence unclear |
| [sinaptik-ai/pandas-ai](https://github.com/sinaptik-ai/pandas-ai) | 23679 | Python | NOASSERTION | 2025-10-28 | licence unclear |
| [handsontable/handsontable](https://github.com/handsontable/handsontable) | 21997 | JavaScript | NOASSERTION | 2026-07-31 | licence unclear |
| [modood/Administrative-divisions-of-China](https://github.com/modood/Administrative-divisions-of-China) | 20908 | JavaScript | WTFPL | 2025-12-27 | - |
| [dream-num/Luckysheet](https://github.com/dream-num/Luckysheet) | 16655 | JavaScript | MIT | 2025-08-19 | archived |
| [mikefarah/yq](https://github.com/mikefarah/yq) | 15767 | Go | MIT | 2026-07-09 | - |
| [ag-grid/ag-grid](https://github.com/ag-grid/ag-grid) | 15512 | TypeScript | NOASSERTION | 2026-07-31 | licence unclear |
| [nicobailon/visual-explainer](https://github.com/nicobailon/visual-explainer) | 9382 | HTML | MIT | 2026-06-25 | - |
| [tabulator-tables/tabulator](https://github.com/tabulator-tables/tabulator) | 7735 | JavaScript | MIT | 2026-07-21 | - |
| [hustcc/timeago.js](https://github.com/hustcc/timeago.js) | 5373 | TypeScript | MIT | 2026-06-30 | - |
| [borisyankov/react-sparklines](https://github.com/borisyankov/react-sparklines) | 2851 | JavaScript | MIT | 2024-09-21 | - |
| [formkit/tempo](https://github.com/formkit/tempo) | 2589 | TypeScript | MIT | 2026-07-01 | - |
| [graphieros/vue-data-ui](https://github.com/graphieros/vue-data-ui) | 2428 | Vue | MIT | 2026-07-30 | - |
| [aftertheflood/sparks](https://github.com/aftertheflood/sparks) | 2395 | CSS | OFL-1.1 | 2023-09-21 | stale |
| [araddon/dateparse](https://github.com/araddon/dateparse) | 2144 | Go | MIT | 2023-12-30 | stale |
| [taylorhakes/fecha](https://github.com/taylorhakes/fecha) | 2067 | JavaScript | MIT | 2023-01-05 | stale |
| [vercel/little-date](https://github.com/vercel/little-date) | 1962 | TypeScript | MIT | 2025-11-24 | - |
| [microsoft/microsoft-pdb](https://github.com/microsoft/microsoft-pdb) | 1931 | C++ | NOASSERTION | 2023-04-27 | archived, stale, licence unclear |
| [romeovs/creep](https://github.com/romeovs/creep) | 1901 | Vim script | MIT | 2021-07-12 | stale |
| [robinhood/spark](https://github.com/robinhood/spark) | 1275 | Java | Apache-2.0 | 2023-11-23 | stale |

## Connectors considered

Checked **before** searching the web (R33). Tools already attached to the session
need no key, no signup and no quota, so they outrank anything on the open web.
Recorded even though they all lose here, because "we looked and there was
nothing" is a different claim from "we never looked".

| connector | relevant to a gate-results dashboard? | usable as a backend? | checked | source |
|---|---|---|---|---|
| x-search (local MCP) | No — X/Twitter search; this app renders gate runs | No | 2026-07-31 | [local MCP server](https://github.com/brianference/workspace/tree/main/projects/x-search-mcp-server) |
| Expedia, Kiwi.com, Booking.com, lastminute.com | No — travel inventory | No | 2026-07-31 | [claude.ai connectors](https://claude.ai/settings/connectors) |
| Viator, Tripadvisor, Resy, StubHub, Uber, Uber Eats | No — bookings and reservations | No | 2026-07-31 | [claude.ai connectors](https://claude.ai/settings/connectors) |
| Google Drive, Gmail, Google Calendar | No — the results feed is committed to this repo, not stored in a user's account | No | 2026-07-31 | [claude.ai connectors](https://claude.ai/settings/connectors) |
| Figma, Jam | No — design and bug-capture tooling, not a data source | No | 2026-07-31 | [claude.ai connectors](https://claude.ai/settings/connectors) |
| S&P Global, Scite | No — financial and citation data | No | 2026-07-31 | [claude.ai connectors](https://claude.ai/settings/connectors) |

**Why none of them fit, in one line:** this dashboard's data source is
`results/*.json` produced by RedAnvil's own gate and committed to this
repository. There is no external system holding the data, so there is nothing
for a connector to fetch. A connector would only become relevant if run history
moved out of git into a hosted store.

Two limits worth stating plainly rather than discovering later: every claude.ai
connector is scoped to an assistant session, not to a deployed Worker, so none of
them can serve production traffic even when the data is right; and a connector
that needs interactive auth is unavailable in a headless CI or cron run.

## Assessment

The scan returned 34 candidates. Most are not candidates for this app at all --
`vue-element-admin` is Vue, `grafana` is a server product under AGPL-3.0,
`strapi` is a CMS, and `microsoft-pdb` matched on the word "chart" in an
unrelated sense. The serious ones for a React SPA are the charting libraries.

- **Chart.js** (MIT), **echarts** (Apache-2.0), **d3** (ISC). Licences are all
  permissive and compatible; none of them is the blocker.
- **Cost.** Zero in money. The real cost is bundle weight and a dependency to
  keep current, paid on every page load by every visitor.
- **Runtime fit.** All three run in the browser, and this dashboard is a
  client-rendered React SPA served from Cloudflare Pages, so the Workers runtime
  is not a constraint here -- unlike a Node-only library, which would be.
- **Terms of service.** Not applicable; these are libraries, not hosted APIs.
- **Failure mode.** A charting dependency fails at build or render time and is
  noticed immediately. That is the benign case. The corrosive failure is a
  transitive-dependency update changing rendering subtly, which nothing here
  would catch, because there is no visual regression baseline on a chart.

The decisive fact is scope, not capability: **this dashboard renders no chart.**
It shows KPI tiles and per-run cards read from the committed results feed. Its
entire dependency set is react, react-dom, react-router-dom and zod. Adding a
charting library today would be adding a dependency for a feature that does not
exist, which `u-conc-no-speculative-abstraction` exists to prevent.

## Decision

**Build / integrate / hybrid:** Build. No third-party charting or data-grid
dependency is adopted at this time.

**Why:** There is no chart in the product to justify one. Score history and
coverage trend are currently read as numbers, not plotted, and the four existing
dependencies cover everything the app renders. Integrating a charting library now
would be speculative -- paid in bundle size and maintenance by every visitor, for
a capability nothing calls.

**Revisit when:** the dashboard gains a real time-series view -- score or
coverage plotted across runs -- or any view that needs axes, scales or
interactive tooltips. At that point Chart.js is the first candidate to evaluate
(MIT, actively maintained, smallest of the three for a single chart type), and
the evaluation should include a rendered visual baseline, since a chart that
regresses silently is the failure mode this app has no defence against.
