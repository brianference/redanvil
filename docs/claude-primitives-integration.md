# Folding Claude Code primitives into the RedAnvil core process

Claude Code exposes three primitives that RedAnvil currently uses only ad-hoc, by hand,
inside a session. Encoding them into the repeatable process is the highest-leverage change
available to the loop's output quality. This is the plan.

## The three primitives

| Primitive                                               | What it gives                                              | RedAnvil uses it today                       | Gap                                                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Agent** (goal-directed subagent)                      | independent parallel evaluation, each with its own context | I spawn review teams by hand per session     | the JUDGE tier is a single serial pass, not a fan-out; no adversarial verification     |
| **Worktree** (`isolation: "worktree"` / `withWorktree`) | parallel file mutation without conflict                    | `runLoopCommand` isolates the one Grok build | design/variant exploration and multi-fix batches all touch one tree, so they serialize |
| **Loop** (`/loop`, `ScheduleWakeup`, ralph)             | persistence and cadence                                    | the ralph loop is bounded and synchronous    | no outer cadence — nothing re-gates production on a schedule to catch drift            |

The whole point: today the loop is a single-threaded shell (Grok codes → gate → feedback →
repeat) and Claude sits outside it orchestrating manually. The primitives let the _process
itself_ fan out, isolate, and persist — which is exactly what a two-team review + worktree
delegation + iterate-to-90 session already demonstrated by hand.

## What each buys, concretely

### 1. Agent → the judge tier becomes a fan-out with adversarial verification

The judge rules (concision, test quality, page composition, fail-closed states) are the
majority of unmeasured score and today rest on one Grok pass. Replace that with:

- **one subagent per rule-group**, each reading the real code and returning
  evidence-backed verdicts (the `evidence[]` + `note` shape the verdicts schema already
  enforces);
- **adversarial verify**: for every PASS, a second skeptic subagent tries to refute it;
  a verdict only stands if the skeptic cannot. This is the pattern that caught the two
  dead-code FAILs this session — an honest judge, not a rubber stamp.

Net: the judge tier goes from "a reviewer asserted it" to "N independent agents agreed,
one of them trying to break it," with file:line evidence per verdict.

### 2. Worktree → parallel builders and design variants

The design standard is 10 options (5 Claude + 5 Grok). Today they contend for one tree, so
they run in sequence and can clobber. With `isolation: "worktree"`:

- each variant builder gets a disposable worktree and runs concurrently;
- the winner's worktree is merged, the rest auto-cleaned;
- the same applies to a multi-fix batch — N independent fixes in N worktrees, gated
  independently, merged only if green.

`withWorktree` already exists and the loop uses it for one build; the change is to fan it
out to N.

### 3. Loop → an outer cadence that catches drift

The ralph loop converges once. Nothing re-checks production afterward. Add:

- **a scheduled re-gate** (GitHub Actions cron): re-run `a11y_audit.mjs` and the visual
  review against the live site; open an issue on any new violation. This session's contrast
  regression would have been caught by such a cron the day after it shipped.
- **loop-until-dry discovery**: for review/audit phases, keep spawning finder agents until
  K consecutive rounds surface nothing new, instead of a fixed one pass.

## The improved core process (target)

```
understand → design (judge panel of N variants, worktree-isolated)
          → implement (Grok in a worktree per unit)
          → review (dimensions in parallel → adversarial verify each finding)
          → gate (deterministic + fanned-out judge + recorded visual)
          → loop until a real >= 90 with evidence
          → deploy → verify by asset hash → scheduled re-gate for drift
```

## Integration targets and the plan

### Project (code)

1. `orchestrator/src/commands/judge.ts` (new): fan out Agent/Workflow subagents for the
   judge tier, one per rule-group, each emitting the verdict shape `parseVerdicts` already
   validates; add an adversarial-verify second pass. Wire it as a `redanvil judge <app>`
   command and into `runLoopCommand`'s gate step.
2. `runLoopCommand`: accept `variants: N` and run N worktree-isolated builders concurrently
   via `withWorktree` + `parallel`, gate each, keep the best.
3. Keep every mutation isolated: no parallel agent edits the main tree (the `--no-isolate`
   default stays off for fan-out).

### CLAUDE.md (global process rules)

Add: "For any substantive build or review, delegate the judge/verify tier to a fan-out of
subagents and adversarially verify each finding before trusting it; isolate every parallel
mutator in its own worktree; use loop-until-dry for discovery; re-gate production on a
cadence, never once." (These generalize beyond RedAnvil.)

### GitHub

1. `.github/workflows/drift.yml` (new, scheduled): run `a11y_audit.mjs` against both
   production URLs in both themes; fail / open an issue on any violation. Real internet
   egress, so GitHub Actions, not a local cron.
2. `.github/workflows/judge.yml` (new, on PR): run the judge fan-out against the PR head and
   post the verdicts as a check, so the judge tier is enforced per-PR, not per-session.
3. CI already reproduces the deterministic gate + repo CI-lane blockers; the two above close
   the judge and drift gaps.

### Process (the repeatable workflow)

Encode the target sequence above as a `Workflow` script (`understand`/`design`/`implement`/
`review` phases) so a build is one orchestrated fan-out rather than a series of manual Grok
calls. The session that produced this document was that workflow run by hand; the plan is to
make it a script.

## Sequencing

1. `redanvil judge` fan-out + adversarial verify (replaces the manual judge; biggest quality
   gain, unblocks the 10 judge-tier rules).
2. `drift.yml` scheduled re-gate (cheapest safety net; would have caught the contrast
   regression).
3. Worktree-parallel variants in `runLoopCommand` (throughput; needed for the 10-option
   design standard to run concurrently).
4. `judge.yml` per-PR enforcement, then the full `Workflow` script.

Each step is independently shippable and gated by the same rubric it improves.
