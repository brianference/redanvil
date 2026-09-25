# Integration scan — turn a plain-English app idea into a PRD (product requirements document) for coding agents, plus a build-job queue

Ran before building. **Reuse beats rebuild**, but only when the licence, the
runtime and the maintenance status all hold — so each candidate is recorded with
those facts and a verdict, not just a link.

- **Capability:** turn a plain-English app idea into a PRD (product requirements document) for coding agents, plus a build-job queue
- **Target runtime:** browser (React SPA) + Cloudflare Pages Functions (Workers runtime, TypeScript)
- **Search terms:** `prd generator`, `product requirements document ai`, `prd ai agent`, `spec driven development`, `requirements document generator`, `job queue cloudflare d1`
- **Candidates found:** 29

## Candidates

| repo | stars | language | licence | last push | flags |
|---|---:|---|---|---|---|
| [github/spec-kit](https://github.com/github/spec-kit) | 138807 | Python | MIT | 2026-09-24 | - |
| [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec) | 70254 | TypeScript | MIT | 2026-09-23 | - |
| [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done) | 64462 | JavaScript | MIT | 2026-05-31 | archived |
| [snarktank/ralph](https://github.com/snarktank/ralph) | 21855 | TypeScript | MIT | 2026-02-02 | - |
| [gsd-build/gsd-2](https://github.com/gsd-build/gsd-2) | 7780 | TypeScript | MIT | 2026-05-22 | - |
| [buildermethods/agent-os](https://github.com/buildermethods/agent-os) | 5445 | Shell | MIT | 2026-08-29 | - |
| [Pimzino/spec-workflow-mcp](https://github.com/Pimzino/spec-workflow-mcp) | 4293 | TypeScript | GPL-3.0 | 2026-07-03 | - |
| [asklokesh/loki-mode](https://github.com/asklokesh/loki-mode) | 1073 | Shell | NOASSERTION | 2026-09-21 | licence unclear |
| [TechNomadCode/AI-Product-Development-Toolkit](https://github.com/TechNomadCode/AI-Product-Development-Toolkit) | 989 | ? | MIT | 2026-09-24 | - |
| [shotgun-sh/shotgun](https://github.com/shotgun-sh/shotgun) | 686 | Python | MIT | 2026-06-02 | - |
| [OpenSQZ/GTPlanner](https://github.com/OpenSQZ/GTPlanner) | 310 | Python | MIT | 2026-09-21 | - |
| [PageAI-Pro/ralph-loop](https://github.com/PageAI-Pro/ralph-loop) | 306 | Shell | MIT | 2026-08-31 | - |
| [fivetaku/show-me-the-prd](https://github.com/fivetaku/show-me-the-prd) | 57 | Shell | MIT | 2026-08-24 | - |
| [doncheli/don-cheli-sdd](https://github.com/doncheli/don-cheli-sdd) | 57 | TypeScript | Apache-2.0 | 2026-08-10 | - |
| [dredozubov/prd-generator](https://github.com/dredozubov/prd-generator) | 52 | ? | MIT | 2026-01-14 | - |
| [adrianpuiu/specification-document-generator](https://github.com/adrianpuiu/specification-document-generator) | 48 | Python | none | 2026-01-03 | licence unclear |
| [Saml1211/PRD-MCP-Server](https://github.com/Saml1211/PRD-MCP-Server) | 36 | TypeScript | MIT | 2026-03-17 | - |
| [AungMyoKyaw/prd-creator](https://github.com/AungMyoKyaw/prd-creator) | 33 | TypeScript | none | 2026-08-19 | licence unclear |
| [lurenyi2025/lurenyi-prd-generator](https://github.com/lurenyi2025/lurenyi-prd-generator) | 24 | ? | MIT | 2026-04-14 | - |
| [Ceciliaaaaaaaaaa/iot-prd-generator](https://github.com/Ceciliaaaaaaaaaa/iot-prd-generator) | 16 | ? | none | 2026-04-01 | licence unclear |
| [Vann4799/ai-prd-generator](https://github.com/Vann4799/ai-prd-generator) | 16 | JavaScript | MIT | 2026-09-19 | - |
| [AlexPEClub/n8n-prd-generator](https://github.com/AlexPEClub/n8n-prd-generator) | 15 | ? | none | 2026-02-18 | licence unclear |
| [yoligehude14753/docforge](https://github.com/yoligehude14753/docforge) | 15 | TypeScript | MIT | 2026-03-25 | - |
| [al3rez/yamlprd](https://github.com/al3rez/yamlprd) | 14 | Python | none | 2025-07-21 | licence unclear |
| [webvijayi/CookFast](https://github.com/webvijayi/CookFast) | 13 | TypeScript | MIT | 2025-12-19 | - |
| [hackerrahul/Tasque](https://github.com/hackerrahul/Tasque) | 11 | TypeScript | none | 2024-12-15 | licence unclear |
| [TomMaSS/PRDforge](https://github.com/TomMaSS/PRDforge) | 8 | Python | none | 2026-03-29 | licence unclear |
| [anishk123/cloudflare-pwa-starter](https://github.com/anishk123/cloudflare-pwa-starter) | 0 | TypeScript | MIT | 2026-09-20 | - |
| [ITalik-gr/job-radar](https://github.com/ITalik-gr/job-radar) | 0 | HTML | MIT | 2026-09-22 | - |

## Serious candidates, verified

The table above is the raw search. These are the rows that could plausibly
replace part of app-builder, each read against its own repository or docs page
on the date shown.

| candidate | what it actually is (from its own page) | fit for app-builder | checked | source |
|---|---|---|---|---|
| github/spec-kit | CLI toolkit that gives coding agents spec-driven workflows (`/speckit-specify`, `/speckit-plan`, `/speckit-tasks`, ...); needs Python 3.11+ and `uv`; writes artifacts under `.specify/` | Runs inside the developer's repo and agent, not in a browser or a Worker. Cannot be the engine behind a public web wizard | 2026-09-24 | https://github.com/github/spec-kit |
| Fission-AI/OpenSpec | Spec-driven development framework for AI coding assistants; `/opsx:propose` drafts `proposal.md`, `specs/`, `design.md`, `tasks.md`; MIT | Same shape as spec-kit: an in-repo agent workflow. It is the downstream consumer of a spec, not a way to produce one from a visitor's plain-English idea | 2026-09-24 | https://openspec.dev/ |
| snarktank/ralph | Autonomous agent loop that "runs repeatedly until all PRD items are complete"; MIT | Consumes a PRD; does not generate one. Relevant to the build-job side, not the generator | 2026-09-24 | https://github.com/snarktank/ralph |
| buildermethods/agent-os | System for injecting codebase standards and writing specs for spec-driven development; MIT | In-repo agent tooling again; no hosted or embeddable generator | 2026-09-24 | https://github.com/buildermethods/agent-os |
| Saml1211/PRD-MCP-Server | MCP server generating PRDs "from codebase context"; MIT, 36 stars | Needs an existing codebase and an MCP client. app-builder starts from an idea with no code | 2026-09-24 | https://github.com/Saml1211/PRD-MCP-Server |
| dredozubov/prd-generator | Claude Code plugin that generates PRDs; MIT | Runs inside Claude Code, not a web page | 2026-09-24 | https://github.com/dredozubov/prd-generator |
| webvijayi/CookFast | Web tool that writes a requirements doc, frontend/backend guidelines, a Mermaid flow and more from an idea; user brings their own OpenAI/Gemini/Anthropic/xAI key; MIT | Closest match in scope. Every document is an LLM call on the visitor's key, which app-builder deliberately avoids (see Decision) | 2026-09-24 | https://github.com/webvijayi/CookFast |
| hackerrahul/Tasque | Serverless scheduler and queue on Workers, D1 and Durable Objects | No licence on the repository, so it cannot be adopted; also brings Durable Objects this app does not otherwise need | 2026-09-24 | https://github.com/hackerrahul/Tasque |
| Cloudflare Queues | Managed queue; pull consumers can read "over HTTP from any environment ... outside of Cloudflare Workers" with an API token; Free plan includes 10,000 operations/day and 24 h retention | Technically fits the runner's pull model, but a queue message is not queryable, and the public `/api/jobs/:id/status` page needs a durable, readable row per job anyway | 2026-09-24 | https://developers.cloudflare.com/queues/configuration/pull-consumers/ |
| Cloudflare Queues pricing | Workers Free: 10,000 operations/day, 24 h retention; Workers Paid: 1,000,000 operations/month then $0.40/million | Cost is not the blocker at this volume; the status-record requirement is | 2026-09-24 | https://developers.cloudflare.com/queues/platform/pricing/ |

## Connectors considered

Enumerated before the web search (R33). Tools attached to this session need no
key and no signup, so they are checked first and recorded even when they lose.

| connector | relevant to generating a PRD or queueing a build? | usable in the request path? | checked | source |
|---|---|---|---|---|
| x-search (local MCP) | No, it searches X/Twitter posts | No | 2026-09-24 | https://github.com/brianference/workspace/tree/main/projects/x-search-mcp-server |
| Expedia, Kiwi.com, Booking.com, lastminute.com, Viator, Tripadvisor, Resy, StubHub, Uber, Uber Eats | No, travel and booking inventory | No | 2026-09-24 | https://claude.ai/settings/connectors |
| Gmail, Google Drive, Google Calendar | No; PRDs are stored in this app's own D1, not a user's account | No | 2026-09-24 | https://claude.ai/settings/connectors |
| Figma, Jam | No, design and bug-capture tools rather than a spec source | No | 2026-09-24 | https://claude.ai/settings/connectors |
| S&P Global, Scite | No, financial and citation data | No | 2026-09-24 | https://claude.ai/settings/connectors |
| context7 (plugin MCP) | Partly: it returns current library docs, which is what the PRD's stack references point at | No, it is scoped to an assistant session | 2026-09-24 | https://github.com/upstash/context7 |

None of them can serve a public visitor: every one is scoped to an assistant
session, and the ones needing interactive auth are also unavailable to the
headless build runner.

## Assessment

The 29 search results split into three groups, and none of them is the thing
app-builder is.

1. **In-repo spec workflows** (spec-kit, OpenSpec, agent-os, ralph and the
   Claude Code PRD plugins). All MIT, all actively pushed in 2026. They run in a
   developer's terminal and agent, and they assume a repository already exists.
   Runtime fit for a public web page is zero: spec-kit needs Python 3.11 and
   `uv`, and none of them runs in a browser or a Cloudflare Worker. They are the
   audience for a PRD rather than a producer of one, which is useful in its own
   right: the PRD app-builder emits should load cleanly into these tools.
2. **Hosted LLM PRD writers** (CookFast, prd-creator, ai-prd-generator). These
   match the idea-in, document-out shape. Their cost model is an LLM call per
   document, paid on the visitor's own key in CookFast's case. Licences vary:
   CookFast is MIT, prd-creator has none and so cannot be adopted.
3. **Queue infrastructure** (Tasque, Cloudflare Queues). Tasque has no licence.
   Cloudflare Queues is on the Free plan and supports HTTP pull from outside
   Workers, so it could carry the runner hand-off, but the job still needs a
   durable, publicly readable status row, which is a D1 table either way.

Failure modes differ sharply. An LLM-backed generator fails by returning a
confident but wrong document, and nobody notices until a build goes wrong.
app-builder's generator is deterministic TypeScript in `src/lib/prd/`, covered
by characterization fixtures (`src/lib/prd.characterization.fixtures/`), so a
change in output is a failing test rather than a silent drift.

## Decision

**Build / integrate / hybrid:** Build the generator and the queue; integrate
downstream by emitting Markdown the spec-driven tools can read.

**Why:** No candidate runs where this product has to run. The in-repo tools need
a terminal, Python or an agent session, and the hosted writers need an LLM key
per request, which would either put cost on every anonymous visitor or ask them
for a key. The deterministic generator has no per-request cost and a failure
that shows up in tests. For the queue, a D1 `jobs` table with a compare-and-set
claim (`functions/api/jobs/claim.ts`) is the status record the public status
route reads, so adding Cloudflare Queues would add a second copy of each job
without removing the table.

**Revisit when:** the generator needs free-text understanding that templates
cannot give (then evaluate an LLM call behind the existing self-check, with a
cost cap); the runner count grows past what a polled table handles (then
Cloudflare Queues pull consumers are the first candidate, keeping D1 as the
status record); or spec-kit or OpenSpec publish an import format, in which case
the PRD export should target it directly.
