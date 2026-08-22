# Night plan: 2026-08-21 -> 2026-08-22, unattended

Concept for tonight's new-concept full build: **a job application site**.
Slug: `job-application-site`.

This file is the contract a resumed session reads. It is updated as work lands.
`.redanvil/overnight/night-state.json` carries the machine-readable state; this
carries the reasoning. Read BOTH, then read
`docs/HANDOFF-2026-08-21-overnight.md` for the background.

## The owner's instruction

Fully autonomous overnight. No user input, no permission prompts, do not stop,
auto-resume across session/token limits. The open decision in the handoff --
four human gates vs. an unattended night -- is resolved as **auto-resolve the
gates, recording every choice and its alternatives for morning review**, which
is the handoff's own recommendation (option 3): prove 24 steps chain tonight,
re-run the four design steps with real owner choices tomorrow.

## Tracks

1. **AUTO-GATES** -- `docs/specs/auto-gates.md`, delegated to Grok in worktree
   `C:/Users/brian/RedAnvil-wt/autogates` (branch `wt/auto-gates`).
   Blocks track 3.
2. **HARDENING** -- `docs/specs/overnight-hardening.md`, delegated to Grok in
   worktree `C:/Users/brian/RedAnvil-wt/hardening` (branch
   `wt/overnight-hardening`). Independent of track 3.
3. **FULL BUILD** -- POST the job-application-site concept to the n8n webhook
   `http://localhost:5678/webhook/redanvil-build` and drive it to `ship`.
   This is the night's deliverable.
4. **CI RED** -- diagnose the coverage mismatch: committed 83/83, reproduced
   61/83 in CI. 22 rules measure locally and not in CI. Until this is
   understood the local gate's coverage number is not trustworthy, which
   matters for a night that gates its own work.

## Rules that apply to every step tonight

- A spec is not a deliverable. Open the artifact.
- Never report a number from an unvalidated measurement.
- Review Grok's real diff, never its summary.
- An app is not done until it is on GitHub, pushed, deployed, and the served
  asset hash matches the local build.

## Measured during the night (evidence, not inference)

**Machine will stay up.** Desktop, no battery, always AC. On AC: sleep after
`0x0` (never), hibernate after `0x0` (never), disk idle `0x0` (never), display
off at `0x708` = 1800s = 30 min. Monitors sleep, the machine does not.

**Auto-resume is NOT armed.** `scripts/overnight/resume.ps1` exists and both its
refusal guards were executed and observed refusing (night-complete marker, live
lock -- both returned in 0s having launched nothing, logged in
`logs/overnight/resume.log`). The launch path could NOT be exercised: the
harness classifier blocks spawning a nested
`claude -p --dangerously-skip-permissions` session, and registering a scheduled
task to do the same thing would be routing around that denial. The script is
therefore UNVERIFIED on its positive path. The owner can arm it with:
`schtasks /create /tn "RedAnvil Night Resume" /tr "powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\brian\RedAnvil\scripts\overnight\resume.ps1" /sc minute /mo 20 /f`

**The n8n database had drifted from the file again -- bug #4's exact shape.**
`redanvilFull001` in `database.sqlite` held **55** nodes; the generated file
holds **59**. The four missing nodes are precisely the Telegram notifies added
by `63ae588`, and the workflow NAME matched byte-for-byte in both, which is why
the drift was invisible. Execution reads the database, so the file being correct
proved nothing. A re-import plus an n8n restart is mandatory before the build.

**The webhook path works, and its guard can fail.** POSTing `{}` to
`http://localhost:5678/webhook/redanvil-build` returned 200 and created
execution **63** on `redanvilFull001` with status `error`. The recorded message
is the real one from `Slice config` -- "No prompt: POST a { prompt } body..." --
and `prd.mjs` appears nowhere in the execution data, so nothing was built. This
exercises webhook -> config -> validation without starting a run.

**CI is red for TWO reasons and the handoff named the wrong one as current.**
In run 32551920327 `quickflight-provenance` and `dashboard-provenance` both
PASS; the 22-rule coverage mismatch the handoff describes did not recur there.
`results-provenance` in that run was **canceled** ("The operation was canceled"
at 04:34:26), superseded by the next push -- not a genuine failure, and reading
it as one is how a cancel gets logged as a defect.

- `apps-meet-the-bar` is the EXPECTED red lane. It refused 6/6 apps for real,
  substantive reasons (`lg-shipped`, stale evidence, missing judge review,
  unrecorded fail-closed visual verdicts). Per the standing rule, that
  expectation is now written down WITH the job name so it cannot absorb the
  next unrelated failure.
- `results-provenance` in run 32551955424 is a real failure and is still being
  diagnosed.

## Cleanup hazard, recorded before it bites

Grok junctioned `node_modules` into the worktrees so vitest could run. A
`git worktree remove --force` FOLLOWS that junction and deletes the real
`node_modules` in the main repo. Before removing either worktree, delete the
junction first:
`cmd /c rmdir "C:\Users\brian\RedAnvil-wt\autogates\node_modules"` (rmdir, not
`rm -rf`, which would also follow it).
