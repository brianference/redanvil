# RedAnvil Orchestrator Engine Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, per the owner's no-stall mandate). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn the Foundation into a working build loop: a bounded command runner, a deterministic gate that scores a target repo against the rubric, a capped-judge hook, a bounded/isolated Grok harness, pre-flight token + collision analysis, ralph-driven iteration, and a deploy verifier.

**Architecture:** Everything runs inline in the orchestrator session. The Grok subprocess and every gate check go through the bounded runner (`process/run.ts`), so nothing can hang. The gate maps check results to rubric rule ids and computes a 0-100 score; the judge contributes at most 30% of tier-2. Grok runs in a disk-isolated worktree with a scrubbed env and no deploy authority.

**Tech Stack:** Node 20+, TypeScript strict, Vitest, the Grok CLI (`grok`, already installed), `npx wrangler` for runtime-parity and deploy.

## Global Constraints

Inherit Plan 1's Global Constraints. Additional:

- Every subprocess goes through `runCommand` with a timeout. No raw `spawn`/`exec` on the critical path.
- The score is computed inline from real output; Grok self-report is never read.
- Grok's env is built with `scrubbedEnv` — no secrets. Grok never pushes or deploys.
- Enforce `rules/loop-gate.md` (lg-*) at every step.

---

## File Structure

```
orchestrator/src/
  process/run.ts              bounded command runner + scrubbedEnv  [DONE — Task 1]
  gate/checks.ts              Check definition + the default check set (id -> command -> rule)
  gate/runGate.ts             run checks in a repo, map to rule outcomes
  gate/score.ts               outcomes + rubric -> 0-100 (tier-1 blockers, capped tier-2)
  grok/harness.ts             invoke Grok headless in a worktree, bounded, scrubbed, no-deploy
  worktree/isolate.ts         create/remove a disk-isolated git worktree for a run
  preflight/tokens.ts         deterministic token-cost estimate from a plan
  preflight/collision.ts      file-set overlap analysis for parallelizable tasks
  loop/ralph.ts               bind the completion-promise to the inline score; drive iterations
  deploy/verify.ts            asset-hash + live-endpoint verification after deploy
orchestrator/test/
  run.test.ts                 [DONE — Task 1]
  score.test.ts
  runGate.test.ts
  harness.test.ts
  collision.test.ts
  tokens.test.ts
  deploy.test.ts
  fixtures/                   good repo + anti-pattern repo for the degradation test
```

---

### Task 1: Bounded command runner — DONE

Implemented in `orchestrator/src/process/run.ts` with `runCommand` (hard timeout, kills on overrun, always resolves) and `scrubbedEnv` (withholds secrets from subprocesses). Six tests in `run.test.ts` cover success, non-zero exit, timeout-kill, missing binary, and env scrubbing. This is the no-stall primitive every later task builds on.

---

### Task 2: Score computation

**Files:** Create `orchestrator/src/gate/score.ts`; Test `orchestrator/test/score.test.ts`.

**Interfaces:**

- Consumes: `Rule`, `loadRubric`, `cappedJudgeShare` (Plan 1).
- Produces: `type Outcome = { ruleId: string; passed: boolean }`; `computeScore(outcomes: Outcome[], rules?: Rule[]): { score: number; blockers: string[] }`.

**Rules:** any failing blocker forces `score` well below any threshold and lists the blocker ids; with all blockers passing, `score` is `100 * (tier1Pass + cappedTier2Pass)` where tier-2 is weighted by rule weight and judge contribution is clamped to `cappedJudgeShare`.

- [ ] Step 1: write `score.test.ts` — (a) a failing blocker yields `score < 50` and names the blocker; (b) all pass yields `score === 100`; (c) a failing judge-only rule drops the score by at most the capped judge share.
- [ ] Step 2: run to fail. Step 3: implement `computeScore`. Step 4: run to pass. Step 5: commit `feat: rubric score computation with blocker gate and capped judge`.

Reference implementation sketch:

```ts
export type Outcome = { ruleId: string; passed: boolean };

export function computeScore(
  outcomes: Outcome[],
  rules = loadRubric()
): { score: number; blockers: string[] } {
  const byId = new Map(outcomes.map((o) => [o.ruleId, o.passed]));
  const blockers = rules
    .filter((r) => r.severity === 'blocker' && byId.get(r.id) === false)
    .map((r) => r.id);
  if (blockers.length > 0) return { score: 0, blockers };

  const tier2 = rules.filter((r) => r.severity !== 'blocker');
  const total = tier2.reduce((s, r) => s + r.weight, 0) || 1;
  const isJudge = (r: (typeof tier2)[number]) => r.method === 'judge' || r.method === 'det+judge';
  const detPass = tier2
    .filter((r) => !isJudge(r) && byId.get(r.id) !== false)
    .reduce((s, r) => s + r.weight, 0);
  const judgePass = tier2
    .filter((r) => isJudge(r) && byId.get(r.id) !== false)
    .reduce((s, r) => s + r.weight, 0);
  const detFrac = detPass / total;
  const judgeFracRaw = judgePass / total;
  const judgeFrac = Math.min(judgeFracRaw, cappedJudgeShare(rules));
  const score = Math.round(100 * (detFrac + judgeFrac));
  return { score, blockers: [] };
}
```

---

### Task 3: Deterministic gate runner

**Files:** Create `gate/checks.ts`, `gate/runGate.ts`; Test `runGate.test.ts` with `test/fixtures/`.

**Interfaces:**

- `type Check = { ruleId: string; command: string; args: string[] }`.
- `DEFAULT_CHECKS: Check[]` — e.g. `u-typing-strict` → `npx tsc --noEmit`; `u-conc-dead-code`/`u-typing-no-any` → `npx eslint . --max-warnings 0`; `u-test-presence` → `npm test`; `hyg-secret-scan` → a bundled secret grep; runtime parity → build + `npx wrangler pages dev` boot + curl.
- `runGate(repoDir: string, checks?: Check[]): Promise<Outcome[]>` — runs each check via `runCommand` (timeout), maps exit 0 → passed.

- [ ] Steps: write `runGate.test.ts` using two fixtures — a clean repo (all pass) and an anti-pattern repo (a deliberate `any` and no tests) that must produce failing blocker outcomes → `computeScore` returns `score 0` with blockers. This is the degradation test from the spec (§7 calibration). Implement, verify, commit.

---

### Task 4: Grok harness (bounded, isolated, no-deploy)

**Files:** Create `worktree/isolate.ts`, `grok/harness.ts`; Test `harness.test.ts`.

**Interfaces:**

- `withWorktree(repoDir, branch, fn): Promise<T>` — create a git worktree, run `fn(worktreeDir)`, always remove it.
- `runGrok(worktreeDir, prompt, opts): Promise<RunResult>` — invokes `grok --no-auto-update --always-approve --no-alt-screen --cwd <wt> --session-id <run> -m grok-4.5 --output-format json -p <prompt>` via `runCommand` with a timeout and `scrubbedEnv([])` (no secrets). Forbids push/deploy by env and prompt.

- [ ] Steps: test `withWorktree` creates and cleans a worktree (git required, real). Test `runGrok` builds the correct argv and passes a scrubbed env (inject a fake `grok` shim on PATH for the unit test; the live grok is exercised in Plan 4, gated on `grok login`). Implement, verify, commit.

Note: the live end-to-end Grok run requires `grok login` (browser auth to the owner's Grok account) — a human-only step performed before Plan 4.

---

### Task 5: Pre-flight — token estimate + collision analysis

**Files:** Create `preflight/tokens.ts`, `preflight/collision.ts`; Test `tokens.test.ts`, `collision.test.ts`.

**Interfaces:**

- `estimateTokens(plan: { tasks: number; features: number }): { iterations; grokTokens; claudeTokens; confidence }` — deterministic heuristic; monotonic in inputs.
- `analyzeCollisions(tasks: { id: string; files: string[] }[]): { parallelizable: string[][]; serialized: string[] }` — group tasks with disjoint file sets; any overlap → serialize (conservative).

- [ ] Steps: tests assert (a) more features → more estimated iterations; (b) two tasks touching the same file are never in the same parallel group. Implement, verify, commit.

---

### Task 6: Ralph-driven loop

**Files:** Create `loop/ralph.ts`; Test folded into an integration test with a stub gate.

**Interfaces:**

- `runLoop({ repoDir, spec, threshold, maxIters, gate, coder }): Promise<RunResult>` where `gate` and `coder` are injectable (real: `runGate`+`computeScore`, `runGrok`); emits `<promise>SCORE>=THRESHOLD</promise>` only when the inline score clears the threshold; always bounded by `maxIters`.

- [ ] Steps: test with a fake coder that improves the score each iteration and a fake gate — assert the loop stops exactly when score ≥ threshold, and stops at `maxIters` otherwise, and never calls the coder after passing. Implement, verify, commit.

---

### Task 7: Deploy verifier

**Files:** Create `deploy/verify.ts`; Test `deploy.test.ts`.

**Interfaces:**

- `verifyDeploy(prodUrl, localDistDir): Promise<{ ok: boolean; reason?: string }>` — extract the built asset hash from local `dist`, fetch the prod page, confirm the same hash is served, and curl a real backend endpoint for a 200. Matches the owner's Cloudflare rule that a deploy "success" is not proof.

- [ ] Steps: test hash extraction and mismatch detection against fixture HTML. The live deploy is Plan 4, gated on Cloudflare credentials.

---

## Human gate (before Plans 4–5, the live build + deploy)

Autonomous build covers the engine (Plans 2–3) with fixtures and a fake-grok shim. Going live needs, once:

- `grok login` — browser auth to the owner's Grok account (Grok CLI 0.2.103 is already installed). No API key.
- Cloudflare + GitHub credentials confirmed: the Cloudflare token in `x-search-mcp-server/.env` (`NewCloudFlareAccountToken`, account `dd01b432f0329f87bb1cc1a3fad590ee`) and a classic GitHub PAT with `repo` + `workflow` scopes to create the repo and push.

## Self-Review

Covers spec §4 (loop), §6 (gate + judge), §7 (rubric scoring + degradation test), §8 (isolation), and the loop-gate rules (bounded runner, timeout, worktree isolation, scrubbed env, no-deploy, ralph bounding, runtime parity). Deferred to Plans 4–5: the live Grok run, the app-builder and dashboard apps, and real Cloudflare deploys — all gated on the human auth step above.
