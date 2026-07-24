# Assessment: external PRD practices vs RedAnvil

Judged against one question: does it make the PRD a better **executable build plan for a
coding agent**, without conflicting with what RedAnvil already enforces?

## Adopt — real gaps in our PRD

| Practice | Why it matters here | Cost |
|---|---|---|
| **Vertical slices (tracer bullets)** | Our task graph is HORIZONTAL (scaffold → DDL → schemas → health → CRUD → UI). That is exactly the anti-pattern: nothing works end-to-end until the last phase, so feedback comes late. Each slice should cross DB + API + UI + test for ONE feature. **Highest-impact change available.** | Medium |
| **Standard section names** (Introduction, Problem Statement, Solution Overview, User Stories, Technical Requirements, Acceptance Criteria, Constraints) | Predictable headings are easier for a model to navigate than our bespoke ordering. Cheap, and it subsumes the missing Problem Statement / User Stories. | Low |
| **Definition of done / success outcome** | The PRD says what to build, never what "successful" looks like. A coder cannot self-check against an outcome that is not stated. | Low |
| **MVP-first core features** | Nothing marks which features are the minimum that solves the problem, so an agent builds everything at once. | Low |
| **API contracts with example request/response** | We list routes; we do not give concrete payloads. Examples remove ambiguity that regenerates as bugs. | Low |
| **Explicit test cases per feature** (unit / integration / e2e) | We name test *categories*. Named cases per feature bind acceptance criteria to real tests. | Medium |
| **Graded PRD self-validation** | RedAnvil grades the APP (the 100-point rubric) but never grades the PRD. A completeness score + checklist ("is this spec buildable?") is squarely in the project's spirit and closes a genuine gap. | Medium |

## Already have — no change needed

- **Evidence over assertions** — verdicts carry evidence paths that must exist; provenance hashes the inputs; CI reproduces the score.
- **Stop hooks** — the design-gate hook blocks a "done" claim until the real audits run.
- **Fresh-context multi-layer review** — the Grok cross-check ran as an independent skeptic and found four real gaps; the judge tier cites file:line.
- **Dependency-ordered task graph** with per-task verify commands.
- **Zero-ambiguity acceptance criteria** — GIVEN/WHEN/THEN with a verify binding.
- **Machine-readable frontmatter** — the PRD is already orchestrator-parseable.
- **Placeholder-proof** — `u-data-no-placeholder` is now a scored blocker.
- **Graded validation with a checklist** — that IS the rubric (45/45, per-rule evidence audit).
- **TDD / tests before done** — `u-test-presence`, `u-test-adequacy`, `u-test-behavioral`.

## Do not adopt — would conflict

| Suggestion | Why not |
|---|---|
| **PRD-Taskmaster plugin** (`/plugin install prd`) | It is a competing PRD generator. Installing it alongside RedAnvil's own generator creates two sources of truth for the same artifact and two grading systems. **Take the ideas — graded validation, placeholder-proof, task graph — not the plugin.** |
| **ChatPRD MCP** | An external dependency to make the PRD "queryable". Ours is already machine-readable via frontmatter and parsed by the orchestrator; adding an MCP for it is redundant surface. |
| **Ralph PRD skill trigger phrases** | RedAnvil *is* the PRD tool. A second skill claiming "create a prd" would compete for routing. |
| **Model-agnostic cheap-model routing** | Out of scope. The split is already Claude orchestrates / Grok builds. |

## Multi-agent: one idea sharper than ours

Our primitives plan already covers manager → worker → verifier, worktree isolation, context
forking, and parallel lens review. One idea is genuinely better than what we do:

> **Verifier agents run in isolated contexts — they see the test commands, not the implementation.**

Our judge reads the code, which lets an implementation's own framing influence the verdict. A
verifier that only sees the spec + the commands, and must decide from observable behaviour, is
harder to fool. Worth adopting for the verify half of the judge tier.

Also worth keeping: **retry with verifier feedback** (bounded) and **debate → judge synthesis**
for design choices where there is no single right answer.

## Sequencing

1. Vertical slices + standard sections + Problem/User Stories/DoD/MVP (one PRD change).
2. API examples + per-feature test cases.
3. PRD self-grade with a checklist.
4. Blind verifier for the judge tier (multi-agent work, separate).
