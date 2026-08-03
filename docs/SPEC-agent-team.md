# Spec — build the autonomous app team

Scope: `orchestrator/` only. Do **not** touch `az-planting-calendar/` or
`app-builder/`. No git add/commit/push, no deploy.

Inherited rules — see `rules/base-15.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function.
- Fail closed. Unknown state is an explicit failure, never silent success.
- Small, single-purpose files. Write `--`, never a unicode em dash.

Read `docs/PLAN-autonomous-app-team.md` first -- it carries the reasoning and the
table mapping each real defect from this session to the role that now owns it.

Two decisions are already made; do not re-open them:

- **QA-visual may fail a build that passes every mechanical rule.** Its verdict
  is a gate input, not advice. This is the entire gap being closed.
- **No budget ceiling. The loop does not halt.** It runs until every checklist
  row passes and `user-refuse` accepts. It may never lower a bar to converge --
  the way out is finishing the work, not redefining it.
- **Split execution 50/50 between Grok Build and Claude** to control cost. See
  section 5c.

## 1. Role registry — `src/team/roles.ts`

Nine roles. Each declares: `id`, `owns` (rubric rule ids and checklist row ids),
`artifacts` (repo-relative paths it must produce), `needsWorktree`, and a
`prompt` describing its single job.

| id | owns | must produce |
|---|---|---|
| `pm` | the loop and `isDone` | `results/<slug>.json` |
| `brainstorm` | feature gaps | `docs/<slug>-features.md` ranked, each with a data-source note |
| `logo` | `fe-brand-mark`, `fe-brand-mark-size` | 3 marks + gallery + `DECISION.md` |
| `layout` | `proc-design-options` | 3 options each for home, header, footer, inner page |
| `content` | `fe-legal-substance`, `u-no-placeholders` | legal pages + every empty/boundary state |
| `engineer` | functional rules | app source (delegates to Grok Build) |
| `testwriter` | `u-test-acceptance`, `u-claims-covered` | acceptance tests written from the PRD **before** the engineer builds |
| `qa-visual` | `fe-result-in-viewport`, `fe-responsive-375`, product judgement | `evidence/qa-visual-<slug>.json` |
| `qa-runtime` | `lg-bindings-bound`, `u-api-real-output` | `evidence/qa-runtime-<slug>.json` |
| `qa-data` | `D5`, `fe-resource-links` | `evidence/qa-data-<slug>.json` |
| `debugger` | root cause of any failing measurement | `evidence/diagnosis-<slug>.json` |
| `user-refuse` | the product as a stranger sees it | `evidence/refusal-<slug>.json` |

A role that returns without its artifact on disk counts as **not run**. Never
accept a summary in place of a file.

## 2. Row-to-role assignment — `src/team/assign.ts`

`assignUnmetRows(statuses, roles)` maps each non-passing checklist row to the
role that owns it, via the `owns` declarations plus `CHECKLIST_RULE_MAP`.

A row owned by nobody is an **error**, not a silent skip -- print it and fail.
That is the exact hole that let the three-option step go unbuilt.

## 3. QA-visual — `src/team/qaVisual.ts` and its check

The load-bearing role. It opens screenshots and reports what a person notices
first, then records a verdict that the gate reads.

For each route, at 375/768/1280 in both themes:

- capture, then **pass the image to the agent for description** -- not an
  assertion over the DOM. The whole point is judgement a rule cannot make.
- measure and record: the y of the primary control's result, header height
  versus hero space, brand-mark rendered height, truncated element count
  including placeholders, and whether the primary action is above the fold.
- the agent answers three questions in writing: what would a first-time visitor
  try first; is anything important off-screen; does this look finished.

Writes `evidence/qa-visual-<slug>.json` with `{ verdict: 'pass'|'fail',
findings: [...], measurements: {...} }`. A `fail` blocks `isDone` even at 100/100.

### QA-visual is tested by both runners

The measurer needs its own tests, or it becomes the next thing nobody validated.
Every new check this session was wrong on first run, always in the flattering
direction, so QA-visual gets covered by **both** runners at the layer each is
actually good at:

- **Vitest** covers the pure functions -- the pass/fail decision over a metrics
  object, the sr-only and scroll-container exclusions, the y-versus-viewport
  comparison, verdict serialisation. Fast, table-driven, no browser.
- **Pytest + hypothesis** covers the properties that hold for *any* page rather
  than the handful someone thought to write down:
  - a result whose y exceeds the viewport height always fails, for every
    generated viewport and y;
  - a control above the fold with a visible result always passes;
  - the verdict is invariant to element order and to how many elements were
    measured -- a page with 200 nodes and one with 3 must be judged the same way;
  - no combination of metrics yields "pass" when the primary result is
    off-screen. That is the property this session violated.

Export the decision function as pure, taking a metrics object and returning a
verdict, so both runners exercise the same code path the gate uses. If the
decision only exists inside a Playwright script, neither runner can reach it and
the measurer stays unvalidated.

Ship it with a known-bad fixture too: a page whose search result renders 1000px
below the fold must FAIL, and the same page with the result beside the input
must PASS. That is this session's defect, encoded as a fixture rather than a
memory.

## 3b. The user-refuse role — the one that would have saved 40 turns

This session took roughly forty user messages to ship one app, and nearly every
one was the user finding something no rule caught: search below the fold, a 32px
mark, spring unreachable, no coverage explanation, no crop guides. That is not a
gate problem. It is that **nobody was playing the user.**

`user-refuse` runs LAST, after everything else reports green, and its default
answer is no.

It receives only what a stranger gets: the deployed URL and the app's own
description of itself. Not the PRD, not the checklist, not the diff -- those
tell it what was intended, and intent is exactly what corrupted every other
judgement in this session.

It must:

- Try to accomplish the app's stated purpose end to end, and say plainly whether
  it could.
- Name the first three things it would complain about.
- Answer: is any primary control's result off-screen; is anything advertised
  that does not work; does any state look like a bug; would a reasonable person
  call this finished.
- Return `{ verdict: 'accept' | 'refuse', complaints: [...] }`.

**A refusal blocks `isDone` at any score.** It may only be overridden by a
recorded human decision in `evidence/refusal-<slug>.json`, never by another
agent and never by the PM.

Its complaints are fed back as work for the owning roles, and the loop runs
again. The run is finished when a role playing a stranger, told to be hard to
please, stops complaining -- not when the rules go green.

Seed its prompt with the real complaints from this session so it knows the
standard: "the search doesn't appear to work", "the logo is way too small",
"I can't type Sierra Vista", "there's no autocomplete".

## 4. Test runners — vitest and pytest

New rule `u-test-runners`, per-runner and fail-closed, so a green vitest cannot
hide a red pytest.

- Detect configured runners: `vitest.config.*` / `package.json` -> vitest;
  `pytest.ini`, `pyproject.toml [tool.pytest]`, or a `tests/` with Python ->
  pytest.
- Run **each** detected runner and require each to pass independently.
- n/a only when a runner is not configured. Do not add pytest to a project with
  no Python.
- Report which runners were detected and each one's result, so "1 runner passed"
  can never read as "all tests passed".

Where pytest earns its place: the data pipeline -- source transcription,
citation integrity, link resolution. Add a `hypothesis` property test as the
reference example: every planting window resolves to a source, and no window
falls outside its publication's stated range.

## 5. PM orchestrator — `src/team/pm.ts`

Extends `loop/ralph.ts`; do not write a second loop engine.

```
for iteration in 1..maxIters:
  read gate result + checklist statuses
  assign unmet rows to owning roles        (unowned row -> hard error)
  run assigned roles in parallel, each in its own worktree
  promote only worktrees whose own gate is green
  run the full gate, then the independent judge over the diff
  if isDone() AND user-refuse accepts -> deploy, verify served hash, stop
  else -> feed verbatim failures forward and continue

  no iteration cap, no budget ceiling: the loop exits by finishing.
  if two iterations produce no score change, ESCALATE THE STRATEGY --
  reassign the row to a different role, or split it -- never stop.
```

Hard rules the PM enforces:

- No role marks its own work done; the measurement decides.
- Never lower a bar to converge. When stuck, change approach, not the bar.
- Never stop short. A stalled row gets reassigned or decomposed, not abandoned.
- Never stage or commit while a delegated run is in flight.
- Roles that only read (`brainstorm`, judge) get no worktree.

## 5c. Splitting work between Grok Build and Claude

Roughly **half the executed work goes to each**, chosen by fit rather than by
alternating, so cost drops without quality dropping.

**Grok Build takes the volume work** -- it has no session limit and is the
cheaper seat:

- `engineer` -- schema, API, UI implementation
- `logo` -- generation via `image_gen` (Grok Imagine)
- `content` -- long-form legal and copy to the required floors
- `testwriter` -- acceptance and unit test bodies
- per-item imagery at scale

**Claude takes the judgement work**, where being wrong is expensive and a fresh
sceptical read is the product:

- `pm` -- assignment, promotion, the finish line
- `qa-visual` -- opening images and saying what a person notices
- `user-refuse` -- the stranger's verdict
- `brainstorm` -- what the PRD forgot
- the independent judge over the diff
- `debugger` -- root cause before any fix

The rule that makes the split safe: **whichever side produces, the other side
checks.** Grok's output is verified by a Claude role reading the real diff and
the real artifact, never its summary. Claude's output is reviewed by Grok with a
fresh context -- that pass returned 5 real FAILs out of 10 on this app when a
self-review would have returned zero.

Record which engine ran each role in the result file, so the split is auditable
rather than assumed.

## 5b. Hard enforcement inside the worktree

Every guard so far lives outside the agent: a rule it can forget to run, a
reviewer it can talk past. Put the enforcement where the work happens, so an
agent physically cannot report done.

`worktree/isolate.ts` must install, into **every worktree it creates**:

- **A pre-commit hook** that refuses a commit when the worktree's own gate is
  red, when `unimplementedRows()` is non-empty, or when a required artifact for
  the assigned role is absent from disk. The role declares its artifacts in the
  registry; the hook reads that declaration.
- **A pre-push hook** that runs `meets_the_bar` for the app, exactly as the
  repo's own hook does. A worktree must not be able to push what the main tree
  would refuse.
- **A `.redanvil/assignment.json`** written at creation: the role id, the
  checklist rows it owns, and the artifacts it must produce. The hooks read this
  rather than trusting anything the agent says.
- **A commit-msg hook** that rejects a message containing done, complete,
  finished, working, verified or passing unless the matching measurement file
  exists and its own recorded outcome is a pass. Words are not evidence.

`promoteWorktree` must additionally refuse when:

- the assignment's artifacts are missing or empty,
- any artifact's mtime predates the worktree's newest source commit -- stale
  evidence is the re-stamping failure in another costume,
- the QA-visual verdict for the app is `fail` or absent.

`--no-verify` must not be a way out: the promote path re-runs the same checks
server-side rather than trusting that the hooks ran. A hook the agent can skip
is a suggestion.

Ship this with a known-bad test: a worktree whose role produced no artifact must
fail to commit; the same worktree with the artifact present must succeed.

## 6. Wire into the finish line

`isDone` gains `qaVisualOk`. When the QA-visual verdict is `fail` or missing,
`isDone` is false regardless of score. Add it to `DoneOpts`, the `.d.mts`, and
`coverage.mjs` as the binding for the product-judgement rows.

## Proof required

Report each with real output:

- `assignUnmetRows` unit tests: every checklist row maps to a role; an unowned
  row raises.
- QA-visual against both fixtures: the below-the-fold page FAILS, the fixed page
  PASSES, with the real output.
- QA-visual's decision function covered by BOTH runners: vitest unit output and
  pytest/hypothesis property output, each pasted. The hypothesis run must show
  the number of examples tried, not just "passed".
- `u-test-runners`: a project with a failing pytest and a passing vitest must
  FAIL, with both runners named in the output.
- `isDone` returns false at score 100 when the QA-visual verdict is `fail`.
- A dry-run of the PM over the existing `az-planting-calendar` result, printing
  the role assignments for its unmet rows. Do not mutate that app.
- `user-refuse` against a fixture whose search result renders below the fold:
  it must REFUSE and name that complaint. Against the fixed page: accept.
- `isDone` returns false at score 100 when the refusal verdict is `refuse`.
- Worktree enforcement: a worktree missing its role's artifact FAILS to commit,
  and the same worktree with the artifact present commits. Real hook output.
- A commit message saying "done" with no passing measurement file is REJECTED.
- `npm run typecheck`, `npm run lint`, `npm test` at the repo root.
- `unimplementedRows()` still `[]`.

Build the mechanism only. Do not run it against a real app in this pass.

## 7. What running it for real proved wrong

RA-175 shipped this spec. Running the resulting team the same day surfaced three
coordination failures at the scheduling layer, above the tree isolation this spec
already required -- full reasoning and the fix for each is in
`docs/PLAN-autonomous-app-team.md` Part 8:

- Two roles idled waiting on each other's not-yet-written artifact, because
  `owns` declares output but nothing declares input. Add `dependsOn: string[]`
  to the role registry and topologically sort dispatch per iteration.
- `reverify` deadlocked against a tree it could not clear, documented in
  `0440921`. The immediate cause (stale hand-named evidence paths) is fixed; the
  general case -- two agents sharing one physical tree can dirty it for each
  other -- is not. The PM must never assign two roles to the same tree in one
  iteration.
- Two roles wrote to the same shared artifact path (`evidence/measurement-meta.json`
  is exactly this shape) and the second promote silently dropped the first
  role's entry. A shared-writable path must be declared as such and merged by
  key on promote; an undeclared collision fails the same way an unowned row
  does -- print it, do not let it happen silently.
