# RedAnvil handoff — 2026-07-25 (v11.0.0)

State after v11.0.0, and what is left. Written so a fresh context can pick up without
re-deriving anything.

## Where things stand

- **HEAD:** see `git log -1`; v11.0.0 tagged.
- **Latest release:** `v11.0.0` (desktop width measured on painted content, shared shell,
  duplication 394 -> 40).
- **Production:** https://redanvil.pages.dev and https://redanvil-dashboard.pages.dev
  (Cloudflare Pages, direct upload / Type B; prod branch `main`, local branch `master`, so
  deploys must pass `--branch main`). Both verified by asset-hash match against the scored
  commit, and `/api/health` returns `{"status":"ok"}`.
- **Gate:** app-builder 100/100 across **54/54** at **96% coverage**; dashboard 100/100 across
  **53/53** at **95%**. Both run `--na process --min-coverage 90` — the CI lane is no longer
  waived. Zero stale verdicts, both reproduced rule-by-rule, both scored from a clean tree and
  tied to the deployed bundle.
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

## What changed in v10.0.0

1. **Both apps independently judged.** `independent_judge.mjs` makes the reviewer repeatable:
   disposable worktree, fresh context, no access to the verdict file, credentials scrubbed,
   cited paths checked to exist on disk. The dashboard's first run returned **4 FAILs** against
   10/10 self-recorded passes; all four were verified and real. Across both apps: **10 FAILs in
   20 rules, 9 confirmed, 1 refuted and recorded as refuted.**
2. **The judge contradicted the gate and won.** It flagged `u-val-input-validation` on the
   dashboard, which the gate had marked n/a "no input". The cross-origin results feed IS
   untrusted input, and it was validated by a hand-rolled `typeof` chain that accepted
   `NaN`, `-1`, `1.5` and empty strings. Now Zod, and the rule now covers client reads of
   cross-origin JSON.
3. **Coverage floored at 90% and cleared by measurement.** Six rules were leaving the
   denominator for reasons about tooling and scope, not code: `u-sec-timeouts` walked
   `functions/` only (missing a client fetch with no timeout at all), and the four `ci-*` rules
   looked for workflows inside the app directory in a monorepo where they live at the root.
4. **`proc-pr-title-ticket` finally runs.** It falls back to the REST API instead of reporting
   a missing `gh` binary forever. Still n/a here — this repo has zero PRs — but the reason is
   now true.
5. **Design direction per app.** §7.3a picks a layout archetype and visual direction from the
   app's own inputs. Measured over eight sample ideas: six distinct archetypes, five distinct
   visual directions. Design rule **R21**.

## What changed in v11.0.0

1. **The desktop-width check was measuring a container.** `main.getBoundingClientRect().width`
   is 100% by default, so it reported 93% for pages whose content sat in the left third. It
   now measures PAINTED extent — text client rects plus painted surfaces, excluding
   header/footer. Four pages that had been "passing" were at 32-60%.
2. **Three causes fixed and enforced:** inline `maxWidth` caps (new blocker rule
   `fe-no-inline-width`, red-tested), a fixed column count that ignored content (now a `:has()`
   quantity query), and the dashboard's content pages never adopting the shared prose classes.
   The requirement ships in §7.3 of every generated PRD, plus design rule **R22**.
3. **Shared shell.** Twelve units moved into `design-system/` parameterised by tokens and copy.
   Duplication **394 -> 40**, real deduplication this time.
4. **A det rule can be declared and never run** — it needs registering in the rubric markdown,
   `RULES`, AND the runner list in `commands/gate.ts`. A test now binds the third.

## Remaining tasks (priority order)

1. **Re-run the independent judge on both apps.** Both reviews are well behind HEAD after this
   session's work, and `judge_dissent.mjs` will say how far. The worst offenders are all genuine shared
   shell code: `Page.tsx` (60), `shell/styles.ts` (57), `NavLinks` (42), `MobileDrawer` (36),
   `useDocumentMeta` (36), `Footer` (34), `ThemeToggle` (31), `Logo` (29), `Header` (26),
   `Breadcrumbs` (22), `linkify` (20). They import per-app theme/i18n, so they need
   parameterising rather than moving — the same shape `shellCss.ts` already uses.
2. **Lower the ratchet below 40** if the remaining shared code is worth parameterising; the
   easy wins are gone.
3. **Build an app end-to-end from a generated PRD** and inspect the result. §7.3a is now proven
   at the spec level (a shift-scheduling dashboard gets Split workbench + Editorial, printed by
   `app-builder/scripts/show-design-directions.mts` and `gen-sample-prd.mts`), but no generated
   app has been built and looked at.
4. **A fifth audit.** Four have each found real problems; the returns have not diminished.

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
node .github/scripts/independent_judge.mjs <appDir> --out evidence/judge-independent-<slug>.json
```

`independent_judge.mjs` is the one that is NOT in CI — `grok` authenticates
interactively — so run it locally after significant work. Its output is
UNADJUDICATED: verify every FAIL by hand and record the ones that turn out to be
wrong as wrong, in the report. One of the first six was.

Keep a bad route (`/no-such-page`) in the design-audit list on purpose — that is what proves the
catch-all still renders.

**CI parity before every push** (`verify_commit.mjs` names the rest itself):

```
node .github/scripts/verify_commit.mjs HEAD
node .github/scripts/verify_results.mjs app-builder results/app-builder.json evidence/verdicts-app-builder.json process
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
