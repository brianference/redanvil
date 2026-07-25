# RedAnvil handoff — 2026-07-25 (v8.0.0)

State after the v8.0.0 release, and what is left. Written so a fresh context can pick up
without re-deriving anything.

## Where things stand

- **HEAD:** `36f1188` on `master`, CI green.
- **Latest release:** `v8.0.0` (third audit: measured design rules, guarded lanes, scaffold
  gated in CI, deploy tied to the scored commit).
- **Production:** https://redanvil.pages.dev and https://redanvil-dashboard.pages.dev
  (Cloudflare Pages, direct upload / Type B; prod branch `main`, local branch `master`, so
  deploys must pass `--branch main`). Both verified this session by asset-hash match.
- **Backup:** `C:\Users\brian\Backups\redanvil\redanvil-v8.0.0-20260725-0024.bundle`
  (restore-tested by a real clone: 372 files, `v8.0.0` → `36f1188`).
- **Gate:** app-builder 100/100 across 48/48 at **87% coverage** (floor 85); dashboard 100/100
  across 46/46 at **84%** (floor 80). Both with `--na ci,process`, zero stale verdicts, both
  reproduced rule-by-rule in CI, and both tied to the deployed bundle by `verify_deployed.mjs`.
- **Working tree:** clean. All five delegation worktrees removed and branches deleted.

## What changed in v6.0.0

An audit of RedAnvil against its own rules found the score was resting on expired evidence.
Ten findings were fixed; the full narrative is in the release notes. The load-bearing ones:

1. **Verdict freshness.** `reviewedCommit` was schema-validated and read by nothing. Verdicts
   now carry a scope and are dropped when anything in it changes since review. Turning this on
   scored the then-current tree at 0/100 with ten visual blockers failing — that was the honest
   number. `orchestrator/src/gate/freshness.ts`.
2. **Operational rules are scored.** 30 `lg-*` rules in `rules/loop-gate.md` were prose. Seven
   are now scored from the run record (`orchestrator/src/loop/runRules.ts`) and bound to the
   corpus file by test.
3. **Three evadable checks.** `fe-no-unsanitized-html` (first match only),
   `hyg-secret-scan` (src/functions only, four key shapes), `fe-theme-tokens-only` (no CSS).
   Red-green tests in `orchestrator/test/checkEvasions.test.ts`.
4. **Contrast is decided by axe**, not a note. A passing `fe-a11y-contrast` verdict must cite
   an axe report with zero violation nodes in BOTH themes.
5. **Loop feedback carries diagnostics**, reports its best iteration, and stops on stagnation.
6. **The scaffold produces an app that builds** — 27 files, verified to install, typecheck,
   test, lint and build a production bundle.
7. **Site**: real header nav with `aria-current`, dead desktop rail removed, centred column,
   regenerated brand mark with no baked halo.
8. `u-conc-file-size` (600 lines) plus the `prd/*` and `shell/*` splits.
9. Score reports now disclose **coverage** and the waived rule ids.
10. Rubric markdown ↔ encoded rules bound in both directions.

## Remaining tasks (priority order)

### 1. Audits one and two fully closed; third audit has 3 open of 10
`docs/audit-2026-07-25.md` (second) and `docs/audit-2026-07-25-third.md` carry a CLOSED note per
finding. Open from the third:
- **The judge tier has NEVER dissented** — 0 fails in 258 recorded judge verdicts across 34
  verdict-file revisions. Measured daily by `judge_dissent.mjs`, deliberately report-only. The
  fix is an independent reviewer, not a threshold: judge verdicts are currently written by the
  same agent that wrote the code.
- **`hyg-no-duplication` is exact-match within one app** while the cross-app pass normalises
  identifiers, so the two disagree about what duplication means.
- **`design_audit.mjs` measures the home route only**; a mobile regression on `/saved` or a
  wizard step would not be caught.

Everything else on the old backlog is now done:
- **Monorepo wiring + ratchet.** Both apps are npm workspaces, react hoists to one copy, and
  `useDrawerA11y` shares cleanly. Duplication ratcheted 854 → 772 → **646**. Sharing React code
  failed before the workspace conversion (two React instances break every hook in the browser);
  that is why the wiring came first.
- **Suggested features flow.** Built and verified by driving production: deselecting everything
  blocks with a reason, a deselected feature is absent from the generated PRD.
- **Edge-case acceptance criteria.** Confirmed landed: a generated PRD carries 22 GIVEN/WHEN/THEN
  criteria of which 8 (36%) are failure/boundary paths (empty state, 500 + retry, 401, invalid
  input).
- **Third audit.** Done — `docs/audit-2026-07-25-third.md`, 7 of 10 closed.

Next genuine work, in rough value order:
- Lower the duplication ratchet below 646 (`linkify`, `Breadcrumbs` and `ThemeToggle` are the
  next candidates; they import per-app theme/i18n so they need parameterising, not just moving).
- The three open third-audit findings above.
- Re-derive the judge lane from scratch rather than patching it — see the dissent finding.

### 2. Brand assets
The dark lockup is the owner's own Grok Imagine artwork, recovered from two JPEG exports (over
the transparency checkerboard, and over solid black) by exact two-background matting — a JPEG
cannot carry alpha and Grok Imagine renders the checkerboard into the pixels. Recipe and script
live in the `grok-imagine-logo` skill.

Light and dark ship **different** lockups on purpose: the dark art has a silver wordmark that
washes out on white. `LOGO_HEIGHT = 112` with a `min(52vw, 440px)` cap, which leaves a measured
52px gap to the header buttons at 375.

### 3. `proc-pr-title-ticket` is N/A locally
Implemented via `gh pr view`; `gh` is not on PATH here so it always returns N/A. It fails
closed, so this is not urgent. Wire it to the GitHub API with the existing token if PR-title
enforcement matters.

## Key facts a fresh context will need

**Deploy** (Type B — `git push` does NOT deploy):
```
cd app-builder && npm run build
export CLOUDFLARE_API_TOKEN=<NewCloudFlareAccountToken from x-search-mcp-server/.env>
export CLOUDFLARE_ACCOUNT_ID=dd01b432f0329f87bb1cc1a3fad590ee
npx wrangler pages deploy dist --project-name redanvil --branch main --commit-dirty=true
```
Then verify: fetch `https://redanvil.pages.dev/`, extract `assets/index-<hash>.js`, confirm it
matches local `dist/`. Also curl `/api/health`. The dashboard is the same with
`--project-name redanvil-dashboard`. Never report the hashed per-deploy URL.

**Gate**:
```
npm run gate -- app-builder --judge evidence/verdicts-app-builder.json \
  --na ci,process --slug app-builder --out results/app-builder.json
```
`git checkout -- results/app-builder.json` before a run if you need `provenance.dirty=false`.

**Gates added since v6** (all run in CI, most also daily in `drift.yml`):
```
node .github/scripts/design_audit.mjs   <prodUrl> --out evidence/design-<slug>.json
node .github/scripts/desktop_width.mjs  <prodUrl> --out evidence/width-<slug>.json
node .github/scripts/runtime_parity.mjs <appDir> --out evidence/runtime-<slug>.json
node .github/scripts/gate_scaffold.mjs
node .github/scripts/verify_deployed.mjs <appDir> results/<slug>.json <prodUrl>
node .github/scripts/judge_dissent.mjs  --out evidence/judge-dissent.json
```
Verdicts for those rules must cite the matching report, and a report older than the commit it
vouches for is rejected — re-stamping a verdict is not re-measuring it.

**CI parity before every push** (`verify_commit.mjs` now names these itself):
```
node .github/scripts/verify_commit.mjs HEAD
node .github/scripts/verify_results.mjs app-builder results/app-builder.json evidence/verdicts-app-builder.json ci,process
node .github/scripts/build_feed.mjs --check
node .github/scripts/verify_design_rules.mjs
node .github/scripts/gate_repo_ci.mjs
rm -f results/app-builder.json.verify.json
```

**Re-recording verdicts** (needed whenever the render scope changes):
```
node .github/scripts/a11y_audit.mjs <prodUrl> --theme dark  --out evidence/axe/app-builder-dark.json
node .github/scripts/a11y_audit.mjs <prodUrl> --theme light --out evidence/axe/app-builder-light.json
node .github/scripts/e2e_smoke.mjs <prodUrl> --out evidence/e2e-app-builder.json
```
Then screenshots at 375/768/1280 in both themes into `evidence/screenshots/`, and update
`reviewedCommit` in `evidence/verdicts-app-builder.json`. Visual verdicts are scoped to
`app-builder/src`, `app-builder/public`, `app-builder/index.html`.

**GitHub API** (`gh` not on PATH): source `GITHUB_TOKEN` from
`workspace/projects/x-search-mcp-server/.env`, call `api.github.com/repos/brianference/redanvil/...`
directly. Never print the token — length and prefix only.

**Grok delegation**: disposable worktree, never `git add` while a run is in flight, verify the
COMMIT not the tree. Spec files under the session scratchpad; four ran cleanly this session.

## Environment gotchas (all hit this session)

- **NEVER junction `node_modules` into a git worktree.** `git worktree remove --force` follows
  the junction and deletes the real directory — it wiped root, `app-builder` and `dashboard`
  `node_modules` plus the entire `orchestrator/` tree (via the npm workspace symlink) in one
  command. Run `npm ci` in the worktree, or `cmd /c rmdir "<link>"` before removing it.
  Recovery is `git restore` plus `npm ci`.
- **Python heredocs mangle `\n` and `\r\n`** inside replacement strings, producing literal
  newlines in source. This broke `runGate.ts` and `e2e_smoke.mjs` this session. Use the Edit
  tool for anything containing escapes.
- CI checks out **shallow** by default, so verdict freshness cannot resolve any
  `reviewedCommit`. The provenance job sets `fetch-depth: 0`; any new job that gates must too.
- Each app installs standalone in CI, so a type package present only via the root hoist
  (`@types/node`) passes locally and fails there.
- `tsx -e "..."` inline hangs in this shell; write a `.mts` file.
- `grep -P` is unavailable; use `LC_ALL=C grep -E`.
- `$(...)` around a pipe captures the LAST command's exit code.

## Standing rules (CLAUDE.md + memory)

- Never report a number from an unvalidated measurement; sanity-check against an invariant.
- Judge disagreement → the fail wins and gets diagnosed.
- Grok reviews Claude's work too, not only the reverse.
- Worktree isolation; never stage mid-delegation; verify the commit, not the tree.
- Declared-but-unimplemented rules pass silently; bind every rubric to its implementation.
- **New:** a recorded review is only evidence for the commit it was recorded at.
