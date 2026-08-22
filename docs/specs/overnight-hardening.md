# Spec: overnight loop hardening

Target file: `n8n-prototype/loki/overnight.mjs` (711 lines). Three changes. Do not
restructure the file; keep the queue, receipt schema and checkpoint exactly as they are.

Context: this loop has never run outside `--dry-run`. 11 of 12 receipts in
`evidence/receipts/` are `executor: "dry-run"`; the single real one
(`gate-dashboard-2026-08-21T16-14-53-300Z.json`) came back `diffChanged: false`
after a 5-minute grok dispatch. All three defects below are why.

---

## 1. Measure and merge inside the worktree

**The defect.** `dispatchFix()` edits `wt.path` (line 578), but the measurement
that follows reads the main tree: tests and build run in `join(REPO_ROOT, item.app)`
(line 604), the post-fix `gateApp()` is called with `REPO_ROOT` (line 615), and
`commitAfter` is `headCommit(REPO_ROOT)` (line 624). Nothing merges the branch back -- there is no
`merge`, `commit` or `push` anywhere in the file.

Consequence: `diffChanged` is always false, and `writeReceipt()` requires
`diffChanged === true` for VERIFIED (line 480). **No item can ever reach VERIFIED,
however good the fix is.** The agent's work is measured against a tree it never
touched, then discarded.

**The change.**

1. Keep the baseline gate against `REPO_ROOT` as it is. That is the before-picture
   and it is correct.
2. After `dispatchFix()` returns, commit inside the worktree if the agent left the
   tree dirty: `git -C <wt.path> add -A` then `git -C <wt.path> commit -m ...`.
   The agent may have committed already -- handle both. An empty commit is not an
   error, it means the agent changed nothing; record that and skip the merge.
3. Set `commitAfter = headCommit(wt.path)`, not `headCommit(REPO_ROOT)`.
   `commitBefore` stays as the `REPO_ROOT` HEAD captured at worktree creation.
4. Run tests and build in `join(wt.path, item.app)`. Re-gate with
   `gateApp(item.app, wt.path)`.
5. Merge back **only** when every one of these holds: tests ran and passed, build
   succeeded, the post-fix gate passed, and the commit actually differs. Any one
   missing means leave the branch in place for morning review and do not merge.
6. **Refuse to merge into a dirty main tree.** Check `git -C REPO_ROOT status
   --porcelain` first; if it is non-empty, skip the merge, note why, and leave the
   branch. As of this writing the main tree has 18 modified files, so this path
   will be taken -- it must be a clean skip with a note, not a crash or a conflict.
7. Leave the worktree in place on failure. Remove it only after a successful merge.
   Note the junction trap: `git worktree remove --force` follows a `node_modules`
   junction and deletes the real one. Prefer `git worktree remove` without
   `--force`, and on failure just leave it.

**How to prove it.** A worktree where the agent makes a real change must produce a
receipt with `diffChanged: true`. Construct that case deliberately -- do not settle
for observing that the current always-false behaviour still reports false. Name the
input that makes it flip, produce it, and read the receipt.

---

## 2. Implement `--allow-deploy`

**The defect.** The flag is parsed (line 639), printed (line 649) and passed into
`ctx` (line 677). It is never read inside `processItem`. Nothing deploys, so
`lg-shipped` stays a blocker forever -- it is already a named blocker on the
dashboard receipt.

**The change.** After a successful merge (step 1.5 above), and only when
`ctx.allowDeploy` is true, deploy the app and verify the deploy landed.

Sequence, per the deployment rules in the global CLAUDE.md:

1. Build the app.
2. `wrangler pages deploy` the build output directory.
3. **Do not assume the production branch.** It varies per project, and a wrong
   `--branch` silently produces a PREVIEW deploy that reports success. It is NOT in
   `dashboard/wrangler.toml` -- that file carries only `name`,
   `compatibility_date` and `pages_build_output_dir`, so the value has to come from
   the Cloudflare API (the project's `production_branch` field) or an existing
   deploy script. Read it per project at deploy time. If it cannot be read, skip
   the deploy and record why; never guess it.
4. Verify by asset hash, which is the only proof that matters: fetch the bare
   production URL (`https://<project>.pages.dev`), extract the
   `assets/index-<hash>.js` reference, and compare it to the hash in the local
   build output. A wrangler success message is not proof.
5. Also curl one real backend endpoint if the app has Pages Functions. A 200 on
   the homepage only proves static assets served.

Add two facts to the receipt: `deployed` (boolean) and `deployHashMatches`
(boolean). Extend the `verified` conjunction in `writeReceipt()` so that when a
deploy was attempted, `deployHashMatches` must be true for VERIFIED. When no
deploy was attempted the conjunction is unchanged.

Credentials: use the existing documented Cloudflare token mechanism (the
`deploy-cloudflare` skill / the project's existing env loading). Do not read,
print, log or inline any secret value. Never report a per-deploy hash URL as the
result; the bare `<project>.pages.dev` is the URL.

---

## 3. Night-level deadline

**The defect.** There is no wall clock for the night. `ITEM_TIMEOUT_MS` is 45
minutes per item (line 56) and the rate-limit backoff in `dispatchFix()` sums to
110 minutes per agent per item. The queue is currently 7 items. Nothing stops the
run at sunrise.

Related and worth fixing in the same pass: `COST_CAP_USD` ($25, line 182) cannot
bind on grok. The non-structured branch of `dispatchFix()` hardcodes `costUsd: 0`,
and grok is the fallback that does most of the work once Claude's window closes.
The deadline is the real cap; say so in a comment rather than leaving the money cap
looking load-bearing.

**The change.**

1. Add `OVERNIGHT_DEADLINE_ISO` (env) and `--until <HH:MM>` (flag). Default to
   06:00 local. Compute an absolute deadline timestamp once at startup and log it.
2. Before starting each queue item, stop if the deadline has passed. Write the
   reason into the run summary, not only to stdout.
3. Clamp the per-item timeout to the time remaining, so an item cannot start a
   45-minute run with 10 minutes left.
4. Clamp the rate-limit backoff the same way. A 60-minute wait must not be entered
   when 20 minutes remain -- hand off to the next agent or stop.
5. Record `deadline`, `stoppedEarly` and `itemsSkipped` in
   `.redanvil/overnight/last-run.json`.

**How to prove it.** Set the deadline to a moment in the near past and confirm the
loop starts zero items and says so. Then set it a short way ahead and confirm an
item is skipped rather than started. A deadline that has never been observed to
stop anything is not a deadline.

---

## Rules for this change

- The gate is the judge. Do not write a report of your own success.
- Never weaken, waive or delete a check to make something pass.
- No fake, placeholder or hand-authored metrics or receipts.
- Do not touch `evidence/`, `results/` or any verdict file.
- Run the repo's own tests before finishing.
- Every new branch must be reachable by a test that fails when the branch is wrong.
  For each of the three changes, name the input that makes the new code FAIL and
  produce it -- confirming the good case still passes proves nothing.
