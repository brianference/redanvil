# Pipeline simulation — 10 runs, what broke, what to change

Ten product ideas driven through the real pipeline: wizard answers → PRD → job → scaffold →
deterministic gate checks. Every figure below came out of
`orchestrator/scripts/simulate_pipeline.mts`; the raw per-run records are in
`evidence/simulation-runs.json`. Nothing here is estimated.

## What the runs measured

| Stage | Result |
|---|---|
| PRD self-check clean | 10 / 10 |
| Job passes `JobSchema` | 10 / 10 |
| Scaffold succeeds | 10 / 10 (19 files each) |
| Deterministic checks all-pass on the bare scaffold | 0 / 10 |

PRD size ranged 24,386–33,391 characters with 7–9 vertical slices, tracking entity count and
whether auth was in scope. The checks line was identical on every run: **15 pass / 14 fail /
5 not-applicable**.

That the check result never varied across ten different products is itself the finding. A
scaffold is a skeleton, so failures like `u-typing-strict` or `u-test-presence` are expected —
there is no app yet. But the invariance says those 14 failures are a property of the scaffold
template, not of any product idea, which makes them fixable once rather than fourteen times per
build.

## Bug 1 — three rules claim to be deterministic and are implemented nowhere

The rubric declares 28 rules with method `det`. Implementations live in two separate places:
5 as `ruleId` entries in `APP_CHECKS` (`orchestrator/src/commands/gate.ts`), 22 as `case`
blocks in `orchestrator/scripts/checks/check.mjs`.

Three exist in neither: `ci-actionlint`, `proc-conventional-commits`, `proc-pr-title-ticket`.
Run any of them and `check.mjs` prints `unknown rule` and exits non-zero.

They have been invisible because every real gate invocation passes `--na ci,process`, which
excludes their lanes. So a 45/45 result includes three rules that were never measured. The
exclusion is defensible on its own; the rubric asserting a machine decides them is not.

The structural cause is that nothing connects the rubric to its implementations. Two registries,
no link, no test. That is now closed by a coverage test asserting every `det` rule resolves to an
implementation in one of the two registries, with the check-ids read out of `check.mjs` as text
rather than restated in the test — a hard-coded list would drift from reality exactly like the
thing it guards.

## Bug 2 — every generated app starts life failing its own rule pack

Two of the 14 failures are not "the app isn't built yet". They are artifacts the scaffold is
supposed to produce and does not:

- `fe-seo-assets` — `public/robots.txt` is emitted, `public/sitemap.xml` is not, and the per-app
  rule pack requires both.
- `u-plat-migrations` — `wrangler.toml` declares a D1 binding while no `migrations/` directory
  exists, so the schema is not reproducible from a fresh clone. The PRD already contains the DDL.

Both are deterministic, both are known at scaffold time, and both currently become work for the
build loop. Emitting them in the scaffold raises the floor for every generated app instead of
paying for them once per build.

## Bug 3 — a content scanner matched its own pattern

`u-data-no-placeholder` failed against `app-builder` on this line:

```
app-builder/src/lib/prd.ts:978: const PLACEHOLDER_RE = /\b(TBD|TODO|FIXME|lorem ipsum)\b/i;
```

The detector flagged the regex that defines it — the same self-match that once blocked a
secret-scanner's own install commit. Fixed by blanking regex literals before scanning, so
placeholder text in a string, JSX, or seed object is still caught. Proven green → red → green:
with the fix in place, injecting `'john.doe@example.com'` into a real source file still fails
the check.

The general lesson: any scanner whose pattern is expressible in the language it scans will
eventually match itself. Exclude pattern definitions, never the file.

## Bug 4 — two CLI paths reported success while doing less than asked

Both found by running the gate by hand rather than through a script that already had the flags
right.

- `parseArgs` ran with `strict: false` and no follow-up validation. `--verdicts` (the wrong name
  for `--judge`) was silently dropped; the gate evaluated **23 of 45 rules** and exited 0.
- `--out` without `--slug` wrote no file at all and still exited 0, leaving the previous run's
  rubric hash in the committed result while appearing to have refreshed it.

Both now exit 2 with the reason. A tool that silently narrows its own scope while reporting
success is worse than one that crashes.

## Bug 5 — the commit guard gave a false green

`verify_commit.mjs` checks a ref out into a throwaway worktree and builds it. It correctly
refused the broken commit and cleared the fix. Then CI failed anyway, because the guard runs
typecheck / tests / build while CI also runs results-provenance, the dashboard feed derivation,
and design-rule verification.

A guard that covers less than CI will eventually clear something CI rejects. Either it runs what
CI runs, or its output has to say what it did not cover.

## Process learnings

**The simulation's own first result was wrong, and that was useful.** Run one reported
`RULES.filter is not a function` for all ten ideas, because the harness imported the rubric as
`RULES` while a local constant of the same name held the corpus path. A harness that had silently
skipped the failing stage would have produced a clean, meaningless report. Recording a thrown
stage as a failure with its message is what surfaced it.

**Delegating to an agent in its own worktree removed a whole failure class.** Two CI breaks
earlier in this work came from committing while a delegated agent was mid-write in the shared
tree. With the agent isolated in a worktree, the main tree stayed committable throughout — a
915-line component split and three fixes landed with no interleaving risk.

**Judge disagreement is signal, and the fail is the accurate side.** Two independent judges over
the same rules agreed on 6 and disagreed on 4. Every one of the 4 was a real defect the passing
judge missed. Resolving a disagreement to the failing verdict and diagnosing it — rather than
averaging or arguing it down — found a 915-line component, a tested-but-unused export, a constant
declared three times, and a set of presence-only assertions.

## What to change

1. Scaffold emits `public/sitemap.xml` and `migrations/0001_init.sql` from the PRD's DDL.
2. Coverage test binds the rubric to its implementations (done).
3. `verify_commit.mjs` either runs the provenance and feed jobs too, or reports its own gaps.
4. Keep `--na ci,process` only while those three rules are genuinely unimplementable locally;
   once implemented, drop the exclusion so the score covers them.
