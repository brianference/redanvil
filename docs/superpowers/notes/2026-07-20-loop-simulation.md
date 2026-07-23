# Loop simulation and design hardening

Date: 2026-07-20
Method: tabletop dry-runs of the Grok build loop building the app-builder app at threshold 90. No code executed; each run walked iteration by iteration to surface failure modes, which were then encoded as enforced rules in `rules/loop-gate.md`.

## Sim A — normal build path

- Iter 1: Grok scaffolds Vite + React + Tailwind + Pages Functions + D1. Gate: `tsc` and eslint fail on `any`; tests missing (`u-test-presence`). Blockers present, low score. Feedback captured.
- Iter 2: types fixed, tests added, Node suite passes. `wrangler build` succeeds, but the app uses a Node-only API (`process` / `better-sqlite3`) that throws at runtime. Node-run tests cannot catch it.
- Iter 3: switched to Web Crypto; gate clean; judge flags `fe-pages-compose` (page imports primitives directly). Score 86.
- Iter 4: components extracted. Score 92. Deploy.

Finding A: a green gate that never boots the Worker is a false pass. Node tests passing is not runtime parity.
Fix: `lg-runtime-parity` (blocker) — boot `wrangler pages dev`, curl a live endpoint plus the homepage; a runtime throw fails the gate.

## Sim B — stall and unbounded-loop hazards

- The real hang is the Grok subprocess, not subagents: a foreground `grok -p` that wedges on the network or waits on a prompt despite `--always-approve` blocks the orchestrator indefinitely.
- Ralph with neither a completion-promise nor `--max-iterations` runs forever; a judge score that flip-flops across the threshold never settles.

Finding B: unbounded Grok call and unbounded loop.
Fixes:

- `lg-grok-timeout` (blocker) — Grok runs in the background with a wall-clock timeout and is killable; on timeout the iteration fails, partial diff becomes feedback, loop proceeds.
- `lg-ralph-bounded` (blocker) — both completion-promise and `--max-iterations` always set; promise emitted only from a real inline score.
- `lg-score-flipflop-escalates` (already present) — crossing then falling back escalates to the owner.

## Sim C — security and scope hazards

- `--always-approve` gives Grok arbitrary shell in its cwd: it could push, deploy, read `.env`, or edit outside scope.
- Two parallel runs editing overlapping files clobber each other.

Finding C: Grok has too much privilege and no disk isolation.
Fixes:

- `lg-worktree-isolation` (blocker) — each run in a dedicated, disk-isolated git worktree.
- `lg-grok-no-secrets` (blocker) — no secrets in Grok's env or worktree.
- `lg-grok-no-deploy` (blocker) — push and deploy are orchestrator-only, inline, post-gate; Grok is forbidden.
- `lg-collision-serialize` (major) — parallel only when file sets provably disjoint; otherwise serialize.

## Harness decision

The loop is driven by the ralph-loop plugin inside the orchestrator session (`lg-ralph-*`). Ralph is a stop-hook that re-feeds the same orchestration prompt each iteration, inline, with the completion-promise bound to the inline score gate. This gives "keep iterating until done" without a subagent and without a blocking wait, consistent with the no-stall protocol. Grok remains a bounded, isolated, least-privilege subprocess invoked within each inline iteration.

## Net design changes

Nine enforced rules added to `rules/loop-gate.md`: `lg-grok-timeout`, `lg-runtime-parity`, `lg-budget-ceiling`, `lg-worktree-isolation`, `lg-grok-no-secrets`, `lg-grok-no-deploy`, `lg-collision-serialize`, `lg-ralph-driver`, `lg-ralph-bounded`, `lg-ralph-each-iteration-inline`. These feed forward into Plan 2 (orchestrator engine), where the gate runners, the Grok harness, and the ralph integration are implemented and tested against a fixture repo.
