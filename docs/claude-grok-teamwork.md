# Claude ↔ Grok teamwork protocol (so builds stop breaking)

Two agents editing one working tree broke CI twice in a single session. Neither failure was
a coding mistake — both were **handoff** mistakes. This is the protocol that prevents them.

## The two real failures

1. **Staged a file mid-write.** `git add -A` ran while Grok was writing. Grok had deliberately
   broken a file to prove a test was not vacuous (which is what it had been asked to do); the
   commit captured that instant. CI: `TS1160: Unterminated template literal`.
2. **Split a coupled change.** To avoid failure 1, the next commit used an explicit path list
   excluding Grok's in-flight files. But `job.ts` (staged) made three `WizardAnswers` fields
   required while `prd.test.ts` (excluded) held the matching update. The working tree
   typechecked; the commit did not.

Both share one root cause: **the working tree is not the commit.** A green local run proves
nothing about what was actually pushed when another agent's edits are interleaved.

## The protocol

### 1. Isolate the agent, not the commit
Prefer running Grok in a **disposable git worktree** (`withWorktree`, or
`Agent(isolation: "worktree")`) so its intermediate states can never reach the main tree.
Merge only a finished, green branch. This removes the whole failure class rather than
managing it. Use the shared tree only for small, bounded, single-file tasks.

### 2. Never stage during a delegation
No `git add`, no commit, no `stash` while a delegated run is in flight. Wait for the task
notification or for the process to exit. Delegation and version control do not interleave.

### 3. If you must commit a partial set, ask the coupling question
> Does anything I am staging require a change in something I am excluding?

A type, signature, schema, or export change almost always does. If yes: wait. Excluding a
file is only safe for genuinely independent work.

### 4. Verify the COMMIT, not the tree, before pushing
```bash
node .github/scripts/verify_commit.mjs HEAD
```
It checks the ref out into a throwaway worktree and builds *that*: root typecheck, root tests,
both app typechecks, and the app build. It reproduced the exact CI failure locally in seconds
and printed `does NOT stand alone: do not push`. Run it before every push that follows a
delegated run.

### 5. Tell the agent how to prove a test is not vacuous
Say **"break the implementation in a TEMP COPY, never in place."** Otherwise the working tree
is briefly and legitimately broken, and anything committed in that window ships the break.

### 6. Review flows both ways
Grok reviews Claude's diffs, not only the reverse — self-review is the weakest review. A
fresh context found four evadable checks that all looked green (string-concat SQL injection,
an always-true auth guard, a `visual` rule satisfiable by a `judge` verdict, a CI e2e guard
that exited 0 when the browser was missing).

### 7. Use two judges when a verdict matters
Claude and Grok judging the same rules disagreed on 4 of 10. Grok judged representative good
examples; Claude judged the worst case — which is what a complexity rule actually asks. The
disagreements were all real defects. Disagreement marks the rules that are ambiguous enough to
need tightening.

## Quick reference

| Situation | Do |
|---|---|
| Delegating a multi-file change | Give the agent a worktree; merge when green |
| Agent is running | Touch nothing in git |
| Agent finished | Full local gate, then `verify_commit.mjs`, then push |
| Committing a subset | Ask the coupling question first |
| Change is "done" | Grok reviews the diff; verify what it flags |
| Verdict matters | Two independent judges; investigate every disagreement |
