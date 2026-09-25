# RedAnvil — current state (2026-09-24)

The one file a new session reads first. History lives in `docs/archive/handoffs/`
and in git; do not grow this file into a log. Replace sections when they change.

## What works now (on master, pushed; app-builder deployed as index-D1C80DaM.js)

- **Idea to build path.** `POST /api/submit` queues a job in D1. `n8n-prototype/poller/job-poller.mjs`
  claims it (bearer `RUNNER_TOKEN`), writes a `job-approval` record, and only after the owner
  approves does it POST the n8n webhook. The site shows a live status panel from the public
  `GET /api/jobs/:id/status` (never returns the prompt). `GET /api/jobs` now needs the token.
  Submit and save are rate limited (HMAC-keyed IP buckets, `RATE_LIMIT_KEY`).
- **Design gates.** Register -> Wait (form, 2 h) -> approve / redo / timeout. Redo loops to
  `reworkTo` with a cycle cap; timeout auto-decides and records why. Verified on a live
  throwaway n8n 2.22.6 (see `n8n-prototype/README.md`). Telegram only with `REDANVIL_TELEGRAM=1`.
- **Owner dispatch.** `node n8n-prototype/dispatch/dispatch.mjs list|gallery|resolve|mark-notified|ack`
  and the skill `.claude/skills/redanvil-dispatch/SKILL.md` for a Remote Control Claude session:
  publish a private artifact gallery, push-notify, resolve on the owner's reply (`--notes-file`).
  Job approvals are never auto-approved.
- **PRDs.** Wizard requires an entity spec with fields (`Dog: name, birthDate:date; CareTask: dueDate:date, dog->Dog`).
  DDL and API examples come from those fields; the top capability leads the MVP; fidelity is
  graded by content-word coverage (threshold 0.35, calibration data in `selfCheck.ts`) and
  written to frontmatter; the PRD ends with a `json claims` block. The n8n `prd` role asks Grok for
  typed intent (`roles/intent.mjs`), fills the wizard from it, extracts claims to
  `<app>/.redanvil/claims.json`, and stops the build with an alert on `fidelity: fail`.
- **Speed.** Roles run in dependsOn waves (cap 3) and skip when inputs are unchanged; judge chunks
  pool 3, gate checks pool 4 (exclusive checks alone). Dashboard gate: 223 s -> 170 s, 91/92 rule
  outcomes identical (the other is git-state). n8n launches brainstorm/logo/palette/layout together
  (`roles/parallel-roles.mjs`; n8n v1 itself runs branches serially).
- **Verdicts.** Visual verdicts bind to a freshly built bundle hash; judge verdicts need a scope
  (schema v2). Every judge runs on `claude -p` with no Grok fallback; it now also reads a
  summary of the commits since the app's last scored commit for u-conc-smallest-diff.
- **Independent review (2026-09-24).** A fresh-context reviewer found 7 high and 13 medium issues
  in Batches 2-4; all high and medium ones are fixed and tested on master (grok handoff only on
  account errors, fidelity scored on features only, per-round gate ids, idempotent webhook, judge
  scope, whole-bundle hash, webhook token, DDL-safe names, negation, dependency skips, bounded
  retries). Since fixed (2026-09-24): expired rate_limits buckets are pruned (migration 0004
  adds the index, applied remotely) and a claim holds a 30-minute lease.
- **Overnight loop.** Per-night checkpoint rollover in `overnight.mjs`, Claude only, and the $25
  nightly cap now binds (it could not while Grok cost was recorded as 0).
- **Engine policy (owner rule 2026-09-24).** Grok runs only the logo, palette and layout roles
  (Grok Imagine + design work); `orchestrator/scripts/lib/engine-policy.mjs` is the one list.
  Coding, judging, review, PRD intent and every other role run on Claude and fail closed. Reason:
  coding was ~90% of recorded Grok tokens (~/.grok/logs/unified.jsonl, 2026-09-22..24).
- **Scaffold.** New apps get the shared shell, working test runners and (when asked) the auth kit.

## Apps moved out (2026-09-24)

sushi-finder, pet-sitter and az-planting-calendar now live in their own private repos
(github.com/brianference/<slug>) with full history, vendored design-system modules and their own
lockfiles; each was redeployed from its repo and verified (hash match, health 200, no console
errors). RedAnvil gates only app-builder and dashboard. The fleet apps agent-tower, social-pulse
and yt-intel-one moved off `fleet-shared-db` to their own D1 (`<app>-db`) with every row copied
and counted; fleet-shared-db is left as a backup.

## Blocked on the owner

Done 2026-09-24: Pages secrets set, remote migration 0003 applied, app-builder deployed and
verified (hash match, /api/health ok, /api/jobs 401 without the token).

3. **Finish line.** Not met yet. The process lane is now measured (coverage 94-96%), the test
   lanes, breadcrumbs, resource links and most waivers are fixed, and both apps are deployed.
   What remains is the independent judge: each full re-judge finds new, real, smaller findings
   (dashboard went 8 -> 5 -> 3 failing judge rules over three rounds). See PUSH-BYPASS-LOG,
   clear by 2026-10-08.
4. **Run it.** Import `workflows/redanvil-errors.json` then `redanvil-full-build.json` into n8n;
   register `n8n-prototype/poller/run-poller.cmd` in Task Scheduler; start a Remote Control Claude
   session and `/loop` the redanvil-dispatch skill.
5. **Grok Build balance** is exhausted (402) until 2026-09-30 02:25; only design/logo roles use it now.

## CI (2026-09-25, on bd324b49)

Green: orchestrator, repo-checks, apps (app-builder), apps (dashboard), quickflight-provenance
(re-gated in its repo at 63a3509, honest 0/100). Red until both apps pass the judge and are
re-verified: apps-meet-the-bar, dashboard-provenance, results-provenance. CI runs Node 22 and
installs Chromium for the new browser/VRT lanes; Linux VRT baselines come from
record-vrt-baselines.yml.

## Known issues (real, not waived)

- harness / promote / coverageGates tests time out (5 s) only under the full parallel suite on
  Windows; they pass alone.
- Drift CI stays red at the finish-line step until app-builder is re-gated and shipped.
- Fidelity is a word-overlap proxy with a 0.024 margin between the right dog-care PRD (0.357) and
  the old sushi PRD (0.333); it fails closed, so expect some good PRDs to stop and ask.
- PRD titles still come from the prompt; the wizard has no app-name field, so Grok's intent
  `appName` cannot reach the PRD yet. `deriveEntities` is now only used by tests and a script.
- The Claude judge fails claims it cannot see from a diff alone; its prompt needs file context.
- Leftover worktree folders to delete by hand: `RedAnvil-gate`, `RedAnvil-logo`,
  `RedAnvil-wt/prdfix`, `ra-*`; also `zztest-app/` and tracked `no-such-app-dir-xyz/`. Seven old
  app folders from the monorepo were moved (not deleted) to `C:/Users/brian/RedAnvil-leftovers-2026-09-24`.
