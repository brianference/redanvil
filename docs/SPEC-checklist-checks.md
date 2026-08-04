# Spec — implement the 11 unmeasured definition-of-done rows

Scope: `orchestrator/` and `.github/scripts/` only. Do NOT touch
`az-planting-calendar/`, `app-builder/`, or `dashboard/` app source. No git
add/commit/push, no deploy.

Inherited rules — see `rules/base-15.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function.
- Fail closed. Unknown state is an explicit failure, never silent success.
- Write `--`. Never a unicode em dash.

## Context

`docs/DONE-CHECKLIST.md` is now parsed and evaluated by `isDone()`
(`orchestrator/src/done/checklist.mjs`, `coverage.mjs`). A row bound to nothing
is `unimplemented` and FAILS. Eleven rows are in that state and are pinned in
`KNOWN_UNIMPLEMENTED` in `orchestrator/test/doneChecklist.test.ts`.

Your job is to shrink that list to zero by writing real checks.

**Read `orchestrator/src/done/coverage.mjs` first.** Each unimplemented row
carries a `note` explaining exactly what is missing and why the obvious
near-miss does not count.

## Where a new rule has to be registered

A rule that is not registered in all four places either fails as unevaluated or
silently auto-passes. Both have happened in this repo.

1. `orchestrator/src/rubric/rules.ts` — add to `RULES` with lane/severity/method.
2. `orchestrator/src/commands/gate.ts` — add to `APP_CHECKS` (a `det` rule only
   runs if it is listed here).
3. `orchestrator/scripts/checks/<rule-id>.mjs` — the implementation, plus a case
   in `check.mjs` if that is how it dispatches.
4. `orchestrator/src/done/coverage.mjs` — bind the checklist row to the rule id
   and delete the `UNIMPLEMENTED` note.

Then update `KNOWN_UNIMPLEMENTED` in `orchestrator/test/doneChecklist.test.ts`
to `[]` and make the suite pass.

Exit codes for check scripts: **0 = pass, 1 = fail, 3 = not applicable.**

## The eleven rows

### A5 — `npm run build` exits 0 -> rule `u-build-succeeds`

Run the app's build script in the app dir and require exit 0. n/a (exit 3) only
when `package.json` has no `build` script. Do not substitute
`u-plat-runtime-parity`; a wrangler boot is a different command.

### B3 — not-found paths return 404 -> rule `u-api-not-found`

Boot the real runtime (reuse the harness in
`.github/scripts/runtime_parity.mjs`) and assert:

- when detail (`[param]`) routes exist: each with a bogus id
  (e.g. `/api/<collection>/__no_such_id__`) returns **404**, not 200 and not 500;
- when the app has an API surface but no detail routes: a definitely-absent
  `/api/__definitely_absent_<nonce>` path returns **404** (not a 200 SPA shell —
  reuse SPA detection from `u-api-no-spa-mask`);
- discover routes from the app's own `functions/api/` tree rather than a
  hardcoded list.

n/a only when the app has no API surface under `functions/api/` at all.

### B5 — an SPA fallback must not answer for `/api/*` -> rule `u-api-no-spa-mask`

Same boot. Request `/api/__definitely_absent_<random>` and FAIL if the response
is 200, or if the body contains `<!doctype html`/`<div id="root"`. An SPA
fallback returning `index.html` with 200 makes every unmatched API path look
alive; this is the check that catches it. Use a random suffix so a cached or
seeded route cannot accidentally satisfy it.

### D4 — every legal claim is true of this app -> rule `u-legal-claims-true`

A **bidirectional** comparison between the legal/privacy page copy and the code.
Boilerplate about cookies you do not set is a false disclosure; an undisclosed
tracker is worse.

For each of: cookies, accounts/authentication, payments, third-party
analytics/tracking, email collection —

- if the copy **denies** it ("we do not use cookies", "no accounts required"),
  assert the code shows no evidence of it (`document.cookie`, `Set-Cookie`,
  auth routes, payment SDKs, analytics snippets);
- if the code **has** it, assert the copy discloses it.

Report each mismatch with the file and the matched phrase. n/a only when the app
ships no legal pages (which `fe-required-pages` already fails).

### D7 — the mark reads at 32px -> rule `fe-favicon-legible`

`fe-brand-mark` checks bytes and shape, never legibility. Measure the **actual
32x32 render**:

- **ink coverage**: fraction of pixels with alpha > 128 must fall in a sane band
  (an almost-empty icon and a full solid square both fail);
- **detail energy**: mean Sobel gradient magnitude must exceed a floor, so a
  uniform blob fails even at correct coverage;
- **contrast**: mean ink luminance against a white tab and against a dark tab —
  it must be distinguishable on at least one and not vanish on either.

Derive the thresholds from first principles and write down the reasoning. **Do
NOT tune them so the current app passes** — if `az-planting-calendar`'s favicon
fails, report that as a finding. A check tuned to its first subject measures
nothing.

### F4 — the result reproduces independently -> rule `lg-result-reproduces`

A hand-authored `results/<slug>.json` has the same shape as a real one. Assert:

- recomputing the score from the recorded per-rule outcomes equals the recorded
  `finalScore` (reuse `gate/score.ts`, do not reimplement the formula);
- the result's recorded commit matches the commit being gated;
- the rule id set in the result matches the rubric (no invented ids, no missing
  scored ones).

### G1-G5 — the measurement itself

These are about provenance, so they need somewhere to record it. Add
`evidence/measurement-meta.json` per app, written by the checks that produce
measurements, with one entry per check id:

```
{ "<rule-id>": { "tool": "axe-core", "engine": "chromium",
                 "runs": [<result>, <result>], "knownBad": { "input": "...", "failed": true } } }
```

Then:

- **G1 `meas-known-bad`** — every rule whose implementation is newer than its
  recorded `knownBad` entry fails. A check never run against a known-bad input
  carries no information. Ship a `knownBad` fixture for each check YOU write.
- **G2 `meas-two-run`** — any browser-driven measurement must record two runs
  that agree. Disagreement is a FAIL, not a retry-until-green.
- **G3 `meas-recheck-flattering`** — any rule that flipped fail -> pass since the
  previous recorded result must have two agreeing runs. That is the automatable
  form of "a flattering first result was re-checked".
- **G4 `meas-standard-tool`** — contrast and accessibility measurements must
  record `tool: "axe-core"`. A hand-rolled colour parser fails; that mistake
  produced four different wrong answers in one session.
- **G5 `meas-engine-named`** — every browser-driven measurement records its
  engine. `devices['iPhone 13'].defaultBrowserType` is `'webkit'`, so a project
  labelled "mobile" is not Chromium, and two harnesses with the same label are
  not necessarily the same browser.

Wire the existing browser-driven checks (`fe-light-dark`, `fe-search-present`,
`u-api-real-output`) to write their engine and run results into this file, or
G2/G5 will fail for lack of data — which is the correct fail-closed behaviour,
but the point is to make them satisfiable by honest work.

## Proof required

For **each** of the 11 new rules, your report must show:

1. The check run against a **known-bad fixture**, with the real output, exiting
   non-zero. A check that cannot fail is worthless -- this is G1 applied to your
   own work.
2. The check run against a **known-good fixture**, exiting 0.
3. `npm run typecheck`, `npm run lint`, `npm test` for the repo -- real tails.
4. `unimplementedRows()` returning `[]`.

Do not report a rule done without its known-bad output. If a check cannot be
made to fail on bad input, say so plainly rather than shipping it.
