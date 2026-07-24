# Adversarial cross-check report

Independent skeptic attack on gate 100/100, check tests, wizard 400 fix, scoring integrity, e2e harness, and suite quality.

**Date:** 2026-07-24  
**Repo:** `C:\Users\brian\RedAnvil`  
**Constraint:** No repo files edited except this report.

---

## Test suite counts (real runs)

| Scope | Command | Result |
| --- | --- | --- |
| Root (orchestrator workspace) | `npm test` | **19** files, **133** tests, all passed, ~3.5s |
| app-builder | `npx vitest run` | **13** files, **70** tests, all passed, ~0.7s |
| dashboard | `npx vitest run` | **7** files, **40** tests, all passed, ~0.7s |

---

## Ranked findings (confirmed by reproduction)

### F1 — HIGH: `u-sec-param-sql` false-passes classic string-concat SQL injection

**Claim attacked:** Deterministic security checks would fail a genuinely defective app.

**What is wrong:** `findInterpolatedSql` only inspects **template literals** with `` ${} ``. The textbook SQLi pattern `"SELECT … '" + id + "'"` never matches, so the check exits 0.

**Reproduction:**

```text
# temp fixture (not in repo)
export function getUser(db: any, id: string) {
  const q = "SELECT * FROM users WHERE id = '" + id + "'";
  return db.prepare(q);
}

node orchestrator/scripts/checks/check.mjs u-sec-param-sql <temp>
exit=0
```

**Contrast (works):** template form `` `SELECT * FROM users WHERE id = ${id}` `` → exit=1 with `interpolated SQL:…`.

**Impact:** `results/app-builder.json` records `u-sec-param-sql: passed: true` via this check. A production app using string-concat SQL would still score PASS on this blocker.

**File:** `orchestrator/scripts/checks/check.mjs` ~151–166, case `u-sec-param-sql` ~221–230.

---

### F2 — HIGH: `u-sec-no-stub-paths` false-passes always-true auth with any preceding statement

**Claim attacked:** Stubbed auth is caught deterministically.

**What is wrong:** `findUnconditionalAuthStub` only matches function bodies that are **exactly** `return true` (no other statements). An auth guard that logs then returns true, or `return user.role === "admin" || true`, passes.

**Reproduction:**

```text
export function checkAuth(token: string): boolean {
  console.log(token);
  return true;
}
→ exit=0

export function isAuthorized(user: { role: string }): boolean {
  return user.role === "admin" || true;
}
→ exit=0
```

**Contrast (caught):** bare `export function checkAuth() { return true; }` and typed `(): boolean { return true; }` → exit=1 (covered by `checks.test.ts`).

**Impact:** Easy to ship an always-true auth helper that still clears the gate’s det lane.

**File:** `orchestrator/scripts/checks/check.mjs` ~177–198, case ~232–246.

---

### F3 — HIGH: Submit API accepts whitespace-only `appType` (client fixed; server not)

**Claim attacked:** Wizard 400 fix is real end-to-end (`appType` required).

**What holds on the client:**

- `canForgePrd` / `isAppTypeReady` require `appType.trim().length > 0` (`app-builder/src/lib/job.ts:30–36`).
- Wizard: Next disabled on step 2 without type (`Wizard.tsx:465`); submit short-circuits if `!canSubmit` (`:142`); Forge disabled if `!canSubmit` (`:472`).
- Chat (`Home.tsx:63–67`) and custom template (`TemplateGallery.tsx:144–148`) can open wizard with empty `appType`, but step 2 still blocks advance/forge.

**What fails on the server:**

```text
POST /api/submit body appType:""
→ status 400 {"error":"String must contain at least 1 character(s)"}

POST /api/submit body appType:"   "
→ status 200, job queued with answers.appType:"   "
```

Schema is `z.string().min(1)` **without** `.trim()` (`app-builder/functions/api/submit.ts:18–23`). Whitespace has length ≥ 1, so it passes.

**submit.test.ts** covers over-limit `appType` (65 chars) and headers; it does **not** assert empty or whitespace rejection.

**Impact:** UI path is fixed for empty type; API still accepts blank-looking types. Residual hole relative to “appType required.”

---

### F4 — MEDIUM: `parseVerdicts` accepts a **visual** rule with `method: "judge"` (and pure judge for `det+judge` with no det run)

**Claim attacked:** Verdicts cannot stand in for rules that must be measured; method must agree with the rubric.

**Comment in code** (`verdicts.ts:37–40`) claims rejection when “declared method disagrees with the rubric.” **Implementation only blocks `det` and `hook`** (`:72–76`).

**Reproduction (tsx):**

```text
parseVerdicts(visual rule fe-light-dark with method:"judge", evidence README.md)
→ ACCEPTED [{"ruleId":"fe-light-dark","passed":true}]

parseVerdicts(pure-det u-typing-strict as method:"judge")
→ REJECTED — u-typing-strict: method 'det' is decided by a check

parseVerdicts(method:"det" in file)
→ REJECTED by Zod enum (judge|visual only)

parseVerdicts(det+judge u-val-input-validation as method:"judge")
→ ACCEPTED
```

**Related gap:** Several `det+judge` rules have **no** entry in `APP_CHECKS` (`gate.ts:29–51`):

- `u-conc-use-what-exists`, `u-conc-smallest-diff`, `u-test-adequacy`, `fe-fail-closed-states`

Those four in the 100/100 result are **judge-only** (see `evidence/verdicts-app-builder.json`). A hand-written judge PASS with existing evidence paths is enough; no deterministic check ever runs.

---

### F5 — MEDIUM: e2e harness exits **0** when Playwright is missing (silent skip)

**Claim attacked:** e2e guards the wizard regression.

**What holds when Playwright is installed:**

- Asserts Next is disabled before app type (`e2e_smoke.mjs:63–71`).
- Waits on real `/api/submit` via `waitForResponse` (`:85–89`), not a sleep.
- Requires `submit.ok()` and PRD download control visible.

**What fails the claim of a hard guard:**

```text
# temp copy with require() always throwing
node e2e_broken.mjs https://example.com
→ "e2e smoke skipped: playwright is not installed here"
→ exit=0
```

**Also:** The happy path always selects “Mobile app” before Forge. It never POSTs empty/whitespace `appType`. A regression that **only** dropped server `appType.min(1)` while UI gating remained would still pass this e2e.

---

### F6 — MEDIUM: Dashboard `parseRun` accepts `finalScore: 100` with a failed rule

**Claim attacked:** Scoring integrity holds across the system (`redanvil validate` + consumers).

**Orchestrator side HOLDS** (see Claims that held, below).

**Dashboard side does not reuse `RunResultSchema`.** `dashboard/src/lib/summary.ts` `parseRun` only type-checks fields; no coherence refine.

**Evidence in suite:** `dashboard/src/lib/summary.test.ts` `validFeedRow()` (lines 34–54) builds:

- `finalScore: 100`, `passed: true`
- `rules` including `{ ruleId: 'fe-responsive-375', passed: false }`

and `parseRun(validFeedRow())` is expected to succeed (`:105`). A fabricated feed row with 100 next to a failed rule would render on the dashboard.

---

### F7 — MEDIUM: Absence-based checks PASS a near-empty “app”

**Claim attacked:** Checks would not pass a broken app.

**Reproduction:** empty temp app with only `src/empty.ts` and empty `functions/`:

| Rule | Exit |
| --- | --- |
| u-sec-param-sql | 0 |
| u-sec-no-stub-paths | 0 |
| fe-theme-tokens-only | 0 |
| fe-no-unsanitized-html | 0 |
| hyg-secret-scan | 0 |
| u-sec-sast | 0 |
| u-conc-no-padding | 0 |
| hyg-no-duplication | 0 |
| u-typing-scoped-ignores | 0 |
| u-val-input-validation | 3 (N/A — honest) |
| u-sec-timeouts | 3 (N/A — honest) |

**Also:** `hyg-no-binaries` on a temp dir with an 800KB PNG under `src/assets/` (untracked) → exit=0, because only `git ls-files` paths count. Correct for “committed binaries,” but a defective fixture that is not a git repo cannot fail this rule.

These are **not** fully vacuous on real apps with code (they do catch specific patterns when present), but they are **PASS-by-default** when the bad pattern is absent or expressed differently (see F1/F2).

---

### F8 — LOW: Weakest tests in the suite (would not catch a broken implementation)

| Rank | Location | Weakness | Broken impl that still passes |
| --- | --- | --- | --- |
| 1 | `orchestrator/test/smoke.test.ts:5–7` | Only asserts `redanvilVersion()` matches semver | Entire product can be deleted; smoke still green |
| 2 | `app-builder/src/i18n/en.test.ts:5–52` (and dashboard twin) | Presence / `length > 2` / static string equality on copy objects | Wrong runtime wiring; buttons show keys; i18n never loaded — as long as `en.ts` literals stay long enough |
| 3 | `app-builder/functions/api/submit.test.ts` | No empty/`""`/`"   "` appType cases | Server accepts whitespace `appType` forever (F3); over-limit tests still pass |
| 4 | `orchestrator/test/gate.test.ts:11–20, 61–79` | Injects `node -e 'process.exit(0)'` as “checks” | Real `check.mjs` / APP_CHECKS can be broken; gate wiring tests still pass |
| 5 | `dashboard/src/lib/summary.test.ts:34–54, 103–105` | `validFeedRow` is **incoherent** (score 100 + failed rule) and is accepted | Dashboard continues to display impossible scores |

No tautological “assert mock’s own return” patterns stood out as dominant. `checks.test.ts` is comparatively strong (see below).

---

## Claims that held under attack

### C1 — Gate’s 100/100 matches live det checks on app-builder (with caveats)

Ran `node orchestrator/scripts/checks/check.mjs <ruleId> app-builder` for all check.mjs-backed APP_CHECKS:

| Rule | Exit | Matches results? |
| --- | --- | --- |
| u-typing-scoped-ignores … hyg-no-duplication (13 rules) | 0 | Yes (`passed: true`) |
| hyg-no-binaries | 0 | Yes |
| u-sec-timeouts | **3** N/A (`no outbound fetch`) | Not listed in the 41 — correctly dropped from denominator |

Also: `npx tsc --noEmit` → 0, `npx eslint . --max-warnings 0` → 0, `git check-ignore .env` → 0 inside `app-builder`.

**Defective fixtures that correctly FAIL (3 picks):**

1. `u-val-input-validation` — `request.json()` without schema → exit=1  
2. `u-sec-param-sql` — template interpolated SQL → exit=1  
3. `fe-theme-tokens-only` — raw `#ff0000` in component → exit=1  

**Caveat on “41 real checks”:** Of the 41 evaluated rules, **22 are not APP_CHECKS** (visual/judge/`det+judge` without det): e.g. `fe-light-dark`, `fe-a11y-contrast`, `u-conc-idiomatic`, `u-test-behavioral`, … Those are backed by `evidence/verdicts-app-builder.json` (evidence paths + notes), not by `check.mjs`. Rubric size 49; `--na ci` + `--na process` + det N/A timeouts → 41.

**Caveat:** F1/F2 show several det PASSes are pattern-incomplete, so “real check” ≠ “hard to game.”

### C2 — `checks.test.ts` is not vacuous for the three broken-check probes

Temp copies of `check.mjs` with:

1. `hasSchemaValidation` always `return true`  
2. `findInterpolatedSql` always `return null`  
3. `dangerouslySetInnerHTML` regex neutered  

…all exit **0** on defective fixtures that the real script fails.

`checks.test.ts` runs the real script via `CHECK_SCRIPT` and asserts `status !== 0` (and stderr match) on those defects. Against a broken check, those expectations **fail**. Non-vacuous for the three rules tested this way.

### C3 — Scoring integrity (orchestrator path) holds for the three classic smuggles

| Attack | Result |
| --- | --- |
| `parseOutcomes(..., "passed":"yes")` | **REJECTED** ValidationError |
| `computeScore` with all `passed: "yes"` (smuggled types) | **score 0**, full blocker list (`passed === true` in `score.ts:24`) |
| Pure-`det` rule as verdict | **REJECTED** |
| Result with `finalScore:100` + failed rule | **REJECTED** by `RunResultSchema` refine; `validateFile` → `ok: false` |
| Real `results/app-builder.json` | `validateFile` → `{ ok: true, kind: 'results' }` |

Does **not** hold for dashboard feed parsing (F6) or method-mismatch verdicts (F4).

### C4 — Wizard empty-`appType` UI path is closed; chat/template cannot Forge without a type

- No client path sets Forge enabled with empty type when using Wizard controls.  
- Composer only sets `prompt` and opens step 2; Next stays disabled until type (`Wizard.tsx` + e2e intent).  
- Server still rejects `""` (but not `"   "` — F3).

### C5 — e2e asserts Next disabled + real submit response **when Playwright loads**

Source inspection of `.github/scripts/e2e_smoke.mjs:63–89` confirms both assertions. F5 limits this to environments where Playwright is installed and the script is actually run.

---

## Summary table

| Claim | Verdict under attack |
| --- | --- |
| Gate 100 is fully “real” measurement | **Partial** — det exits match; many rules are verdicts; F1/F2 false-pass holes |
| check.mjs tests not vacuous | **Holds** for broken-check probes on 3 rules |
| Wizard 400 fix real | **Mostly holds** on UI; **fails** on whitespace API + missing API tests |
| Scoring integrity | **Holds** in orchestrator validate/score; **fails** on dashboard + verdict method mismatch |
| e2e guards regression | **Partial** — real asserts if run; skip=0; never hits empty appType POST |

---

## Highest-value fixes (not applied; report only)

1. Extend `u-sec-param-sql` to string-concat / `+` SQL construction, not only templates.  
2. Harden stub-auth detection beyond single-statement bodies.  
3. `appType: z.string().trim().min(1)` + unit tests for `""` and `"   "`.  
4. In `parseVerdicts`, require `v.method === rule.method` (or allow only the non-det half of `det+judge`).  
5. e2e: exit non-zero if Playwright missing in CI; optional negative case POST without app type.  
6. Dashboard: reuse `RunResultSchema` (or the same refinements) before rendering KPIs.

---

## Reproduction log (abbrev)

```text
# Det checks vs app-builder
u-typing-scoped-ignores … hyg-no-duplication → exit 0
u-sec-timeouts → exit 3 n/a: no outbound fetch in this app

# Defective fixtures
u-val-input-validation defect → exit 1
u-sec-param-sql template defect → exit 1
fe-theme-tokens-only defect → exit 1
u-sec-param-sql string-concat defect → exit 0   # F1
u-sec-no-stub-paths multi-stmt auth → exit 0    # F2

# Broken check copies → exit 0 on defects (tests would fail)  # C2

# Score attacks
parseOutcomes yes → REJECTED
computeScore smuggled yes → score 0
pure-det verdict → REJECTED
100+failed rule validateFile → ok:false
real results → ok:true
visual+method judge → ACCEPTED                     # F4

# Submit
appType "" → 400
appType "   " → 200                                 # F3

# e2e without playwright → exit 0                   # F5

# npm test → 133 pass; app-builder 70; dashboard 40
```
