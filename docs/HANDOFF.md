# RedAnvil handoff — 2026-07-24

State of the project after the v5.0.0 release, and what is left to do. Written so a fresh
context can pick up without re-deriving anything.

## Where things stand

- **HEAD:** `688a9fa` on `master`, CI green.
- **Latest release:** `v5.0.0` — https://github.com/brianference/redanvil/releases/tag/v5.0.0
- **Production:** https://redanvil.pages.dev (Cloudflare Pages project `redanvil`, prod branch
  `main`; local branch is `master`, so deploys must pass `--branch main`).
- **Backup:** `C:\Users\brian\Backups\redanvil\redanvil-v5.0.0-20260723-2337.bundle`
  (restore-tested: clones clean, 296 files, 6 tags, `v5.0.0` → `688a9fa`).
- **Working tree:** clean. Both delegation worktrees removed, both merged branches deleted.
- **Gate:** 100/100 across 45/45 rules with `--na ci,process`; 93/100 at 46/47 without the
  waiver (the three newly-implemented checks genuinely run).

## Remaining tasks (priority order)

### 1. Logo dark-mode halo — NOT fixed, needs new art
The mark has a pale desaturated "splash" baked around the anvil base. It vanishes on white
and reads as a bright smudge on the dark header (`--bg #0b0b0f`). It is in both lockups
(`app-builder/public/logo-lockup.png` and `-dark.png`), so only dark mode looks wrong.

Six pixel treatments were tried and **all rejected on visual review**: stripping the splash
ate the anvil's horn and base; softer variants left a hard seam where the 36%-width region
boundary cut through it. The splash and the anvil's specular highlights are the same colour
family, so no classifier separates them. Conclusion: this needs a **regenerated mark**, not a
filter. Take it to Grok Imagine (`grok image_gen`) — a clean transparent anvil lockup with no
baked background residue, wordmark untouched. Review rendered on `#0b0b0f` before accepting.
Gallery of the failed attempts is in the scratchpad `logo/` dir if useful for the prompt.

### 2. README screenshots — outstanding from an earlier request
The user asked twice to add screenshots to the README and the GitHub release. Not done.
Need real rendered screenshots of https://redanvil.pages.dev (App Builder chat, wizard, a
generated PRD) at desktop + 375px, both themes, embedded in `README.md` and attached to the
v5.0.0 release. Use the Playwright harness, production URL only.

### 3. Scaffold ships apps that fail their own rule pack
Every generated app starts life failing two deterministic rules that are knowable at scaffold
time (confirmed identical across all 10 simulation runs):
- `fe-seo-assets` — scaffold emits `public/robots.txt` but not `public/sitemap.xml`.
- `u-plat-migrations` — `wrangler.toml` declares a D1 binding but no `migrations/` directory,
  so the schema is not reproducible. The PRD already contains the DDL to write.

Fix in `orchestrator/src/commands/scaffold.ts`: emit `public/sitemap.xml` and
`migrations/0001_init.sql` (from the job's DDL). This raises the floor for every build instead
of making the loop pay for it each time. Good candidate to delegate to Grok in a worktree.

### 4. `verify_commit.mjs` gives a false green
It checks a ref out into a throwaway worktree and builds it (typecheck, tests, app build), but
CI also runs `results-provenance`, `build_feed --check`, and `verify_design_rules`. Twice this
session it reported "stands alone — safe to push" and CI then failed on the provenance job.
Either extend it to run those three jobs too, or make it print exactly which CI jobs it does
NOT cover so the green is not mistaken for full parity. Current workaround: run the three CI
scripts manually before pushing (documented below).

### 5. `proc-pr-title-ticket` is N/A locally
Implemented (option a): reads a real PR title via `gh pr view` and exits 3 when there is no PR
or no `gh`. On this machine `gh` is not on PATH, so it is always N/A. If PR-title enforcement
matters, install `gh` or wire the check to the GitHub API with the existing token. Not urgent —
it fails closed (N/A, never a silent pass).

### 6. Deferred from before this session (verify still wanted)
- "improve the 22 judge/visual checks" — the deterministic side got attention (19 → 28 declared,
  now all implemented); the judge/visual rubric lanes were not revisited this round.
- AI-suggests-features-then-user-chooses flow before finalizing the PRD — requested, not built.
- Edge-case acceptance-criteria spec in `scratchpad/prd-edgecases.md` — was queued for Grok;
  confirm whether it landed (PRD v3 has bullet acceptance criteria, but the failure/boundary
  edge-case templating from that spec may not be in).

## What was done this session (context, don't redo)

- Fixed the red HEAD: PRD v3 restructure completed and committed (`0603de1`).
- Resolved 3 of 4 judge-disagreement defects (`071f6bf`): `Wizard.tsx` 915 → 270 lines, split
  into `wizard/steps/*`; `reviewAnswerRows` wired into the Review step; `MIN_PROMPT_LENGTH`
  deduped to the single `lib/job.ts` export. The 4th (presence-only assertions) measured 1/49 —
  already remediated by an earlier pass.
- Fixed the scanner self-match and two silent CLI skips (`3429b49`).
- Deployed PRD v3 to production; verified by asset hash + deployed bundle contents.
- Ran the 10-run pipeline simulation (`54503cf`) — new harness at
  `orchestrator/scripts/simulate_pipeline.mts`, records in `evidence/simulation-runs.json`,
  learnings in `docs/simulation-learnings.md`.
- Implemented the 3 unimplemented det rules + coverage test (`ddef68a` merge), fixed the
  `evaluated 46/45` tally bug (`bb75d93`).
- Cut v5.0.0, released, backed up.

## Key facts a fresh context will need

**Deploy** (Cloudflare Pages, direct-upload / Type B — `git push` does NOT deploy):
```
cd app-builder && npm run build
export CLOUDFLARE_API_TOKEN=<NewCloudFlareAccountToken from x-search-mcp-server/.env>
export CLOUDFLARE_ACCOUNT_ID=dd01b432f0329f87bb1cc1a3fad590ee
npx wrangler pages deploy dist --project-name redanvil --branch main --commit-dirty=true
```
Then verify: fetch `https://redanvil.pages.dev/`, extract `assets/index-<hash>.js`, confirm it
matches local `dist/`. The bare alias is edge-cached ~30–60s after deploy; the per-deploy
`<hash>.redanvil.pages.dev` URL is the uncached verification target (never reported as the result).
Also curl `/api/health` — a 200 on `/` only proves static assets served.

**Gate** (flags are strict now — unknown flags exit 2; `--out` requires `--slug`):
```
npm run gate -- app-builder --judge evidence/verdicts-app-builder.json \
  --na ci,process --slug app-builder --out results/app-builder.json
```
`--na ci,process` is correct for `app-builder` (it has no `.github/workflows`; the gate refuses
`--na ci` on a dir that does). The gate self-sees its own `results/*.json` write as a
modification, so `git checkout -- results/app-builder.json` before a run if you need a clean
`provenance.dirty=false`.

**CI-parity checks to run locally before every push** (this is the `verify_commit.mjs` gap):
```
node .github/scripts/verify_commit.mjs HEAD          # build/tests in isolated worktree
node .github/scripts/verify_results.mjs app-builder results/app-builder.json evidence/verdicts-app-builder.json ci,process
node .github/scripts/build_feed.mjs --check
node .github/scripts/verify_design_rules.mjs
rm -f results/app-builder.json.verify.json           # scratch file the first one writes
```

**GitHub API** (`gh` not on PATH here): source the token from
`workspace/projects/x-search-mcp-server/.env` (`GITHUB_TOKEN`/`GH_TOKEN`), call
`api.github.com/repos/brianference/redanvil/...` directly. Never print the token — length +
prefix only.

**Grok delegation** (per the teamwork protocol in `docs/claude-grok-teamwork.md` and CLAUDE.md):
give Grok a disposable worktree, never `git add`/commit while it runs, verify the COMMIT not the
tree before pushing. Invocation:
```
git worktree add -q -b fix/<name> <scratchpad>/wt-<name> HEAD
# copy node_modules for root + app-builder + dashboard into the worktree so Grok can run the gate
grok --no-auto-update --always-approve --no-alt-screen --cwd <worktree> \
  --session-id $(node -e "console.log(crypto.randomUUID())") --output-format plain \
  --prompt-file <spec.md>
```
Grok can spawn its own subagent team — tell it to use disjoint file ownership. Always
independently verify its work (run the suite yourself, red-green any new check) before merging.

**Environment gotchas:**
- `tsx -e "..."` inline hangs in this shell — write a `.mts` file and run it instead.
- `grep -P` is unavailable; use `LC_ALL=C grep -E`.
- `check.mjs` has heredoc-escape hazards — build control chars via `String.fromCharCode()`
  (`NUL`/`EOL` constants at the top of the file).
- `$(...)` around a piped command captures the LAST command's exit code; `echo "exit=$?"` after
  a `| head` reports head's status, not the tool's. Redirect to a temp file and read `$?` for the
  real exit code.

## Standing rules set this session (now in CLAUDE.md + memory)
- **Never report bogus numbers** — validate the measurer before quoting it.
- **Judge disagreement → the fail wins** and gets diagnosed (memory:
  `feedback_judge_disagreement_fail_wins`). All 4 disagreements this session were real defects.
- **Grok reviews Claude's PRs too**, not only the reverse.
- **Teamwork protocol** — worktree isolation, never stage mid-delegation, verify the commit not
  the tree (`docs/claude-grok-teamwork.md`).
- **Declared-but-unimplemented rules** pass silently via n/a; bind the rubric to its
  implementations with a coverage test (memory: `reference_declared_but_unimplemented_rules`).
