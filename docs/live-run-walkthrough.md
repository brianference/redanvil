# Live run: prompt to shipped app, start to finish

The exact path, with what to expect at each step and where you decide something. Every command
here was run in the 2026-07-25 simulation (`docs/simulation-2026-07-25-prd-to-app.md`), so the
outputs below are what it actually printed, not a guess.

Set these once:

```bash
cd /c/Users/brian/RedAnvil
export MSYS_NO_PATHCONV=1          # or git rewrites bare "/" routes into C:/Program Files/Git/
export APP=/c/Users/brian/apps/<your-slug>
```

---

## 1. Describe the app — you do this part

Open **https://redanvil.pages.dev** and type the idea in plain language. It asks four things:
the prompt, the app type, whether it needs accounts, and the entities.

**Your decisions here:** app type and entities drive the whole PRD — the data model, the feature
list, and (via §7.3a) the layout archetype. Entities are the nouns the app is about
("Shift, Staff"), not screens.

Press **Forge PRD**, then **Download**. You now have the spec.

> Watch for: the wizard blocks Continue if you deselect every feature. That is the gate, not a
> bug — a PRD with no features would generate an empty app.

## 2. Read §7.3a before anything else

The PRD's **§7.3a Design direction** is the part that makes your app not look like every other
one. It names a layout archetype and a visual direction, chosen deterministically from your own
prompt, plus the shells it explicitly rules out.

The shift-scheduling example got **Split workbench + Editorial**.

**Your decision:** if the archetype genuinely does not fit the domain, say so and pick another —
the spec asks you to argue for it rather than quietly building a centred list. That is the one
place the spec expects you to push back.

## 3. Scaffold

```bash
node -e "console.log(1)" >/dev/null   # sanity: node is on PATH
npx tsx orchestrator/src/cli.ts scaffold <job.json> "$APP"
```

Expect **29 files** and a working git repo with one commit. It ships the required pages, a
token-driven theme, Web Crypto auth, a D1 `wrangler.toml`, a health endpoint, and the design
rules the builder is told to follow.

```bash
cd "$APP" && npm install
npx tsc --noEmit && npx eslint . --max-warnings 0 && npx vitest run && npm run build
```

All five should pass first try, with no edits. If any fail, stop — that is a scaffold bug, not
your code.

## 4. Baseline the gate before writing a line

```bash
cd /c/Users/brian/RedAnvil
npm run gate -- "$APP" --slug <your-slug> --na process --out /tmp/base.json
```

Expect **score 0**, about 25 of 48 rules measurable, every static rule passing, and ~11 `visual`
blockers failing.

**This is the gate working, not the scaffold failing.** Visual rules need a rendered page and a
recorded verdict; nothing has shipped yet. Knowing the baseline means you can tell later whether
a failure is yours.

## 5. Build the features

This is the actual work: the PRD's §8 features, §9 acceptance criteria, §10 tests, built as the
§11 vertical slices. Delegate it or write it — either way the spec is the contract.

Non-negotiables while you build (all enforced, all learned the hard way):

- **No `maxWidth` in a JS style object.** Width goes in a CSS class or a media query can never
  lift it. `fe-no-inline-width` fails the build for this.
- **Theme tokens only** — no raw hex or px for a themed value.
- **Loading, error and empty states on every data screen.** A failure rendered as a clean empty
  success is a blocker.
- **Timeouts on every outbound fetch**, including from the browser.
- **Validate untrusted JSON with a schema**, including a cross-origin response read in the
  client.

Run the app's own five commands after each slice. Cheap, and it keeps the failure surface small.

## 6. Deploy

```bash
cd "$APP" && npm run build
export CLOUDFLARE_API_TOKEN=<NewCloudFlareAccountToken from x-search-mcp-server/.env>
export CLOUDFLARE_ACCOUNT_ID=dd01b432f0329f87bb1cc1a3fad590ee
npx wrangler pages deploy dist --project-name <project> --branch main --commit-dirty=true
```

Then **wait for the alias to settle** before measuring anything:

```bash
for i in $(seq 1 60); do
  curl -s -H 'Cache-Control: no-cache' "https://<project>.pages.dev/?s=$i$RANDOM" \
    | grep -o 'index-[A-Za-z0-9_-]*\.js' | head -1
done
```

Different edge nodes serve old and new for a minute or two — probes alternated six times in a
row during this session. Measuring too early measures the previous build.

Confirm the asset hash matches your local `dist/`, and curl `/api/health`. A wrangler success
message is not proof.

## 7. Measure — on the deployed site, in this order

```bash
cd /c/Users/brian/RedAnvil
P=https://<project>.pages.dev
node .github/scripts/design_audit.mjs   $P --routes /about,/contact,/terms,/privacy,/no-such-page --out evidence/design-<slug>.json
node .github/scripts/desktop_width.mjs  $P --out evidence/width-<slug>.json
node .github/scripts/a11y_audit.mjs     $P --theme dark  --out evidence/axe/<slug>-dark.json
node .github/scripts/a11y_audit.mjs     $P --theme light --out evidence/axe/<slug>-light.json
node .github/scripts/e2e_smoke.mjs      $P --out evidence/e2e-<slug>.json --trace evidence/e2e-<slug>.zip
node .github/scripts/screenshots.mjs    $P <slug> --routes /,/about --out evidence/screenshots
```

Keep `/no-such-page` in the route list on purpose — that is what proves the catch-all renders
instead of an empty document.

**Then look at the screenshots.** Two defects this session were invisible to every measurement:
a footer logo whose baked tagline rendered five pixels tall, and KPI labels truncated to
`TOTAL R…`. An ellipsis is not overflow, so the overflow check passed both.

## 8. Record verdicts and gate

Order matters:

```
commit the code  ->  measure  ->  stamp reviewedCommit  ->  gate
```

A report produced _before_ the commit it vouches for is rejected. Re-stamping is not
re-measuring, and the guard will tell you so.

```bash
npm run gate -- "$APP" --judge evidence/verdicts-<slug>.json \
  --na process --slug <slug> --min-coverage 90 --out results/<slug>.json
```

`git checkout -- results/` first if you need `provenance.dirty=false`, and gate one app at a
time — another app's modified result file also makes the tree dirty.

## 8-9. Measure, record and prove — one command

```bash
npm run reverify
```

Deploy first, then run it. It refuses a dirty tree, refuses a stale deploy (20
consecutive probes, because the alias serves a mix for a minute or two), measures
against the deployed build, stamps verdicts to HEAD **after** measuring, gates one
app at a time on a clean tree, reproduces each result, and ties each to its deploy.

`--app <slug>` for one app, `--skip-propagation` when you have already confirmed
the deploy, `--no-commit` to inspect without committing.

The first re-runs the gate and compares rule by rule. The second proves production is serving
the build that was scored. A score nobody can reproduce is a claim.

## 10. Independent review before calling it done

```bash
node .github/scripts/independent_judge.mjs "$APP" --out evidence/judge-independent-<slug>.json
```

A reviewer with no stake in the code, in a throwaway worktree, with no access to the verdicts.
On this repo it returned **10 FAILs across 20 rules, 9 of them real** — against a self-recorded
tier that had never once disagreed in 334 verdicts.

Its output is **unadjudicated**. Verify each FAIL yourself and record the ones that turn out to
be wrong as wrong; one of the first six was.

---

## The three things most likely to bite

1. **Measuring before the alias settles** — you will measure the previous build and believe it.
2. **Trusting a number over a screenshot** — the width check said 93% for pages using a third of
   the screen, for weeks. If a number and your eyes disagree, your eyes are right and the
   measurement is the thing to debug.
3. **`cmd | tail`** — the pipe reports `tail`'s exit code, not the command's. A commit went in
   with a failing typecheck that way. Redirect to a file and check `$?`.
