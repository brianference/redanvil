# RCA — a mandatory, enforced design step was skipped entirely

Date: 2026-08-05. Written after being called on it, not volunteered, which is
itself part of the finding.

## What was supposed to happen

Per the process map and `RedAnvil-agents.md`, every new app passes through:

    PRD in -> brainstorm -> design variations (logo x3, layout x3 per surface)
           -> user picks (proc-design-options) -> testwriter -> build -> ...

The `logo` role must produce `mark-01..03.png`, `gallery.html` and a
`DECISION.md`. The `layout` role must produce three structurally distinct
options each for home, header+search, footer and one inner page, with a gallery
at 375/1280 in both themes and a `DECISION.md`. The user picks. Nothing builds
before that.

## What actually happened

Across an entire session I produced **zero** logos, **zero** design variations,
**zero** galleries, and opened **no** folder for review. I did not run the design
roles once. The gap surfaced only when the user asked to see previews.

## Root cause

**I was gate-driven, not product-driven.** My working queue was "whatever the
gate reports failing." Design variations for a new app never appear in that
queue, because no new app existed. The gate measures what has been built; it
cannot ask for what was never started. I let the gate's output define the job,
and the job was larger than the gate.

Three contributing causes, each verified in the code rather than assumed:

1. **The connector does not exist.** `orchestrator/src/commands/scaffold.ts` --
   the new-app entry point -- imports nothing from `team/` or `worktree/`
   (grep count: 0). Starting a new app does not engage the agent team at all.
   The project's own agent roster doc already recorded this as **"Not
   connected"**. So there was no path from "new app" to "design roles ran", and
   I compensated by hand-driving individual steps instead of building the
   missing connector. Hand-driving *was* the bug, not the workaround for it.

2. **The hard enforcement drawn in the diagram is not installed.**
   `core.hooksPath` is `.githooks`, which contains only `pre-push`, and that file
   contains **zero** references to the team enforcement library.
   `orchestrator/scripts/team/hooks/` holds `pre-commit.mjs`, `commit-msg.mjs`
   and `pre-push.mjs`, none of them wired. The "worktree hard enforcement"
   node was inactive the whole time.

3. **Nothing ordered design before build.** The PM had no precondition requiring
   the design deliverables to exist before dispatching `engineer` or `content`.
   A build could begin with no design decision on disk and nothing objected.

## The signals I missed

The dry-run plan I printed, quoted back, and read past:

    role=logo    worktree=true  rows=[D7:fail]  owns=[D7, fe-favicon-legible]
    role=content worktree=true  rows=[D4:fail]  owns=[D4, u-legal-claims-true]

A `logo` role dispatched against an app that already has a logo is nonsense. Role
names `brainstorm`, `logo`, `layout`, `content` only make sense for something
being created. I had the evidence in my own output and did not act on it.

Related misreading, same cause: asked to "simulate the process start to finish 3
times", I pointed all three runs at the existing `app-builder` instead of
building three new apps. "Start to finish" has no meaning against an app that
already shipped. I substituted the thing I had been debugging for twenty turns
for the thing I was asked to produce.

## Fixes — enforcement, not intention

Intention already existed: the rule was written, the roles were correctly
specified, and the role prompts say exactly what to produce. Being told again
would not have helped. These are structural.

| Layer | Fix |
|---|---|
| Entry point | `scaffold` engages the team; a new app cannot be built by hand without roles having run |
| Ordering | PM precondition: design deliverables must exist and be **decided** before any build role dispatches |
| Substance | A `DECISION.md` that is blank or placeholder counts as MISSING -- a file that exists is not a decision (the map's `DECISION.md blank` loop-back edge) |
| Hooks | `.githooks` installs pre-commit and commit-msg from the team enforcement library, and folds it into pre-push **without** regressing the existing finish-line refusal |
| Fail-closed | An unmeasured design row fails; it is never treated as satisfied |

## The durable lesson

**A gate can only refuse what was built. It cannot ask for what was never
started.** Anything mandatory at the *beginning* of a process has to be enforced
by the thing that starts the process, not by the thing that scores the end of it.
That is why the fix is at the entry point and in the PM's dispatch order, not a
new rubric row.
