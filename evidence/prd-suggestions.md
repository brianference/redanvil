# PRD generator improvements for agentic consumption

**Scope:** Analysis only. Source of truth: `app-builder/src/lib/prd.ts`.  
**Consumer:** Coding agent (Claude Code / Grok Build) pasting the markdown as a build spec.  
**Standards referenced:** `rules/base-15.md`, `rules/per-app-pack.md`, `rules/loop-gate.md`, `docs/claude-primitives-integration.md`, `orchestrator/src/schemas/prd.ts`, `orchestrator/src/commands/gate.ts`, `prompts/grok-coder.md`.

---

## (a) Assessment: current 12 sections vs 6 agentic best practices

Legend: **Yes** = supports well · **Partial** = present but weak for agents · **No** = missing or counterproductive · **N/A** = not the job of that section.

| #   | Current section      | Source                  | 1. Bite-sized ordered tasks | 2. Acceptance criteria                                   | 3. Interface-first                                    | 4. Constraint-explicit              | 5. Self-verifying                          | 6. No placeholders                  |
| --- | -------------------- | ----------------------- | --------------------------- | -------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------- | ------------------------------------------ | ----------------------------------- |
| 1   | Summary              | `prd.ts:114-118`        | N/A                         | No                                                       | No                                                    | Partial (names gate 90)             | Partial (threshold only)                   | Partial (raw prompt, OK)            |
| 2   | Goals                | `prd.ts:120-124`        | No                          | No                                                       | No                                                    | Partial (restates 90)               | No                                         | Yes (generic but real)              |
| 3   | Target users         | `prd.ts:126-128`        | No                          | No                                                       | No                                                    | No                                  | No                                         | Partial (prompt mangle)             |
| 4   | Core features        | `prd.ts:96-108,130-132` | No                          | **Partial** (prose `*Acceptance:*`, not GIVEN/WHEN/THEN) | No                                                    | No                                  | Partial (one 500ms claim, unproven)        | **No** (generic CRUD templates)     |
| 5   | Data model           | `prd.ts:89-94,134-141`  | No                          | No                                                       | **Partial** (table after features; columns are stubs) | Partial (param SQL + Zod one-liner) | No                                         | **No** (`plus fields specific to…`) |
| 6   | Enforced tech stack  | `prd.ts:143-149`        | No                          | No                                                       | Partial (stack only)                                  | **Yes**                             | No                                         | Yes                                 |
| 7   | Design requirements  | `prd.ts:151-157`        | No                          | Partial (checklist-ish)                                  | No                                                    | **Yes**                             | Partial (viewport list, no command)        | Yes                                 |
| 8   | Quality rules        | `prd.ts:159-164`        | No                          | No                                                       | No                                                    | **Yes**                             | No                                         | Yes                                 |
| 9   | Test design          | `prd.ts:166-171`        | Partial (categories)        | Partial                                                  | No                                                    | Partial                             | **Partial** (layers named, commands vague) | Yes                                 |
| 10  | Effort estimate      | `prd.ts:173-176`        | No                          | No                                                       | No                                                    | No                                  | No                                         | Yes (numbers from estimate)         |
| 11  | Scaffolding manifest | `prd.ts:178-190`        | Partial (paths only)        | No                                                       | **Partial** (tree, no signatures/DDL)                 | No                                  | No                                         | Partial                             |
| 12  | Initial build prompt | `prd.ts:192-194`        | Partial (one mega-task)     | No                                                       | No                                                    | Partial (points at 6–8)             | Partial (wrangler + visual, no gate CLI)   | Yes                                 |

### Gap summary against the six practices

| Practice                          | Verdict                          | Why                                                                                                                                                                                                                                                        |
| --------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Bite-sized and ordered**     | **Fail**                         | No dependency-ordered task list. Section 11 is a tree, not a sequence. Section 12 is a single unbounded prompt. Agents over-scope or thrash.                                                                                                               |
| **2. Acceptance-criteria driven** | **Weak**                         | Features carry italic acceptance prose (`prd.ts:97-107`), not GIVEN/WHEN/THEN or assertion form. UAT rule `lg-role-uat` (`loop-gate.md`) requires every acceptance line to be exercised; soft prose is hard to map to a Playwright case.                   |
| **3. Interface-first**            | **Fail**                         | Features (4) come before data model (5). Model is not real DDL (`prd.ts:92`: "plus fields specific to…"). No function signatures, route contracts, or Zod schema names. Parallel agents will invent diverging shapes.                                      |
| **4. Constraint-explicit**        | **Strong prose, weak structure** | Stack/design/quality (6–8) are solid and align with `per-app-pack.md` / `base-15.md`. Missing: **non-goals**, and constraints are not restated as checkable bullets with a verification command. Heavy overlap with injected `CLAUDE.md` at scaffold time. |
| **5. Self-verifying**             | **Partial**                      | Threshold 90 appears (`prd.ts:112,118,194`). Mentions Vitest/Playwright/axe/wrangler (`prd.ts:166-171,194`). Does **not** name `npm run gate -- <appDir> --threshold 90` (see `README.md` / `gate.ts`), nor per-task verify steps.                         |
| **6. No placeholders**            | **Fail**                         | Entity column stubs (`prd.ts:92`), generic "Manage X" features, target-users string rewrite of the prompt (`prd.ts:128`), scaffolding that only names first entity. Agents fill gaps with speculation.                                                     |

### Secondary structural issues

- **Human PRD, not agent spec.** Title still says "Product Requirements Document" (`prd.ts:110`). Sections 2–3 read like PM copy.
- **Machine-readable gap.** Orchestrator `PrdSchema` (`orchestrator/src/schemas/prd.ts`) expects structured fields (`kind`, `features[].acceptance`, `tokenEstimate`, …). App-builder emits only free markdown in `Prd.markdown` (`prd.ts:11-18`). `buildJob` already has `slug`, `targetType`, `threshold`, `answers` (`job.ts:105-119`) — the PRD does not embed an equivalent parseable block for the orchestrator.
- **Redundancy with injected rules.** Grok already gets `CLAUDE.md` + `prompts/grok-coder.md`. Sections 6–8 restate much of `per-app-pack.md` and base-15. Agents often skim long rule walls after the first paste.

---

## (b) Proposed section structure (agentic PRD)

Replace the 12 human-PM sections with the ordered structure below. Numbering is intentional: agents and the initial build prompt reference sections by number.

### 0. Machine frontmatter (YAML or fenced JSON)

**Contains:**

```yaml
---
kind: prd
slug: <slug>
title: <title>
appType: <from wizard>
targetType: fullstack-web
hasAuth: true|false
entities: [Trip, Driver, ...]
threshold: 90
estimate:
  iterations: N
  tokens: N
  confidence: low|medium|high
requiredPages: [Home, About, Terms, Privacy, Contact]
---
```

**Why an agent needs it:** Orchestrator can parse without NLP; scaffold/loop can key off `hasAuth`, `entities`, `threshold` without re-reading prose. Aligns with `buildJob` (`job.ts:105-119`) and `PrdSchema` (`orchestrator/src/schemas/prd.ts`).

**Differs from today:** Nothing parseable exists; all metadata is buried in markdown headings and free text.

---

### 1. One-line mission

**Contains:** Single sentence restating the user prompt + app type + ship bar (`score >= threshold`).

**Why:** Orient the agent in one glance before contracts.

**Differs from today:** Collapses Summary + Goals (`prd.ts:114-124`) into one line. Drops motivational goals.

---

### 2. Non-goals / out of scope

**Contains:** Explicit exclusions derived from wizard answers and platform defaults, e.g.:

- No mobile native shell (unless appType says otherwise)
- No Supabase / Express / bcrypt / jsonwebtoken
- No admin analytics unless stated
- No multi-tenant orgs unless stated
- Do not invent entities beyond the list in frontmatter
- Do not push, deploy, or touch secrets (mirror `lg-grok-no-deploy` / `lg-grok-no-secrets`)

**Why:** Agents over-build. Non-goals are the highest-leverage cut instruction.

**Differs from today:** Absent entirely.

---

### 3. Interface contract (BEFORE features)

**Contains, in this order:**

1. **Canonical file tree** (paths only — expand section 11)
2. **D1 schema as real DDL** — `CREATE TABLE` per entity with typed columns (not "fields specific to X"). Auth tables when `hasAuth`. Indexes for list/search columns.
3. **API surface** — method + path + request/response TypeScript types, e.g. `GET /api/trips`, `POST /api/auth/register`
4. **Key function signatures** — e.g. `hashPassword(password: string, salt: Uint8Array): Promise<ArrayBuffer>`, Zod schema names (`TripCreateSchema`), D1 bind helper signatures
5. **Route map** — React Router paths for required + domain pages

**Why:** Interface-first prevents parallel drift. Matches scaffold seed style (`orchestrator/src/scaffold/templates.ts`) and app-builder's own migration discipline (`app-builder/migrations/0001_init.sql`).

**Differs from today:** Today's data model is a markdown table after features (`prd.ts:134-141`) with placeholder columns (`prd.ts:92`). Scaffolding has no signatures (`prd.ts:178-190`).

---

### 4. Features with testable acceptance criteria

**Contains:** Per feature:

| Field      | Form                                                       |
| ---------- | ---------------------------------------------------------- |
| ID         | `F1`, `F2`, …                                              |
| Name       | short                                                      |
| Behavior   | one sentence                                               |
| Acceptance | **GIVEN … WHEN … THEN …** (or a single concrete assertion) |
| UAT note   | which Playwright test / curl must exercise it              |

Example shape (not current output):

```text
### F2 — Trip detail
GIVEN a trip id that exists
WHEN the user opens /trips/:id
THEN the page shows all Trip columns from the schema and a back link to the list
Verify: Playwright test `trip-detail.spec.ts` loads fixture trip and asserts title + back link
```

**Why:** `lg-role-uat` fails features with no exercised acceptance line. Soft italic acceptance (`prd.ts:97-107`) is not mappable.

**Differs from today:** Generic templates; acceptance is prose not scenarios; no feature IDs; no verify binding.

---

### 5. Task breakdown (dependency order)

**Contains:** Numbered tasks `T1…Tn`, each with:

- **Depends on:** task ids or `none`
- **Files:** exact paths to touch
- **Do:** 1–5 concrete steps (no "add error handling")
- **Verify:** exact shell command + expected signal

Suggested default order for fullstack-web:

| Task | Intent                                                   | Example verify                                                          |
| ---- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| T1   | Scaffold + package.json + tsconfig strict + theme tokens | `npx tsc --noEmit`                                                      |
| T2   | D1 migration DDL + wrangler binding                      | migration file exists; `wrangler d1 migrations apply --local`           |
| T3   | Zod schemas + typed API client                           | unit tests on schemas                                                   |
| T4   | Health endpoint                                          | `curl -s localhost:…/api/health` → `{"status":"ok"}`                    |
| T5   | Auth (if hasAuth)                                        | register → sign-in → cookie → own-data only                             |
| T6   | Entity CRUD APIs                                         | parameterized SQL tests                                                 |
| T7   | List/search + detail UI                                  | Playwright primary flow                                                 |
| T8   | Required pages + SEO                                     | routes resolve; sitemap/robots present                                  |
| T9   | Loading/error/empty + confirm destructive                | component/Playwright                                                    |
| T10  | a11y + visual viewports                                  | axe zero serious/critical; screenshots 375/768/1280                     |
| T11  | Full gate                                                | `npm run gate -- <appDir> --threshold 90` (or project-local equivalent) |

**Why:** Bite-sized, ordered, independently testable — practice #1. Matches the loop's gate composition (`gate.ts` APP_CHECKS: tsc, eslint, vitest, runtime parity).

**Differs from today:** Does not exist. Closest is scaffolding tree + one mega build prompt.

---

### 6. Constraints checklist (checkable, not essay)

**Contains:** Short bullets, each ending with how it is checked. Merge today's 6–8 into one list:

- Platform: Pages Functions + D1 + Web Crypto — **gate:** `u-plat-worker-runtime`, runtime curl
- No Node globals / native modules — **gate:** runtime parity (`lg-runtime-parity`)
- Strict TS, zero `any` — **gate:** `tsc --noEmit`, eslint
- Theme tokens only, WCAG AA — **gate:** `fe-theme-tokens-only`, axe visual tier
- Required pages + SEO — **gate:** file presence / route smoke
- Real data only, fail closed UI — **judge/UAT**
- Parameterized SQL + Zod at boundary — **gate:** `u-sec-param-sql`, `u-val-input-validation`

**Why:** Constraints must be checkable. Prose walls get ignored after injection of the same rules via `CLAUDE.md`.

**Differs from today:** Three essay sections (`prd.ts:143-164`) without per-rule verify mapping.

---

### 7. Verification / gates (commands + target score)

**Contains:**

```text
Target: score >= 90 (threshold from frontmatter)

Per-iteration / final commands (run from app dir unless noted):
1. npx tsc --noEmit
2. npx eslint . --max-warnings 0
3. npx vitest run
4. npm run build
5. npx wrangler pages dev ./dist   # then:
   curl -sf http://127.0.0.1:<port>/api/health
   curl -sf http://127.0.0.1:<port>/
6. Playwright primary flow + axe (zero serious/critical)
7. Visual review screenshots at 375 / 768 / 1280 (light + dark)
8. From monorepo root (when available):
   npm run gate -- <appDir> --threshold 90 [--judge …] [--na ci,process]

Stop condition: inline score >= threshold with zero tier-1 blockers
  (lg-score-threshold, lg-score-tiers). Do not trust self-report.
```

**Why:** Practice #5. Ties PRD to real RedAnvil gate (`README.md`, `loop-gate.md`, `gate.ts`), not a vague "target score: 90".

**Differs from today:** Threshold mentioned; exact gate CLI and per-command expected outcomes missing (`prd.ts:166-171,192-194`).

---

### 8. Scaffolding seed (slim)

**Contains:** Only what is not already in section 3: package scripts, wrangler.toml shape, `functions/api/health.ts` contract, design-system token import path.

**Why:** Avoid duplicating the full tree from section 3.

**Differs from today:** Section 11 is the only path list and sits late (`prd.ts:178-190`).

---

### 9. Initial build prompt (tight, section-referenced)

**Contains:** A short paste block, e.g.:

```text
Implement this agent spec in dependency order (section 5, T1→Tn).
Honor the interface contract (section 3) before UI.
Implement every feature F* with its GIVEN/WHEN/THEN (section 4).
Do not implement non-goals (section 2).
After each task, run that task's Verify command.
Do not stop until section 7's full gate clears score >= threshold.
No push, no deploy, no secrets. Smallest correct diff. Strict TS, zero any.
```

**Why:** Agents follow numbered instructions better than a paragraph that only cites "sections 6–8" (`prd.ts:194`).

**Differs from today:** One dense paragraph; no task order; no non-goals; no gate CLI.

---

### Optional appendix (orchestrator only, not for the coder paste)

**Effort estimate** (`prd.ts:173-176`) and human-facing copy can live here or only in the app-builder UI / `job.json`. The coding agent does not need iteration budgets; the orchestrator does (`lg-budget-ceiling`).

---

### Proposed vs current map

| Proposed                | Absorbs / replaces                                      |
| ----------------------- | ------------------------------------------------------- |
| 0 Frontmatter           | New (+ machine fields from `buildJob`)                  |
| 1 Mission               | 1 Summary, 2 Goals                                      |
| 2 Non-goals             | New                                                     |
| 3 Interface contract    | 5 Data model + 11 Scaffolding (expanded, reordered)     |
| 4 Features + AC         | 4 Core features (hardened)                              |
| 5 Task breakdown        | New                                                     |
| 6 Constraints checklist | 6 + 7 + 8 (merged, checkable)                           |
| 7 Verification gates    | 9 Test design (expanded) + gate CLI                     |
| 8 Scaffolding seed      | Slim remainder of 11                                    |
| 9 Build prompt          | 12 Initial build prompt                                 |
| Drop / UI-only          | 3 Target users; 10 Effort estimate (out of coder paste) |

---

## (c) Ranked change list (impact on agent build quality × implement cost)

| Rank | Change                                                                          | Impact                                        | Cost            | Notes                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------- | --------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **Task breakdown with per-task verify** (new §5)                                | **High**                                      | **Medium**      | Template from appType/hasAuth/entities; biggest reduction in thrash and half-built apps.                                                       |
| 2    | **GIVEN/WHEN/THEN acceptance per feature** (harden §4)                          | **High**                                      | **Medium**      | Directly feeds UAT (`lg-role-uat`). Can template from entity list + auth flag; domain-specific AC may need prompt heuristics later.            |
| 3    | **Interface contract: real DDL + routes + signatures before features** (new §3) | **High**                                      | **Medium–High** | DDL generation from entity names needs sensible default columns (id, created_at, user_id?, title, …) — still better than "fields specific to". |
| 4    | **Verification/gates section with exact commands + threshold** (new §7)         | **High**                                      | **Low**         | Mostly static text + `threshold` interpolation; cite `npm run gate` and APP_CHECKS.                                                            |
| 5    | **Non-goals / out of scope** (new §2)                                           | **High**                                      | **Low**         | Static platform non-goals + "no entities beyond list" + no deploy/secrets.                                                                     |
| 6    | **Machine frontmatter / JSON block** (new §0)                                   | **High** (orchestrator) / Medium (solo paste) | **Low**         | Cheap; unlocks parseability for loop/scaffold. Optionally dual-emit markdown + structured object later to match `PrdSchema`.                   |
| 7    | **Tighten initial build prompt to reference sections by number**                | **Medium**                                    | **Low**         | Rewrite the template string at `prd.ts:192-194`.                                                                                               |
| 8    | **Merge 6–8 into checkable constraints**                                        | **Medium**                                    | **Low**         | Reduces token load and skim-skip; keep one list.                                                                                               |
| 9    | **Feature IDs + verify binding (F1 → test name)**                               | **Medium**                                    | **Low–Medium**  | Depends on §4/§5.                                                                                                                              |
| 10   | **Drop/move target users + effort from coder paste**                            | **Low–Medium**                                | **Low**         | Smallest-diff cleanup; estimate stays in UI/`job.json`.                                                                                        |
| 11   | **Domain-specific features from prompt NLP**                                    | **High if good**                              | **High**        | Expensive; current entity-driven templates are OK as v1 if AC/DDL/tasks land first. Defer.                                                     |
| 12   | **Align markdown generator with orchestrator `PrdSchema` dual format**          | **Medium** (system)                           | **Medium**      | Separate schema/API work; not required for paste quality.                                                                                      |

### Cheap wins (do first)

1. Frontmatter block
2. Non-goals
3. Verification/gates section with real commands
4. Build-prompt rewrite
5. Cut target users; move effort estimate out of agent paste

### Expensive but high value (do next)

1. Task graph generation
2. Real DDL + API signatures
3. Scenario-style acceptance criteria

---

## (d) What to cut (redundant / agent-ignored)

Apply smallest-diff: cut from the **agent-facing markdown**, not necessarily from the product UI.

| Content                                                                 | Location         | Why cut or demote                                                                                                                                                        |
| ----------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **§2 Goals** motivational bullets                                       | `prd.ts:120-124` | Restates summary + score 90. Agents ignore "ship a clean modern UI" fluff when rules already enforce it. Fold one line into mission.                                     |
| **§3 Target users**                                                     | `prd.ts:126-128` | Heuristic rewrite of the prompt; often nonsense. Not actionable for implementation. Zero loss for agents.                                                                |
| **§10 Effort estimate in the paste**                                    | `prd.ts:173-176` | Useful for humans and orchestrator budget (`lg-budget-ceiling`); useless to the coder mid-build. Keep in frontmatter and UI only.                                        |
| **Triplicate rule essays (stack / design / quality as separate walls)** | `prd.ts:143-164` | Largely duplicates `per-app-pack.md` + `base-15.md` already injected into the build session (`prompts/grok-coder.md`). Merge to one checkable checklist with gate hooks. |
| **Placeholder entity columns**                                          | `prd.ts:92`      | `"plus fields specific to ${e}"` actively invites invention. Replace with concrete default DDL or omit the column claim.                                                 |
| **Generic 500ms search acceptance**                                     | `prd.ts:97`      | Unverified performance claim (conflicts with "never report unvalidated measurement" culture in base-15 #16). Prefer functional empty-state + match assertion.            |
| **PM title "Product Requirements Document"**                            | `prd.ts:110`     | Optional rename to "Agent build spec" / "Implementation spec" so the paste signals purpose. Low priority.                                                                |
| **Scaffolding as late standalone tree without contracts**               | `prd.ts:178-190` | Not cut entirely — **move earlier** into interface contract; slim duplicate.                                                                                             |

### Do not cut

- Enforced Cloudflare / Web Crypto / no Node globals (must remain **visible** in the paste even if also in CLAUDE.md — agents often start from PRD alone).
- Required pages + SEO + viewports.
- Threshold and fail-closed posture.
- Auth feature branch when `hasAuth` is true.

---

## Implementation notes for a later commission (not this task)

1. **Keep `generatePrd` deterministic** — same answers → same document (`prd.ts:75-79`).
2. **Update `prd.test.ts`** — section name assertions (`prd.test.ts:42-54`) will break when headings change; add tests for frontmatter parse, GIVEN/WHEN/THEN presence, and gate command string.
3. **Optional:** emit both `markdown` and a structured `spec` object matching/extending `PrdSchema` so app-builder save API and orchestrator share one shape.
4. **DDL defaults:** for each entity name `E`, reasonable v1 columns: `id TEXT PK`, `created_at TEXT NOT NULL`, optional `user_id` if auth, `title TEXT`, `description TEXT` — still better than "fields specific to". Document the default so agents do not invent columns ad hoc.
5. **Wizard fields already available:** `prompt`, `appType`, `hasAuth`, `entities` (`job.ts:2-11`). No new wizard questions required for v1 of this structure.
6. **Primitives doc alignment:** task breakdown + worktree isolation (`docs/claude-primitives-integration.md`) work better when the PRD already lists non-overlapping file sets per task (feeds `lg-collision-serialize`).

---

## Verdict for the current generator

The current PRD is a **human-readable checklist with a useful stack wall and a paste prompt**. Against agentic best practices it is weak on **ordered tasks**, **interface contracts**, **scenario acceptance criteria**, **exact verification commands**, and **non-goals**, and it still ships **placeholders** in the data model. The highest ROI path is: frontmatter + non-goals + gates section + build-prompt rewrite (cheap), then task breakdown + DDL/signatures + GIVEN/WHEN/THEN (medium cost, high impact).

---

_Generated as analysis only. No code in `app-builder/src/lib/prd.ts` was modified._
