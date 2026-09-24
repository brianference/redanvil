# RedAnvil — current state (2026-09-24)

The one file a new session reads first. History lives in `docs/archive/handoffs/`
and in git; do not grow this file into a log. Replace sections when they change.

## What works now (on master, not yet pushed or deployed)

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
  (schema v2). The per-iteration judge runs on `claude -p` and falls back to Grok.
- **Independent review (2026-09-24).** A fresh-context reviewer found 7 high and 13 medium issues
  in Batches 2-4; all high and medium ones are fixed and tested on master (grok handoff only on
  account errors, fidelity scored on features only, per-round gate ids, idempotent webhook, judge
  scope, whole-bundle hash, webhook token, DDL-safe names, negation, dependency skips, bounded
  retries). Not fixed: rate_limits table is never pruned; a job claimed just before a crash stays
  `claimed` (no lease).
- **Overnight loop.** Per-night checkpoint rollover in `overnight.mjs`, Grok first, prompt via file,
  ALERT.json when no VERIFIED receipt. Grok failover (hang, 403, spending limit, 402 balance) is one
  function in `roles/agent-failover.mjs`.
- **Scaffold.** New apps get the shared shell, working test runners and (when asked) the auth kit.

## Blocked on the owner

1. **Secrets.** `RUNNER_TOKEN` and `RATE_LIMIT_KEY` must be set as Pages secrets on project
   `redanvil` before deploying, or submit/save return 503 (fail closed). The gitignored
   `n8n-prototype/.env` needs `REDANVIL_RUNNER_TOKEN` (same value as `RUNNER_TOKEN`) and
   `REDANVIL_WEBHOOK_TOKEN` (any long random value; `start-server.sh` loads it into n8n and the
   poller sends it, and the build webhook refuses a request without it).
2. **Remote D1 migration** `app-builder/migrations/0003_job_runner.sql`, then build and deploy
   app-builder (`--branch main`), verify asset hash and `/api/health`.
3. **Push.** master is far ahead of origin. The scoped pre-push hook refuses because the August
   auth-kit commits touch sushi-finder / pet-sitter / az-planting-calendar (stale results) and
   `furniture-listings` has no results file. Either reverify those apps or bypass once and log it
   in `docs/PUSH-BYPASS-LOG.md` with a clear-by date.
4. **Run it.** Import `workflows/redanvil-errors.json` then `redanvil-full-build.json` into n8n;
   register `n8n-prototype/poller/run-poller.cmd` in Task Scheduler; start a Remote Control Claude
   session and `/loop` the redanvil-dispatch skill.
5. **Revoke** the GitHub token found in `workspace/projects/tpusa-monitor-dashboard/.git/config`.
6. **Grok Build balance** is exhausted (402). One large task (b4c, 2026-09-23) recorded `total_cost_usd` 5.43 in its JSON envelope.

## Known issues (real, not waived)

- `crossAppDuplication` real-repo test fails (2224 > 38 duplicated lines) since before this round.
- `tests/feature-coverage.spec.ts` "examples page exposes live app and source links" fails on prod too.
- harness / promote / coverageGates tests time out (5 s) only under the full parallel suite on
  Windows; they pass alone.
- Drift CI stays red at the finish-line step until app-builder is re-gated and shipped.
- Fidelity is a word-overlap proxy with a 0.024 margin between the right dog-care PRD (0.357) and
  the old sushi PRD (0.333); it fails closed, so expect some good PRDs to stop and ask.
- PRD titles still come from the prompt; the wizard has no app-name field, so Grok's intent
  `appName` cannot reach the PRD yet. `deriveEntities` is now only used by tests and a script.
- The Claude judge fails claims it cannot see from a diff alone; its prompt needs file context.
- Leftover worktree folders to delete by hand: `RedAnvil-gate`, `RedAnvil-logo`,
  `RedAnvil-wt/prdfix`, `ra-*`; also `zztest-app/` and tracked `no-such-app-dir-xyz/`.
