# PM / role managed-agent process — learnings and bugs

Written during three end-to-end simulations on 2026-08-05, recorded as findings
occurred rather than reconstructed afterwards. Every claim here traces to a
command whose output was read; where something was not verified, it says so.

## What existed before this session, and what did not

I asserted early on that there was "no role registry lookup, no row-to-role
assignment, no promotion path." That was wrong, and I said it without looking.
The honest inventory:

| Piece | State before |
|---|---|
| `roles.ts` — registry, `getRole`, `expandArtifacts` | existed |
| `assign.ts` — `rolesForRow`, `assignUnmetRows`, `UnownedRowError` | existed |
| `pm.ts` — `planIteration`, `dryRunAssignments`, `runPm` | existed |
| `runRole.ts` — brief, scrubbed env, artifact-based verdict | existed |
| `worktreeEnforcement.ts` — assignment/gate-status files | existed (437 lines) |
| **Anything that called `runPm`** | **did not exist** |
| **Worktree creation / promotion per role** | **did not exist** |
| **Enforcement that a worktree role runs in a worktree** | **did not exist** |

So the process planned correctly and never executed. `commands/pm.ts` called
`dryRunAssignments` and stopped. The file said so honestly in its own header
comment — a dry-run that reports what it WOULD do is honest; the gap was that
nothing ever did it.

**Learning 1 — inventory by running, not by reading.** One command
(`redanvil pm app-builder`) produced the correct 6-batch plan and settled in
seconds what I had guessed wrongly from memory. The gap was one function call,
not the four subsystems I claimed were missing.

## The bug this whole exercise exists to prevent

During this session I created ~15 worktrees by hand and drove `grok` in each,
merging green branches. That reproduces the isolation the plan calls for, and it
leaked anyway: **27 absolute paths pointing into disposable worktrees were baked
into committed evidence** (`C:\Users\brian\RedAnvil-fix-prov\...`), because my
shell's working directory was left inside a worktree and checks I believed were
running "in the repo" were running from a copy.

Two independent reviewers caught it separately, on two different apps. The
failure it would have caused is concrete: `meas-known-bad` resolves fixture
paths with `existsSync` and fails closed, so deleting those worktrees — their
entire purpose — would have failed rules the change never touched.

**Learning 2 — isolation you have to remember is isolation you will forget.**
Enforcement now lives in `runRole`, the chokepoint every dispatch passes
through, and throws `RoleWorktreeError` rather than continuing.

## Design decisions worth keeping

- **The verdict ignores the agent's own output.** `runRole` computes
  `countedAsRun = exit 0 AND no missing artifacts` and never reads `res.out`.
  An agent saying "done" has never been evidence. This was already right.
- **Promotion is gated on that verdict.** A branch is never left merged when
  `countedAsRun` is false, so an agent that exits 0 having written nothing
  cannot land anything.
- **Dry-run stays the default.** `--execute` is explicit opt-in. A planning
  view that costs nothing and lies about nothing is worth keeping cheap.

## Simulation results

Recorded per run below as they complete.

### Simulation 1 — real agents, `--execute --max-iters 1`

Command: `npx tsx orchestrator/src/cli.ts pm app-builder --result results/app-builder.json --execute --max-iters 1`

**The dispatch half works.** Five disposable role worktrees were created under
the system temp directory (not in the repo, which is right) and roles ran in
parallel, in two waves:

    redanvil-role-content-msgnp3sp     ra-role-content-i1-msgnp3sp
    redanvil-role-engineer-msgnp3t4    ra-role-engineer-i1-msgnp3t4
    redanvil-role-logo-msgnp3td        ra-role-logo-i1-msgnp3td
    redanvil-role-qa-data-msgo8e9w     ra-role-qa-data-i1-msgo8e9w
    redanvil-role-qa-visual-msgo8ea7   ra-role-qa-visual-i1-msgo8ea7

The run did not finish: the process was killed by session teardown before any
role completed. Every branch still sat at the base commit `1ac9539`, so nothing
was promoted -- which is the correct outcome for roles that never finished, and
a small piece of evidence that promotion really is gated on completion.

**BUG 1 (found here, fixed) — worktrees are orphaned on termination.**
All five worktrees and all five branches survived the kill. `pmRuntime` calls
`safeRemoveWorktree` on the normal path and in a `catch`, so completion and
thrown errors are covered; process termination is not. Cleaning up by hand
afterwards is exactly the "remembered, not enforced" failure this whole exercise
exists to remove.

Fix: signal handlers for SIGINT/SIGTERM, plus -- the actual guarantee, since
SIGKILL and hard crashes cannot run a handler -- a sweep of stale role worktrees
that runs automatically at PM startup and is also available as `--clean`.
The sweep matches the role-branch naming convention only; the repo currently
holds ~20 unrelated worktrees and deleting one of those would be far worse than
the litter being cleaned.

**Learning 3 — a long-running orchestrator must assume it will be killed.**
Cleanup on the happy path and the throw path covers the cases you can imagine.
The sweep covers the ones you cannot.

### Simulation 2 — real agent, one role, with a planted orphan

Command: `pm app-builder --execute --max-iters 1 --budget 1`, after deliberately
planting a fake orphan branch `ra-role-engineer-i9-zzfake` to test the new sweep.

**The sweep works, verified in the real repository rather than a fixture:**

    pm: swept orphan role branch ra-role-engineer-i9-zzfake

and it left all ~20 unrelated worktrees and 28 branches alone. Its target list
against this repo is empty, and it rejects every near miss -- `ra-role`,
`ra-role-x`, `role-engineer-i1-abc`, `ra-role-engineer-i1` are all false, while a
genuine `ra-role-qa-visual-i1-msgo8ea7` is true.

Then the interesting part:

    pm-runtime: content: produced 4 artifact(s) (iteration 1); not promoted:
      git commit failed: pre-commit: REFUSED
        - required artifact(s) absent or empty for role content:
          src/pages/Terms.tsx, src/pages/Privacy.tsx, src/pages/About.tsx, src/pages/Contact.tsx

**BUG 2 (found here) — a role that does nothing is counted as having run.**
`runRole` decides `countedAsRun = exit 0 AND missingArtifacts is empty`. The
content role's four declared artifacts already exist in app-builder and were
committed in `ee9f80a`, long before any role ran. So the check finds them
present and counts the role as run having changed nothing at all.

The design intent is stated in runRole's own comment: an agent saying "done" is
not evidence, the artifact is. **An artifact that pre-dates the run is not
evidence either.** As written the check cannot fail for any role whose declared
artifacts are already in the repo, which is most of them.

**BUG 3 (found here) — the two artifact checks disagree on their base.**
`runRole` resolves the declared paths against `ctx.workDir`; the pre-commit hook
in `worktreeEnforcement` resolves the same paths from the worktree ROOT. One
looked for `<worktree>/app-builder/src/pages/Terms.tsx`, the other for
`<worktree>/src/pages/Terms.tsx`. That disagreement is the only reason the hook
caught what runRole had already approved -- a lucky catch, not a designed one.

**Learning 4 — "the artifact exists" is not "the agent did the work."**
Presence is necessary and nowhere near sufficient. The verdict has to compare
against the worktree's base commit: a real diff touching the declared artifacts,
with a byte-identical rewrite counting as no work.

**Learning 5 — two checks with the same name and different bases will disagree,
and the disagreement is luck.** Here it happened to catch a defect. It could as
easily have hidden one.

### Simulation 3

Not yet run.

## Open bugs

Recorded here as found, with the command that produced them.
