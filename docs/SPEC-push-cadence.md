# SPEC — make a large unpushed backlog a defect, not a habit

## The problem this fixes

RedAnvil's pre-push hook refuses unless every app in the push range clears the
finish line. The intent was good; the effect was that 134 commits accumulated
locally over several sessions while one app's deferred defect held every other
app's finished work. A release that large is untestable, unreviewable, and its
CI signal is useless — if it breaks, nobody can say which of 134 commits did it.

The gate today can only say "this is not good enough to push". It has no way to
say "this has been unpushed too long". So the only pressure in the system pushes
toward hoarding.

## What to build

A new deterministic rule, `lg-push-cadence`, that FAILS when the local branch is
too far ahead of its remote. A backlog becomes a defect the gate reports, the
same as any other.

### Rule behaviour

- Rule id: `lg-push-cadence`. Method `det`. Severity: `blocker`.
- Measure: `git rev-list --count <remote-tracking-ref>..HEAD` for the current
  branch.
- Threshold: **20 commits**. Define it as a single exported named constant, no
  magic number at the call site.
- PASS when the count is at or below the threshold.
- FAIL when it is above, with a message naming the actual count, the threshold,
  and the remedy ("push now; the waiver file exists so one app's deferred defect
  does not have to hold a release").
- `notApplicable` (exit 3) when there is genuinely no remote-tracking branch to
  compare against — a repo with no `origin` cannot have a backlog. It must NOT
  return n/a merely because the git command failed for another reason; an
  unresolvable git state fails, because "could not measure" is not "measured
  fine". This distinction is the whole point — get it right.

### Why a blocker rather than a warning

A warning would be ignored, which is how the 134 got there. But note the
interaction and handle it: `lg-push-cadence` failing must NOT make it impossible
to push, or it recreates the deadlock it exists to prevent, one field over. The
pre-push hook already exports `REDANVIL_PRE_PUSH=1`; while that is set, this
rule must report its finding and PASS, exactly as `lg-shipped` condition 2 does
for the unpushed-commits condition. Read how `lg-shipped.mjs` does this and
follow the same shape — do not invent a second convention.

CI does not set the variable, so on the remote the rule is enforced literally.

## Non-negotiable: prove it can fail

For each of the three outcomes, build the input that produces it and read the
exit code. A check confirmed only on its good case is not a check.

1. A fixture repo with a remote-tracking ref and more commits than the threshold
   → exit 1, message naming the real count.
2. The same repo at or below the threshold → exit 0.
3. A repo with no remote-tracking branch → exit 3 (n/a).
4. With `REDANVIL_PRE_PUSH=1` set and a backlog over the threshold → exit 0,
   with the finding still printed.

Write these as tests in `orchestrator/test/`, following the existing known-bad
style in `checklistRound2.test.ts` (each known-bad test logs the failure message
it produced). Use temp git repos; do not depend on this repo's own state, which
changes on every commit and would make the test's result a function of when it
ran.

## Wiring

- Implement in `orchestrator/scripts/checks/lg-push-cadence.mjs`, exporting a
  pure evaluator plus a `runLgPushCadence(appDir, io, deps)` runner, matching the
  shape of the sibling checks in that directory.
- Add the `.d.mts` declaration next to it. `tsc --noEmit` must stay at zero
  errors; a missing declaration is a TS7016 error under this repo's config.
- Dispatch it from `orchestrator/scripts/checks/check.mjs` in the same `switch`
  the other rules use.
- Register it in `orchestrator/src/rubric/rules.ts` and add `det('lg-push-cadence')`
  to `APP_CHECKS` in `orchestrator/src/commands/gate.ts`.
- Injectable deps for the git call, so the tests do not shell out to a real
  network remote.

## Constraints

- Do NOT push, deploy, amend, rebase, or touch `.git` state outside the fixture
  repos your tests create.
- Do NOT modify `.redanvil/known-issues.json`, any `results/*.json`, or anything
  under `evidence/`.
- Do NOT weaken, waive, or delete any existing rule or test to make this pass.
- `npm run typecheck` and `npm run lint` must both exit 0 when you are done.
- Every function gets a JSDoc comment. No `console.log` for control flow. No
  hardcoded magic numbers.
- If you must prove a test is not vacuous by breaking the implementation, do it
  in a TEMP COPY, never in place.

## What to report back

The files you changed, the four exit codes you actually observed (not what you
expect them to be), and anything in this spec you think is wrong. If you believe
a requirement here is a mistake, say so rather than implementing it silently.
