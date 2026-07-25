# RedAnvil handoff — 2026-07-25 (v9.0.0)

State after v9.0.0, and what is left. Written so a fresh context can pick up without
re-deriving anything.

## Where things stand

- **HEAD:** `6b970dd` on `master`.
- **Latest release:** `v9.0.0` (independent judge, corrected duplication definition, 404
  pages, per-route design audit).
- **Production:** https://redanvil.pages.dev and https://redanvil-dashboard.pages.dev
  (Cloudflare Pages, direct upload / Type B; prod branch `main`, local branch `master`, so
  deploys must pass `--branch main`). Both verified by asset-hash match against the scored
  commit, and `/api/health` returns `{"status":"ok"}`.
- **Gate:** app-builder 100/100 across 48/48 at **87% coverage** (floor 85); dashboard 100/100
  across 46/46 at **84%** (floor 80). Both `--na ci,process`, zero stale verdicts, both
  reproduced rule-by-rule, both scored from a clean tree and tied to the deployed bundle.
- **Working tree:** clean.

## What changed in v9.0.0

All three remaining third-audit findings are closed. `docs/audit-2026-07-25-third.md` carries
the detail; the load-bearing parts:

1. **The judge tier finally dissented — because someone else was asked.** Ten judge-method
   rules went to an independent reviewer (disposable worktree, fresh context, no access to the
   verdict file, `file:line` evidence required). Six FAILs. Five confirmed and fixed; one
   (`u-conc-idiomatic`) partly refuted and recorded as wrong. `judge_dissent.mjs` now reports
   self-recorded and independent populations separately plus the gap: **0.0% vs 60.0%**. They
   are deliberately not averaged.
2. **One definition of duplication, and it was wrong.** The in-app rule now imports
   `normaliseSource` / `isMostlyStyleProps` from the cross-app pass. Unifying exposed that
   identifier normalisation flattens every props interface + component signature into pure
   punctuation, and that multi-line import bodies survived the import filter. Cross-app
   **646 → 393 is a measurement correction, not deduplication.** Real copy-paste the corrected
   check then found took it to **387** (the ratchet). Three tests pin the definition.
3. **Design audit measures every route**, not just `/`. Found real 14px text on five routes,
   and — by being pointed at a route that does not exist — that an unmatched URL rendered an
   **empty document**. Both apps now ship `NotFound`; the audit measures a deliberately bad
   route so it cannot regress.
4. **The footer lockup was illegible at 48px** (440x149 raster, tagline baked into the pixels,
   ~5px tall). No measurement catches that. `screenshots.mjs` now produces the visual-review
   set deterministically. Design rules **R19** (raster lockup minimum legible size) and **R20**
   (every router needs a catch-all) added and synced to the mobile-ux skill.

## Remaining tasks (priority order)

1. **`proc-pr-title-ticket` is N/A locally.** Implemented via `gh pr view`; `gh` is not on PATH
   so it always returns N/A. Fails closed, so it is honest, but it has never been measured
   here. Wire it to the GitHub API with the existing token if PR-title enforcement matters.
2. **Lower the duplication ratchet below 387.** The remaining worst offenders are all genuine
   shared shell code: `Page.tsx` (60), `shell/styles.ts` (57), `NavLinks` (42), `MobileDrawer`
   (36), `useDocumentMeta` (36), `Footer` (34), `ThemeToggle` (31), `Logo` (29), `Header` (26),
   `Breadcrumbs` (22), `linkify` (20). They import per-app theme/i18n, so they need
   parameterising rather than moving — the same shape `shellCss.ts` already uses.
3. **Run the independent judge on the dashboard too**, and on a cadence rather than once. One
   run found five real defects in app-builder; the dashboard has never had one.
4. **A fourth audit.** Three have each found real problems; the returns have not diminished.

## Key facts a fresh context will need

**Deploy** (Type B — `git push` does NOT deploy):

```
cd app-builder && npm run build
export CLOUDFLARE_API_TOKEN=<NewCloudFlareAccountToken from x-search-mcp-server/.env>
export CLOUDFLARE_ACCOUNT_ID=dd01b432f0329f87bb1cc1a3fad590ee
npx wrangler pages deploy dist --project-name redanvil --branch main --commit-dirty=true
```

Then verify: fetch the production URL, extract `assets/index-<hash>.js`, confirm it matches
local `dist/`. Also curl `/api/health`. Dashboard is the same with
`--project-name redanvil-dashboard`. Never report the hashed per-deploy URL.

**The alias lags.** After a deploy, `<project>.pages.dev` serves a mix of old and new from
different edge PoPs for a minute or two — probes alternated between builds six times in a row
this session. Poll until several consecutive responses are current before measuring anything,
or the audit measures the previous build.

**Gate**:

```
npm run gate -- app-builder --judge evidence/verdicts-app-builder.json \
  --na ci,process --slug app-builder --out results/app-builder.json
```

`git checkout -- results/` before a run if you need `provenance.dirty=false` — and gate one app
at a time, because the other app's modified result file also makes the tree dirty.

**Order matters when re-recording.** Verdict reports must be produced at or AFTER the commit
they vouch for. Commit the code first, then measure, then stamp — measuring first and
committing after trips the stale-report guard, which is correct: re-stamping is not
re-measuring.

**Evidence gates** (all in CI, most also daily in `drift.yml`):

```
node .github/scripts/design_audit.mjs   <prodUrl> --routes /about,/contact,/terms,/privacy,/saved,/no-such-page --out evidence/design-<slug>.json
node .github/scripts/desktop_width.mjs  <prodUrl> --out evidence/width-<slug>.json
node .github/scripts/a11y_audit.mjs     <prodUrl> --theme dark  --out evidence/axe/<slug>-dark.json
node .github/scripts/e2e_smoke.mjs      <prodUrl> --out evidence/e2e-<slug>.json --trace evidence/e2e-<slug>.zip
node .github/scripts/screenshots.mjs    <prodUrl> <slug> --routes /,/saved,/about --out evidence/screenshots
node .github/scripts/runtime_parity.mjs <appDir> --out evidence/runtime-<slug>.json
node .github/scripts/gate_scaffold.mjs
node .github/scripts/verify_deployed.mjs <appDir> results/<slug>.json <prodUrl>
node .github/scripts/judge_dissent.mjs  --out evidence/judge-dissent.json
```

Keep a bad route (`/no-such-page`) in the design-audit list on purpose — that is what proves the
catch-all still renders.

**CI parity before every push** (`verify_commit.mjs` names the rest itself):

```
node .github/scripts/verify_commit.mjs HEAD
node .github/scripts/verify_results.mjs app-builder results/app-builder.json evidence/verdicts-app-builder.json ci,process
node .github/scripts/build_feed.mjs --check
node .github/scripts/verify_design_rules.mjs
node .github/scripts/gate_repo_ci.mjs
rm -f results/*.verify.json
```

**Run all three test suites.** The root vitest config globs `test/**` only, so `npm test` at the
root does NOT run either app's `src` tests. Root 249, app-builder 113, dashboard 43 — and
`npm run typecheck` at the root is separate again. A green root run is not proof; `verify_commit`
caught a root typecheck failure this session that every local run had missed.

**GitHub API** (`gh` not on PATH): source `GITHUB_TOKEN` from
`workspace/projects/x-search-mcp-server/.env`, call
`api.github.com/repos/brianference/redanvil/...` directly. Never print the token — length and
prefix only.

**Grok delegation**: disposable worktree, never `git add` while a run is in flight, verify the
COMMIT not the tree. Use it for the judge tier too, not only for building — that is what found
five real defects this session.

## Environment gotchas

- **NEVER junction `node_modules` into a git worktree.** `git worktree remove --force` follows
  the junction and deletes the real directory. Run `npm ci` in the worktree instead.
- **`git worktree add` with `MSYS_NO_PATHCONV=1` and a `/c/...` path** creates `C:/c/Users/...`.
  Pass a Windows-style path.
- **Python heredocs mangle `\n`** inside replacement strings. Use the Edit tool for anything
  containing escapes.
- **Never `prettier --write` the golden PRD fixtures** — they are the assertion. Now ignored.
- CI checks out **shallow** by default, so verdict freshness cannot resolve `reviewedCommit`.
  The provenance job sets `fetch-depth: 0`; any new gating job must too.
- Each app installs standalone in CI, so a type package present only via the root hoist
  (`@types/node`) passes locally and fails there.
- `tsx -e "..."` inline hangs in this shell; write a `.mts` file.
- `grep -P` is unavailable; use `LC_ALL=C grep -E`.
- `$(...)` around a pipe captures the LAST command's exit code.

## Standing rules (CLAUDE.md + memory)

- Never report a number from an unvalidated measurement; sanity-check against an invariant.
  Three of this release's own checks were wrong before they were useful, all in the flattering
  direction.
- Judge disagreement → the fail wins and gets diagnosed. Including when the judge is wrong: say
  so per rule, do not quietly drop it.
- Grok reviews Claude's work too, not only the reverse.
- Worktree isolation; never stage mid-delegation; verify the commit, not the tree.
- Declared-but-unimplemented rules pass silently; bind every rubric to its implementation.
- A recorded review is only evidence for the commit it was recorded at.
- A rule that can only be judged from a rendered page needs a screenshot artifact, or "the
  visual review passed" is an unverifiable claim.
