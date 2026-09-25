# Competitor scan — AI PRD generator for coding agents

What the real products in this category actually ship, including the pages that
get forgotten. Section headings and lengths below are **facts read from the live
pages**; the assessment is the judgement call.

Structure is read, prose is not reproduced. Take the mechanism and change the
execution.

- **Category:** AI PRD generator for coding agents
- **Competitors:** chatprd.ai, cookfa.st, openspec.dev, buildermethods.com
- **Pages checked:** terms, privacy, about, contact

## What they ship

| site | page | url | words | headings |
|---|---|---|---:|---:|
| chatprd.ai | terms | not reachable | 0 | 0 |
| chatprd.ai | privacy | not reachable | 0 | 0 |
| chatprd.ai | about | [link](https://www.chatprd.ai/about-us) | 272 | 11 |
| chatprd.ai | contact | not reachable | 0 | 0 |
| cookfa.st | terms | not reachable | 0 | 0 |
| cookfa.st | privacy | not reachable | 0 | 0 |
| cookfa.st | about | not reachable | 0 | 0 |
| cookfa.st | contact | not reachable | 0 | 0 |
| openspec.dev | terms | not reachable | 0 | 0 |
| openspec.dev | privacy | not reachable | 0 | 0 |
| openspec.dev | about | not reachable | 0 | 0 |
| openspec.dev | contact | not reachable | 0 | 0 |
| buildermethods.com | terms | not reachable | 0 | 0 |
| buildermethods.com | privacy | not reachable | 0 | 0 |
| buildermethods.com | about | [link](https://buildermethods.com/about) | 626 | 15 |
| buildermethods.com | contact | [link](https://buildermethods.com/contact) | 114 | 4 |

## Section structure

### chatprd.ai — about

272 words, 11 headings.

- Building the AI product copilot of my dreams
- Our Team
- Claire Vo
- Alisa Haman
- ChatPRD
- Get to know Claire
- We think product management is dead (or will be soon)
- Product
- Use Cases
- Resources
- Company

### buildermethods.com — about

626 words, 15 headings.

- Stay ahead of how we build.
- You&#x27;re not the only one figuring this out.
- Who this is for.
- You already build
- You&#x27;re energized by it
- You want it from the front lines
- Keep up with the craft.
- The Builder Briefing
- The YouTube channel
- Free workshops
- Free tools
- Where builders stay ahead.
- Learn
- Resources
- Pro

### buildermethods.com — contact

114 words, 4 headings.

- Get in touch.
- Learn
- Resources
- Pro

## Product pages read (2026-09-24)

The scan above only reaches legal and company pages, and most of those sit
behind client-side rendering, so the scanner read 3 of 16. The product claims
below come from each product's own home page or repository README, fetched on
2026-09-24:

| product | what it ships | source |
|---|---|---|
| ChatPRD | Drafts and improves PRDs, reviews product strategy, shared product context for teams, and an authenticated MCP endpoint so coding tools can read the documents | https://www.chatprd.ai/ |
| CookFast | From one idea form (name, type, goal, features, stack) it writes a requirements doc, frontend guidelines, backend structure, a Mermaid application-flow diagram, tech-stack notes and a file-structure proposal; Markdown plus a JSON download "for AI IDE integration"; no account, the visitor brings an OpenAI/Gemini/Anthropic/xAI key | https://github.com/webvijayi/CookFast (cookfa.st answered 503 on the day) |
| OpenSpec | In-repo workflow: `/opsx:explore`, `/opsx:propose` (writes `proposal.md`, `specs/`, `design.md`, `tasks.md`), `/opsx:apply`, `/opsx:verify`, `/opsx:archive`; MIT | https://openspec.dev/ |
| Spec Kit | In-repo CLI (`specify init`) plus agent commands `/speckit-specify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-implement`; writes to `.specify/` | https://github.com/github/spec-kit |

app-builder today: a four-question wizard and a chat composer produce one PRD
with 14 numbered sections (including a vertical-slice build plan, acceptance
criteria, a test plan and a self-check), an initial build prompt and a
machine-readable claims block. The result screen offers Download (.md), Copy,
Save and Start over; saved PRDs are listed at /saved; a build job can be queued
and its status polled.

## Assessment

### Features and controls we are missing

- **No way to revise a generated PRD in place.** ChatPRD's core loop is "draft
  and improve"; app-builder's only route to a changed PRD is Start over and
  re-answering the wizard. This is the biggest gap for a real user.
- **No flow diagram.** CookFast emits a Mermaid application-flow diagram; our
  PRD describes flows in user stories and slices only.
- **No structured export beyond Markdown.** CookFast offers a JSON download for
  AI IDEs. Our PRD embeds a machine-readable claims block but there is no
  separate JSON download control.
- **No agent-facing read endpoint.** ChatPRD exposes an authenticated MCP
  endpoint so a coding agent can pull the document. Ours must be downloaded or
  copied and pasted by hand.
- **No spec-kit / OpenSpec layout option.** Both tools read a split
  `spec` / `plan` / `tasks` layout; our single file has to be split manually.

### Components worth borrowing

- **CookFast's single idea form** maps closely to our wizard, and its explicit
  tech-stack field is worth borrowing, but as a fixed choice list rather than
  free text, because our generator is deterministic and can only honour stacks
  it has templates for.
- **OpenSpec's propose / apply / verify split** is a better shape for the
  build-plan section: keep the one-file download, but mark which slice is the
  proposal and which checks are the verification, so an agent can stop after
  each step.
- **ChatPRD's MCP read endpoint**, reshaped as a read-only, unauthenticated GET
  of a saved PRD by id (which `/api/prd/[id]` already is), documented so an
  agent can fetch it instead of a user pasting it.

### What we deliberately will not do

- **No LLM call per document and no bring-your-own-key.** CookFast asks the
  visitor for a provider key; ChatPRD is an account product. app-builder has
  no accounts and no sign-in (`src/i18n/legalPages.ts`), and a deterministic generator keeps output
  testable against characterization fixtures. Asking an anonymous visitor to
  paste an API key into a web form is a security habit we will not teach.
- **No in-repo CLI.** Spec Kit and OpenSpec already own the terminal and are MIT
  and actively maintained; the right move is to emit files they can read, not
  to compete with them.
- **No team workspaces or shared context.** There are no accounts in this app,
  and adding them for collaboration would bring passwords, sessions and PII
  handling that the product does not need.
