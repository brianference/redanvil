# Loki Mode integration — status and design

## The blocker, first

Loki Mode cannot be installed on this machine:

```
npm error code EBADPLATFORM
npm error notsup Unsupported platform for loki-mode@9.22.12:
  wanted {"os":"darwin,linux"} (current: {"os":"win32"})
```

WSL is not installed either (`wsl --status` → "The Windows Subsystem for Linux is
not installed"), and installing it needs elevation and a reboot.

So the overnight loop shipped here is **not** Loki and does not claim to be. It
implements the patterns Loki documents, on the toolchain that runs on this box
today, with a single branch point that switches to the real binary the moment one
is reachable.

## What Loki actually is

Verified by rendering the docs in a browser — the pages are a client-rendered SPA
and return an identical ~6.5KB shell to `curl`, so anything read without a browser
is the shell, not the docs.

> Loki Mode (aka Autonomi) is an autonomous spec-to-product system built on the
> RARV-C closure loop. Drop in any spec — a PRD, a GitHub issue, an OpenAPI
> document, a Jira ticket, or a one-line brief — and it builds, tests, reviews,
> and ships the deployed product with minimal human intervention.

Relevant facts, quoted from the docs:

- **Providers**: "Claude (Tier 1 full, default Opus 4.7 with 1M context)". Claude
  Code CLI is a prerequisite (`npm install -g @anthropic-ai/claude-code`,
  `claude login`). Claude Code **2.1.237** is already installed here.
- **Evidence Receipt (v7.85+)**: "every build writes a non-forgeable receipt that
  splits deterministic FACTS from AI ASSESSMENTS. Reads VERIFIED only when tests
  ran AND passed AND build succeeded AND there is a real diff with no gaps."
  `loki proof verify <id>` re-hashes and re-derives the diff.
- **Hard Quality Gates (v6.7.0)**: static analysis and coverage, via `LOKI_HARD_GATES`.
- **Worktree Management (v6.7.0)**: `loki worktree` list / merge / clean / monitor.
- **Parallel sessions**: `LOKI_DIR` gives each session "its own pid lock, queue,
  checkpoints, memory, and event stream"; the docs pair it with `git worktree add`
  for filesystem isolation.
- **Parallelism on Claude**: "Loki Mode can run up to 10+ agents in parallel using
  the Task tool", dispatched from a task dependency graph.
- **Override council**: a 3-LLM judge panel where "2-of-3 APPROVE_OVERRIDE lifts
  the BLOCK; any infrastructure failure fails-safe to REJECT_OVERRIDE so a hung
  provider cannot silently approve a bypass."

That last one is worth stealing outright — it is the fail-closed discipline this
project already learned the hard way, applied to override decisions.

## What was built

`n8n-prototype/loki/overnight.mjs`. Loki wraps n8n, per the chosen topology:

| Layer | Owns |
|---|---|
| Overnight loop (outer) | Iteration, the work queue, receipts, caps, never stopping on one failure |
| n8n (inner) | The 24-step role pipeline, durable pauses, role contracts, refusal |
| RedAnvil gate | The verdict — a receipt never overrides `meets_the_bar` |

**The queue is discovered, not hardcoded.** It reads `results/all.json` and
enqueues every app below 90, so an app added later is picked up without editing
the orchestrator. A real run found five: dashboard, app-builder,
az-planting-calendar, sushi-finder, pet-sitter.

**Receipts split facts from assessments.** `verified` is a conjunction of facts
only; no model statement can promote an item to VERIFIED. Unknown reads as
unverified, never as a pass.

A real receipt from a real run:

```json
"status": "UNVERIFIED",
"facts": {
  "diffChanged": false,
  "testsRan": true,
  "testsPassed": true,
  "buildSucceeded": true,
  "gateScore": 0,
  "gatePassed": false
}
```

Three facts are independently true and two are false, which is the evidence the
conjunction is measuring rather than defaulting.

## Honest gaps

- **VERIFIED has not been observed.** Every receipt so far reads UNVERIFIED,
  correctly. That the true-branch is *reachable* is inferred from three facts
  flipping true independently — it has not been demonstrated end to end.
- **The n8n Schedule Trigger is not wired.** The loop runs from the command line;
  nothing fires it nightly yet.
- **The executor does not yet edit code.** It measures, gates and writes receipts.
  Dispatching a fix to Grok or Claude per failing rule is the next step and is the
  difference between "an overnight measurement loop" and "overnight development".
- **Deploy-on-pass is accepted as policy but never exercised**, because nothing
  has passed.

## When Loki becomes available

Install WSL, then inside it:

```bash
npm install -g @anthropic-ai/claude-code && claude login
npm install -g loki-mode
loki doctor
```

`detectLoki()` flips to true on its own and the executor switches. The queue,
receipts and gate verdict are unchanged by that switch — which is the reason the
boundary sits exactly there.
