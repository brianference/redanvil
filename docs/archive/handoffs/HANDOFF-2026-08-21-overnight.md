# Handoff: overnight autonomy, 2026-08-21

Written before a planned Claude Code restart (an update was installed). Everything
below was verified against an artifact in the session that produced it; where it was
not, it says so.

## The goal for tonight

A fully autonomous run through n8n and the new process that builds a **new concept
end to end** -- PRD through full app. Not the existing-app grind loop.

## The thing to understand first

**These are two different pipelines, and only one of them is scheduled.**

| | `overnight.mjs` | n8n full build |
|---|---|---|
| What it does | grinds already-registered apps toward the 90 threshold | walks a new concept through 24 steps, prd -> ship |
| Entry point | `n8n-prototype/loki/overnight.mjs` | `workflows/redanvil-full-build.json` via webhook |
| Queue | `gate-<app>` per app in `results/all.json`, plus one bug item, plus drift | one concept |
| Scheduled? | yes -- Windows task "RedAnvil Overnight", 23:30 daily | **no** |

The 23:30 task runs `n8n-prototype/loki/run-overnight.cmd`, which calls
`overnight.mjs --allow-deploy`. Nothing currently triggers the n8n full build. That
gap is work item 4 below.

## State as of the restart

- Repo `C:\Users\brian\RedAnvil`, branch `master`, HEAD `63ae588`, **0 unpushed**.
- n8n server is up: `http://localhost:5678/healthz` returned 200.
- `build-workflow.mjs` regenerates `redanvil-full-build.json` byte-identical (no git
  diff). 24 steps -> 59 nodes. **UNBOUND roles: none** -- every step has an
  implementation.
- Step order: `prd -> product -> brainstorm -> inspo -> reuse -> logo -> palette ->
  layout -> decide -> integration -> testwriter -> build -> content -> runners ->
  visual -> ui-live -> qa-runtime -> judge -> qa-data -> user-refuse -> pm ->
  debugger -> reverify -> ship`.
- Scheduled task exists, is enabled, next run tonight 23:30. It has **never run**:
  `LastRunTime` is `11/30/1999`, `LastTaskResult` is `267011` (0x41303, "has not yet
  run"), and `logs/overnight.log` does not exist.
- Working tree is dirty: 18 modified files (mostly `measurement-meta.json` and
  `coverage-state.json`), plus untracked `evidence/receipts/`,
  `.redanvil/overnight/`, and three scaffolds.
- `.redanvil/overnight/checkpoint.json` was temporarily edited during investigation
  and has been **restored** to its prior contents (`completed:
  ["gate-dashboard","gate-app-builder"]`, `spentUsd: 0`).

## What the evidence actually says

- 12 receipts in `evidence/receipts/`. **All 12 are `UNVERIFIED`.** 11 are
  `executor: "dry-run"`.
- The one real dispatch, `gate-dashboard-2026-08-21T16-14-53-300Z.json`, ran grok
  for 5 minutes (16:09:54 -> 16:14:53) and returned `diffChanged: false`,
  `assessments: []`, `gateScore: 0`, blockers `u-test-runners`, `fe-breadcrumbs`,
  `fe-resource-links`, `fe-no-inline-width`, `lg-shipped`, `lg-result-reproduces`.
  That receipt predates the current worktree-dispatch code (its notes contain a
  string no longer in the file), so treat it as evidence of the defect, not of the
  current code path.
- All five apps in `results/all.json` sit at `finalScore: 0`.
- **Disproved this session:** headless `claude -p` does not need a permission flag
  to edit files. A probe wrote to a target file with `permission_denials: []`,
  `is_error: false`, `total_cost_usd: 0.3475`. Agent dispatch itself works.

## Work items

**1-3. Overnight loop hardening -- spec written, approved, not yet delegated.**
Full spec: `docs/specs/overnight-hardening.md`. It passes
`node ~/.claude/scripts/check-spec-assumptions.mjs` (exit 0). Summary:

1. Measure and merge inside the worktree. `dispatchFix()` edits `wt.path` (line
   578) but tests run in `REPO_ROOT` (line 604), the post-fix gate reads `REPO_ROOT`
   (line 615), and `commitAfter` is `headCommit(REPO_ROOT)` (line 624). No merge
   exists. So `diffChanged` is always false and VERIFIED (which requires it, line
   480) is unreachable.
2. Implement `--allow-deploy`. Parsed line 639, threaded line 677, never read.
   `lg-shipped` cannot clear until it exists.
3. Night-level deadline. 45 min per item plus up to 110 min of backoff per agent
   across 7 items, with no wall clock. Also note in the same pass: `COST_CAP_USD`
   cannot bind on grok, because the non-structured branch hardcodes `costUsd: 0`.

User approved delegating these to Grok Build.

**4. Trigger the n8n full build for a new concept.** Not specced yet. Needs a
concept, and needs something to POST the webhook tonight.

**5. CI is red on master, and not for the reason it looks like.** The last three
pushes all failed. Read the log rather than assuming it is the gate honestly
refusing unfinished apps -- two of the three failing jobs are a different problem:

```
RESULTS VERIFICATION FAILED: coverage mismatch: committed 83/83, reproduced 61/83.
```

`results-provenance` (job 96940080897) and `quickflight-provenance` (job
96940080920) both fail this way; `orchestrator` passes. The committed results claim
all 83 rules were measured, but re-running the gate in CI measures only 61. **22
rules measure on this machine and do not measure in CI.** Until that is diagnosed,
the local gate's coverage number is not trustworthy, which matters directly for an
autonomous night that gates its own work. Do not treat this as a known issue -- it
was not diagnosed before, only assumed.

## Open decision, blocks tonight

The process map has **four human gates**: `logo`, `palette`, `layout`, `decide`.
They are n8n Wait nodes with `resume: form`; `build-workflow.mjs` notifies over
Telegram with a signed resume link and then suspends until someone taps it.

Unattended, the run reaches `logo` (step 6 of 24) and stops there until morning.
So "fully autonomous overnight" and "four human gates" cannot both hold tonight.
Pick one before 23:30:

- **Auto-resolve the gates overnight**, recording each choice and its alternatives
  for morning review. Gets a full prd-to-ship run, but the owner did not pick the
  logo, palette or layout -- which is normally the part the owner most wants to
  choose.
- **Keep the gates and approve by Telegram.** Genuinely supervised, but the night
  stalls at whatever hour the taps stop.
- **Split it:** auto-resolve tonight to prove the pipeline runs end to end, then
  re-run the four design steps with real owner choices tomorrow.

The third is the recommendation, because tonight's real unknown is whether 24 steps
chain at all, not whether the palette is good.

## Resume prompt after restart

> Continue the RedAnvil overnight work. Read `docs/HANDOFF-2026-08-21-overnight.md`
> first. Delegate `docs/specs/overnight-hardening.md` to Grok Build, then resolve
> the human-gate decision for tonight's autonomous new-concept build.
