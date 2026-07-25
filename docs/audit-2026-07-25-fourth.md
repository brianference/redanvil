# Fourth audit — 2026-07-25

The third audit asked how many of the things we measure the gate actually checks. This one asks
two narrower questions:

1. Both apps score 100/100. **Who checked that, other than the agent who wrote the code?**
2. Coverage is 87% and 84%. **What is in the other 13% and 16%, and why?**

Neither answer was flattering.

## 1. The dashboard had never been reviewed by anyone but its author — CLOSED

`v9.0.0` ran an independent judge on app-builder and got six FAILs. The dashboard had never had
one; its judge verdicts were 10/10 PASS, written by the agent that wrote the code.

An independent reviewer — disposable worktree, fresh context, no access to the verdict file,
`file:line` evidence required — returned **4 FAILs**. All four verified as real:

| rule                     | finding                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `u-conc-use-what-exists` | the results feed was validated by a hand-rolled `typeof` chain while the monorepo standardises on Zod at every other boundary |
| `u-val-input-validation` | same root, and it **contradicted the gate**, which had marked the rule n/a — see below                                        |
| `u-test-adequacy`        | `useRuns.ts` had no test file at all, including the timeout branch added hours earlier                                        |
| `u-test-behavioral`      | twelve `length > 2` presence assertions, which pass for `"xxx"` and for the wrong page's title                                |

Across both apps the independent tier now stands at **10 FAILs in 20 rules, 9 confirmed, 1
refuted**, against **0 in 334** for the self-recorded tier. The gap, not either number, is the
finding, and `judge_dissent.mjs` prints both without averaging them.

`independent_judge.mjs` makes this repeatable rather than a one-off, and refuses to record its
own failure as agreement — it hit two real infrastructure failures while being built (a prompt
over the Windows command-line limit, then `shell: true` re-splitting unquoted argv) and reported
both as errors rather than passes.

Its output is **UNADJUDICATED** by design. A judge that can mark its own findings authoritative
is the same failure in the other direction; one of the first six claims was wrong about line
numbers and is recorded as wrong.

## 2. `n/a` was hiding a sixth of the rubric — CLOSED

Fail-closed scoring fixed pass-by-default. Nothing had ever audited **n/a**, which removes a
rule from the denominator entirely and looks principled doing it. Six rules were n/a. Every one
turned out to be a scope or tooling problem, not an absent subject:

| rule                                                                      | claimed reason                    | actual reason                                                                                            |
| ------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `u-sec-timeouts`                                                          | "no outbound fetch"               | it walked `functions/` only; the **client** made four calls, one cross-origin with **no timeout at all** |
| `ci-actionlint`, `ci-sha-pinned`, `ci-least-privilege`, `ci-no-injection` | "no workflow files"               | it looked inside the app directory; in a monorepo the workflows that build the app live at the repo root |
| `proc-pr-title-ticket`                                                    | "gh not available"                | the CLI was never installed on this machine; the REST API was always there                               |
| `u-val-input-validation` (dashboard)                                      | "no handler reads a request body" | true of `functions/`, but the app read untrusted **cross-origin** JSON in the client                     |

Each broadened rule immediately found a real defect. The dashboard's feed request could hang
forever with no timeout, leaving the app on its loading skeleton — a failure rendered as a clean
pending state. Its `typeof` chain accepted `finalScore: NaN`, `total: -1`, `evaluated: 1.5` and
an empty slug, because `typeof NaN === 'number'`.

All four broadened rules were **red-tested in a temp copy**: reverting the timeout fails
`u-sec-timeouts`; a workflow with `write-all`, an unpinned action and an untrusted
interpolation fails all four `ci-*` rules from a nested app directory; removing the schema fails
`u-val-input-validation`.

Coverage: **87% → 96%** and **84% → 95%**, with `--min-coverage 90` now enforced and the `ci`
lane waiver removed. `proc-pr-title-ticket` remains n/a and that is now the honest answer: this
repo pushes straight to master and has zero PRs, so there is nothing to measure and a pass would
be fabricated.

## 3. Every generated app looked the same, and the rules were the reason — CLOSED

Not a bug in following the rules. §7.3 is a list of constraints — token-only colour, 44px
targets, AA contrast, a sticky shell, five required routes — and they are **identical for every
app**. An agent handed only constraints satisfies all of them and builds the same centred column
under a sticky header, every time. Nothing in the spec was asking for a different product.

§7.3a now carries a layout archetype and a visual direction chosen deterministically from the
app's own inputs, plus an explicit list of shells the app must **not** fall back to. Measured
over eight sample ideas: six distinct archetypes, five distinct visual directions, varying
independently. Design rule **R21**.

## 4. Two defects only a screenshot could show

`fe-responsive-375` tests horizontal overflow. An ellipsis is not overflow — it is the layout
succeeding at hiding the problem. At 375 the dashboard rendered `TOTAL R…`, `AVG SCO…` and
truncated `1 iteration` to `1 iter…`: the label that says what the number means, and the count
you actually scan for. Both wrap now.

This is the same class as v9's footer lockup, and the same conclusion: a rule that can only be
judged from a rendered page needs a screenshot artifact produced every time, not a note.

## Still open

- **The duplication ratchet is 387** and every remaining offender is genuine shared shell code
  needing parameterisation, not relocation.
- **The independent judge is not on a cadence.** `grok` authenticates interactively, so CI
  cannot run it. `judge_dissent.mjs` reports how far each review has drifted behind HEAD and
  names any app that has never had one, but a human has to act on that.
- **§7.3a is proven at the spec level, not the built-app level.** The variation is enforced by
  test on what the PRD says; no app has yet been generated end-to-end and inspected to confirm
  it actually looks different.
