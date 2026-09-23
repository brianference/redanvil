# Drift coverage mismatch

The daily Drift re-gate fails in results verification, not because CI is missing a browser. Re-running the gate drops 22 recorded verdicts as stale. The committed app-builder result still says those rules were measured. The two disagree, so `verify_results.mjs` exits 1.

Run 35763018220 (2026-09-22, job drift, commit `f48afd7d`) and a local re-run of the same command produce the same 22 rule ids.

## What the job runs

Drift calls the verifier after the live audits:

```
node .github/scripts/verify_results.mjs app-builder results/app-builder.json evidence/verdicts-app-builder.json process
```

`.github/workflows/drift.yml` (the re-gate step) and `.github/workflows/ci.yml` `results-provenance` use that command. `dashboard-provenance` and drift's dashboard step use the same script against `results/dashboard.json` and `evidence/verdicts-dashboard.json`.

`verify_results.mjs` re-runs the gate and compares the new result to the committed one. The argv it builds is `tsx orchestrator/src/cli.ts gate <appDir> --threshold <committed.threshold> --judge <verdictFile> --slug <committed.slug> --out <tmp>`, plus `--na process` when that argument is present (`verify_results.mjs` lines 46-60). For app-builder that threshold is 90.

The coverage failure is the evaluated-count check at `verify_results.mjs` lines 125-150. It prints every rule id present in one `rules` array and absent from the other.

## The 22 rules are dropped as stale

The gate parses verdicts in `parseSharedRunFlags` (`orchestrator/src/cli.ts` lines 60-67) and passes them through `parseVerdicts`. A verdict whose reviewed files changed since `reviewedCommit` is removed from the outcomes (`orchestrator/src/schemas/verdicts.ts` lines 406-419). It is not a validation error. The gate still writes a result. Rules that have no other check simply disappear from `rules`, so `evaluated` falls and `total` stays put.

`findStaleVerdicts` (`orchestrator/src/gate/freshness.ts` lines 59-85) asks `gitChangeProbe` (`freshness.ts` lines 140-165) for `git diff --name-only <reviewedCommit> -- <scope>`. Every one of the 22 verdicts in `evidence/verdicts-app-builder.json` is pinned to `466b15be5a2889a5fbad16766e0168e0e4247ed0`.

Their scopes are three groups:

- The 16 visual rules (`fe-a11y-contrast` through `fe-desktop-width`, including `fe-design-archetype` and `fe-cold-visitor`) scope `app-builder/src`, `app-builder/public`, and `app-builder/index.html`. Example: `fe-touch-targets` at `evidence/verdicts-app-builder.json` lines 13-17.
- `u-conc-idiomatic`, `u-conc-no-speculative-abstraction`, and `u-conc-smallest-diff` scope `app-builder/src/lib` (and, for the third, `app-builder/src/components`). Lines 226-229 and 273-276.
- `u-test-adequacy`, `u-test-behavioral`, and `fe-fail-closed-states` scope `app-builder/src`. Lines 320-322, 335-337, and 366-368.

`u-conc-use-what-exists` and `fe-pages-compose` scope only `app-builder/src/components` (lines 258-260 and 351-353). `u-val-input-validation` and `u-sec-no-stub-paths` scope `app-builder/functions`. Those four stay measured. The split is the scope, not the method.

`git diff --name-only 466b15be5a2889a5fbad16766e0168e0e4247ed0 HEAD -- app-builder/src` lists 13 files, all under `app-builder/src/lib/prd`:

```
app-builder/src/lib/prd.characterization.fixtures/mobile-no-auth-two-entities.json
app-builder/src/lib/prd.characterization.test.ts
app-builder/src/lib/prd.test.ts
app-builder/src/lib/prd/auth-identity.test.ts
app-builder/src/lib/prd/generate.ts
app-builder/src/lib/prd/naming.test.ts
app-builder/src/lib/prd/naming.ts
app-builder/src/lib/prd/sections/capabilities.test.ts
app-builder/src/lib/prd/sections/capabilities.ts
app-builder/src/lib/prd/sections/features.test.ts
app-builder/src/lib/prd/sections/features.ts
app-builder/src/lib/prd/sections/slices.ts
app-builder/src/lib/prd/types.ts
```

The same 13 are what the drift log names (`fe-touch-targets: 13 file(s) under review changed since 466b15be5a28`, and the first five paths are the fixture, the two top-level tests, `auth-identity.test.ts`, and `generate.ts`). They arrived in `2491f21`, `c9a9b21`, and `86e8d25` (2026-08-20 and 2026-08-21). `git diff --name-only 466b15be 3693c80 -- app-builder/src` is empty. `3693c80` is `results/app-builder.json`'s old `provenance.commit`, and that file's `staleVerdicts` was `[]` with `evaluated` 83. The result described the tree at the time it was written. It was not rewritten after the PRD generator moved.

`u-conc-smallest-diff`, `u-test-adequacy`, and `fe-fail-closed-states` are `det+judge` in `orchestrator/src/rubric/rules.ts` but they are not in `APP_CHECKS`, so the verdict is their only outcome. Once it is dropped, the rule is absent. The visual rules are `visual` and have no deterministic check either.

## Hypotheses that do not explain this failure

Shallow clone. Drift already checks out with `fetch-depth: 0` (`.github/workflows/drift.yml` lines 39-42) because an unresolvable `reviewedCommit` drops every verdict (`freshness.ts` lines 134-150). This repo is not shallow (`git rev-parse --is-shallow-repository` is `false`), and `git cat-file -t 466b15be` returns `commit`. The log says "changed since", not "not resolvable".

Gitignored evidence. `.gitignore` lines 11-12 say recorded evidence under `evidence/` is tracked. A missing evidence path throws from `verdicts.ts` lines 374-378 before any result is written. The verifier got a result and compared coverage, so the files were there.

Earlier steps in the job overwriting evidence. The local command below does not run axe, cold-visitor, design audit, or desktop width. It still drops the same 22 rules. The `--claims` note in `drift.yml` is a previous failure mode (`fe-design-archetype` missing from a design-audit file). It is not this one.

Different flags. `notApplicable` matched before the coverage check. Both sides waive `fe-result-in-viewport`, `proc-pr-title-ticket`, `process`, `u-claims-covered`, `u-competitor-scan`, and `u-integration-scan`. Score matched too (both 0). Rubric hash matched. The only disagreement was the 22 missing rule ids.

One local footgun is not the CI bug. `lg-push-cadence` is n/a when the branch has no upstream (`orchestrator/scripts/checks/lg-push-cadence.mjs` lines 176-178 and 250-254). This worktree's `b1-drift` had none, so the first local run scored 60/82 and failed on `notApplicable` before it reached coverage. CI's checkout has an upstream and passes the rule (threshold is 20). After `git branch --set-upstream-to=origin/master`, the local run matched CI's 61/83.

## Command output

Local reproduction, after the branch tracked `origin/master`. Exit code 1.

```
node .github/scripts/verify_results.mjs app-builder results/app-builder.json evidence/verdicts-app-builder.json process
```

```
gate: 22 verdict(s) dropped as stale -- their subject changed since review.
gate: FAIL -- score 0/100 (threshold 90), evaluated 61/83 rules, coverage 86% of the full rubric (n/a: fe-result-in-viewport, proc-pr-title-ticket, process, u-claims-covered, u-competitor-scan, u-integration-scan)
RESULTS VERIFICATION FAILED: coverage mismatch: committed 83/83, reproduced 61/83.
  measured when the result was committed but NOT reproduced here (22): fe-a11y-contrast, fe-cold-visitor, fe-cross-link, fe-design-archetype, fe-desktop-width, fe-fail-closed-states, fe-no-attribution, fe-noncolor-state, fe-premium-nav, fe-product-completeness, fe-required-pages, fe-responsive-375, fe-safe-areas, fe-seo-og, fe-touch-targets, fe-type-floor, fe-visual-review-recorded, u-conc-idiomatic, u-conc-no-speculative-abstraction, u-conc-smallest-diff, u-test-adequacy, u-test-behavioral
  the reproduction introduced no rule the committed result lacks.
```

That is the same list as run 35763018220.

## Fix

The verifier was not loosened. The 22 rules cannot be counted from these verdicts anymore, because the files under their scopes changed and nobody re-reviewed them. The committed result was regenerated with the gate, not edited by hand:

```
npx tsx orchestrator/src/cli.ts gate app-builder --threshold 90 --judge evidence/verdicts-app-builder.json --slug app-builder --out results/app-builder.json --na process
```

The new file has `evaluated` 61, `total` 83, `finalScore` 0, `provenance.dirty` false, and `provenance.staleVerdicts` equal to those 22 ids. A second `verify_results.mjs` run then exited 0:

```
results verified: app-builder reproduced at 0/100, 61/83 rules, 69 outcomes matched.
```

`results-provenance` reads that same file, so it gets the same agreement. No separate change to `ci.yml` was required for the coverage mismatch.

Dashboard does not have this coverage bug. `git diff --name-only ac72009 HEAD -- dashboard/src dashboard/public dashboard/index.html dashboard/functions` is empty, and `ac72009` is the only `reviewedCommit` in `evidence/verdicts-dashboard.json`. Its re-gate already scored 84/84. It failed afterwards on one rule: `proc-conventional-commits`. The last 20 subjects include three that are not conventional commits: `f48afd7d` "Media and copy for the RedAnvil launch post", `15d7a54e` "Write down how a generated app sends mail", and `c5841be3` "Keep the patterns that won, and what they cost to get right". The check is `orchestrator/scripts/checks/proc-conventional-commits.mjs` lines 34-35 and 122-126, window of 20 (`RECENT_COMMIT_WINDOW`). The committed dashboard result still said that rule passed. Regenerating it with the same gate command flipped that one rule to false. Re-verify exited 0:

```
NOT COMPARED  lg-result-reproduces: committed false, reproduced true -- self-referential, see SELF_REFERENTIAL_RULES
results verified: dashboard reproduced at 0/100, 84/84 rules, 92 outcomes matched.
```

`lg-result-reproduces` is skipped on purpose (`verify_results.mjs` lines 169-189). `results/all.json` was rewritten with `node .github/scripts/build_feed.mjs`. `build_feed.mjs --check` printed `feed matches 5 result file(s)`.

`quickflight-provenance` on CI run 33218533070 succeeded. QuickFlight's result lives in `brianference/quickflight`, which is not in this worktree, so nothing here was changed for it.

The drift job had no `timeout-minutes`. Run 35763018220 lasted about 5 minutes (17:48:22 to 17:53:28) and died at the app-builder re-gate; the gate portion was about 3 minutes (17:50:22 to 17:53:22). Runs 34883822976 and 34507788362 ran 48 and 49 minutes. The job is now capped at 20 minutes, the same cap `results-provenance` and `dashboard-provenance` already use (`.github/workflows/drift.yml` lines 26-34).

The score stays 0. Visual blockers are fail-closed when their verdict is dropped (`orchestrator/src/commands/gate.ts` lines 276-287), and other rules were already failing. Drift's later `meets_the_bar` step is still expected to fail. That is a different, honest refusal. This change only makes the reproduction match the committed result.
