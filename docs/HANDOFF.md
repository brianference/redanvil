# RedAnvil handoff — 2026-07-25

State after the v6.0.0 release, and what is left. Written so a fresh context can pick up
without re-deriving anything.

## Where things stand

- **HEAD:** `7c869e0` on `master`, CI green.
- **Latest release:** `v6.1.0`. The v6.0.0 notes still describe the audit and its ten fixes.
- **Production:** https://redanvil.pages.dev and https://redanvil-dashboard.pages.dev
  (Cloudflare Pages, direct upload / Type B; prod branch `main`, local branch `master`, so
  deploys must pass `--branch main`). Both verified this session by asset-hash match.
- **Backup:** `C:\Users\brian\Backups\redanvil\redanvil-v6.1.0-20260724-2048.bundle`
  (restore-tested: clones clean, 356 files, 8 tags, `v6.1.0` → `7c869e0`).
- **Gate:** app-builder 100/100 across 47/47 at **85% coverage**; dashboard 100/100 across
  45/45 at **82% coverage**. Both with `--na ci,process`, zero stale verdicts, and both
  reproduced rule-by-rule in CI.
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

### 1. The remaining 8 findings from the second audit
See `docs/audit-2026-07-25.md`. Findings 1 and 2 are **done** in v6.1.0: runtime parity is a
real boot-and-curl check (`u-plat-runtime-parity`, proven to fail against a 500 health
endpoint), and the dashboard is gated with its own verdicts and CI reproduction job.

The eight remaining are unchanged. Most valuable next:
- **#3** — 385 identical lines across the two shell trees, structurally invisible because
  `hyg-no-duplication` runs per app directory.
- **#7** — `drift.yml` never re-runs the gate, so verdict staleness has no cadence behind it.
  It needs `fetch-depth: 0` when added.

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

### 4. Deferred from before
- The judge/visual rubric lanes were improved but not re-derived from scratch.
- AI-suggests-features-then-user-chooses flow before finalizing the PRD: requested, not built.
- Edge-case acceptance-criteria spec in `scratchpad/prd-edgecases.md`: confirm whether the
  failure/boundary templating landed in PRD v3.

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
