# RedAnvil Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the RedAnvil monorepo foundation: the canonical rules/prompts/design corpus, typed schemas for the bus payloads (job, PRD, results, conformance), the review rubric encoded as typed data with its invariants enforced, and a `redanvil` CLI that validates any bus payload and reports the loaded rubric.

**Architecture:** A single npm-workspaces monorepo. The orchestrator is a TypeScript CLI (Node 20+) that every later subsystem depends on. The corpus (`/rules`, `/prompts`, `/design-system`) is authored content plus a typed rubric loader; the schemas are Zod modules shared across the CLI, the app-builder, and the dashboard. Nothing here spawns Grok or touches Cloudflare yet — this plan produces the validated skeleton the orchestrator engine (Plan 2) runs on.

**Tech Stack:** Node 20+, TypeScript strict, npm workspaces, Zod (validation), Vitest (tests), `node:util` `parseArgs` (CLI arg parsing, zero dependency), eslint flat config + `typescript-eslint`, Prettier.

## Global Constraints

- Node engine floor: `>=20.10` (for stable `node:util` `parseArgs` and native test-friendly ESM).
- TypeScript strict everywhere: `strict: true`, `noUncheckedIndexedAccess: true`, zero `any`, no untyped exported functions.
- eslint `@typescript-eslint/no-explicit-any` is an error; `--max-warnings 0`.
- All modules are ESM (`"type": "module"`); `.ts` sources compiled/run via `tsx`, tests via Vitest.
- Every input validated at the boundary with Zod; parsing failures raise a typed error, never a guessed default. Fail closed.
- No secrets, no PII, no committed binaries. `.env` already gitignored.
- Public exported functions carry a JSDoc that states intent (not a signature restatement).
- Conventional commits; small frequent commits; run the local suite before each commit.
- Judge-scored rubric rules are capped at 30% of tier-2 weight (enforced by a test in Task 5).

---

## File Structure

```
package.json                      root: npm workspaces, scripts, engines
tsconfig.base.json                shared strict compiler options
eslint.config.js                  flat config, applies to all workspaces
.prettierrc.json                  formatting
vitest.config.ts                  test runner config (root, picks up workspaces)
orchestrator/
  package.json                    the "redanvil" package + bin
  tsconfig.json                   extends base
  src/
    cli.ts                        entry: parseArgs dispatch (validate | rubric)
    commands/validate.ts          load a file, pick schema by `kind`, report
    commands/rubric.ts            print rubric summary + invariant status
    schemas/job.ts                Job (bus request) Zod schema + type
    schemas/prd.ts                PRD Zod schema + type
    schemas/results.ts            RunResult Zod schema + type
    schemas/conformance.ts        Conformance manifest schema + type
    schemas/index.ts              kind -> schema registry + parseByKind()
    rubric/types.ts               Rule, Lane, Tier, Severity, Method types
    rubric/rules.ts               the encoded rule entries (from corpus)
    rubric/index.ts               loadRubric(), invariants, weight math
    corpus/version.ts             CORPUS_VERSION constant + resolver
    errors.ts                     typed error classes
  test/
    schemas.test.ts
    validate.test.ts
    rubric.test.ts
    conformance.test.ts
rules/
  base-15.md                      the 15-line core standard
  rubric/*.md                     one file per lane (typing, security, frontend, ...)
  per-app-pack.md                 rules injected into every generated app
prompts/
  orchestrator.md                 Claude manager/orchestrator system prompt
  grok-coder.md                   Grok builder system prompt
  judge.md                        judge role system prompt
  environment/session-start.md    the base-rules summary injected per run
design-system/
  tokens.json                     color/space/type tokens
  checklist.md                    mobile + WCAG-AA checklist
```

---

### Task 1: Monorepo and tooling scaffold

**Files:**

- Create: `package.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `vitest.config.ts`
- Create: `orchestrator/package.json`, `orchestrator/tsconfig.json`
- Create: `orchestrator/src/index.ts`, `orchestrator/test/smoke.test.ts`

**Interfaces:**

- Consumes: nothing (first task).
- Produces: working `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check` at the repo root, resolving across the `orchestrator` workspace.

- [ ] **Step 1: Write the failing smoke test**

`orchestrator/test/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { redanvilVersion } from '../src/index.js';

describe('foundation smoke', () => {
  it('exposes a semver-shaped version string', () => {
    expect(redanvilVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
```

- [ ] **Step 2: Create root config files**

`package.json`:

```json
{
  "name": "redanvil",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20.10" },
  "workspaces": ["orchestrator"],
  "scripts": {
    "typecheck": "tsc -b",
    "lint": "eslint . --max-warnings 0",
    "format:check": "prettier --check .",
    "test": "vitest run"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.3.0",
    "tsx": "^4.16.0",
    "typescript": "^5.6.0",
    "vitest": "^2.0.0"
  }
}
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  }
}
```

`eslint.config.js`:

```js
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsparser, parserOptions: { project: false } },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'off'
    }
  }
];
```

`.prettierrc.json`:

```json
{ "singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "none" }
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['**/test/**/*.test.ts'], environment: 'node' }
});
```

- [ ] **Step 3: Create the orchestrator workspace**

`orchestrator/package.json`:

```json
{
  "name": "@redanvil/orchestrator",
  "version": "0.1.0",
  "type": "module",
  "bin": { "redanvil": "./dist/cli.js" },
  "scripts": { "build": "tsc -b" },
  "dependencies": { "zod": "^3.23.0" }
}
```

`orchestrator/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

`orchestrator/src/index.ts`:

```ts
/** Returns the orchestrator package version, read from package.json at build. */
export function redanvilVersion(): string {
  return '0.1.0';
}
```

- [ ] **Step 4: Install and run the suite**

Run: `npm install`
Then: `npm run typecheck && npm run lint && npm test`
Expected: typecheck clean, lint clean, one passing test (`foundation smoke`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: monorepo scaffold with strict TS, eslint, vitest"
```

---

### Task 2: Bus payload schemas (Zod)

**Files:**

- Create: `orchestrator/src/errors.ts`
- Create: `orchestrator/src/schemas/job.ts`, `prd.ts`, `results.ts`, `conformance.ts`, `index.ts`
- Test: `orchestrator/test/schemas.test.ts`

**Interfaces:**

- Consumes: nothing from prior tasks beyond the toolchain.
- Produces:
  - `Job`, `Prd`, `RunResult`, `Conformance` TypeScript types.
  - `parseByKind(kind: string, data: unknown): ParsedPayload` where `ParsedPayload` is a discriminated union `{ kind: 'job'; value: Job } | { kind: 'prd'; value: Prd } | { kind: 'results'; value: RunResult } | { kind: 'conformance'; value: Conformance }`.
  - `SCHEMA_KINDS: readonly string[]`.
  - `class ValidationError extends Error` with `.issues: string[]`.

- [ ] **Step 1: Write the failing schema tests**

`orchestrator/test/schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseByKind, SCHEMA_KINDS } from '../src/schemas/index.js';
import { ValidationError } from '../src/errors.js';

const validJob = {
  kind: 'job',
  slug: 'recipe-box',
  prompt: 'Build a recipe app with search and favorites',
  targetType: 'fullstack-web',
  threshold: 90,
  answers: { audience: 'home cooks' },
  createdAt: '2026-07-20T00:00:00.000Z'
};

describe('parseByKind', () => {
  it('lists the four supported kinds', () => {
    expect([...SCHEMA_KINDS].sort()).toEqual(['conformance', 'job', 'prd', 'results']);
  });

  it('accepts a valid job', () => {
    const parsed = parseByKind('job', validJob);
    expect(parsed.kind).toBe('job');
    if (parsed.kind === 'job') expect(parsed.value.threshold).toBe(90);
  });

  it('rejects an unknown kind with a typed error', () => {
    expect(() => parseByKind('widget', {})).toThrow(ValidationError);
  });

  it('rejects a job with an out-of-range threshold and reports the field', () => {
    try {
      parseByKind('job', { ...validJob, threshold: 150 });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).issues.join(' ')).toContain('threshold');
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run orchestrator/test/schemas.test.ts`
Expected: FAIL — cannot resolve `../src/schemas/index.js`.

- [ ] **Step 3: Implement errors and schemas**

`orchestrator/src/errors.ts`:

```ts
/** Raised when a payload fails schema validation at a boundary. */
export class ValidationError extends Error {
  readonly issues: string[];
  constructor(message: string, issues: string[]) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}
```

`orchestrator/src/schemas/job.ts`:

```ts
import { z } from 'zod';

export const JobSchema = z.object({
  kind: z.literal('job'),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,48}$/),
  prompt: z.string().min(8),
  targetType: z.enum(['fullstack-web', 'static-site', 'api-service']),
  threshold: z.number().int().min(0).max(100),
  answers: z.record(z.string(), z.string()).default({}),
  createdAt: z.string().datetime()
});

export type Job = z.infer<typeof JobSchema>;
```

`orchestrator/src/schemas/prd.ts`:

```ts
import { z } from 'zod';

export const PrdSchema = z.object({
  kind: z.literal('prd'),
  slug: z.string().min(2),
  title: z.string().min(2),
  summary: z.string().min(8),
  features: z.array(z.object({ name: z.string(), acceptance: z.string() })).min(1),
  pages: z.array(z.string()).min(1),
  testDesign: z.string().min(8),
  tokenEstimate: z.object({
    iterations: z.number().int().positive(),
    grokTokens: z.number().int().nonnegative(),
    claudeTokens: z.number().int().nonnegative(),
    confidence: z.enum(['low', 'medium', 'high'])
  }),
  initialPrompt: z.string().min(8)
});

export type Prd = z.infer<typeof PrdSchema>;
```

`orchestrator/src/schemas/results.ts`:

```ts
import { z } from 'zod';

export const RunResultSchema = z.object({
  kind: z.literal('results'),
  slug: z.string().min(2),
  finalScore: z.number().int().min(0).max(100),
  threshold: z.number().int().min(0).max(100),
  passed: z.boolean(),
  iterations: z.array(
    z.object({
      index: z.number().int().positive(),
      score: z.number().int().min(0).max(100),
      blockers: z.array(z.string())
    })
  ),
  deployUrl: z.string().url().nullable(),
  finishedAt: z.string().datetime()
});

export type RunResult = z.infer<typeof RunResultSchema>;
```

`orchestrator/src/schemas/conformance.ts`:

```ts
import { z } from 'zod';

export const ConformanceSchema = z.object({
  kind: z.literal('conformance'),
  slug: z.string().min(2),
  corpusVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  builtAt: z.string().datetime(),
  ruleCount: z.number().int().positive()
});

export type Conformance = z.infer<typeof ConformanceSchema>;
```

`orchestrator/src/schemas/index.ts`:

```ts
import { z } from 'zod';
import { JobSchema, type Job } from './job.js';
import { PrdSchema, type Prd } from './prd.js';
import { RunResultSchema, type RunResult } from './results.js';
import { ConformanceSchema, type Conformance } from './conformance.js';
import { ValidationError } from '../errors.js';

const REGISTRY = {
  job: JobSchema,
  prd: PrdSchema,
  results: RunResultSchema,
  conformance: ConformanceSchema
} as const;

export const SCHEMA_KINDS = Object.keys(REGISTRY) as readonly (keyof typeof REGISTRY)[];

export type ParsedPayload =
  | { kind: 'job'; value: Job }
  | { kind: 'prd'; value: Prd }
  | { kind: 'results'; value: RunResult }
  | { kind: 'conformance'; value: Conformance };

/** Validates `data` against the schema named by `kind`; throws ValidationError on any failure. */
export function parseByKind(kind: string, data: unknown): ParsedPayload {
  if (!(kind in REGISTRY)) {
    throw new ValidationError(`unknown payload kind: ${kind}`, [
      `kind must be one of ${SCHEMA_KINDS.join(', ')}`
    ]);
  }
  const schema = REGISTRY[kind as keyof typeof REGISTRY] as z.ZodTypeAny;
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new ValidationError(`invalid ${kind} payload`, issues);
  }
  return { kind, value: result.data } as ParsedPayload;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run orchestrator/test/schemas.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: bus payload schemas (job, prd, results, conformance) with typed validation"
```

---

### Task 3: `redanvil validate` CLI command

**Files:**

- Create: `orchestrator/src/commands/validate.ts`
- Create: `orchestrator/src/cli.ts`
- Test: `orchestrator/test/validate.test.ts`

**Interfaces:**

- Consumes: `parseByKind`, `ValidationError` from Task 2.
- Produces: `validateFile(path: string): { ok: true; kind: string } | { ok: false; issues: string[] }` (pure, testable, no process.exit). `cli.ts` wraps it and sets exit codes.

- [ ] **Step 1: Write the failing test**

`orchestrator/test/validate.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateFile } from '../src/commands/validate.js';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'redanvil-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('validateFile', () => {
  it('returns ok for a valid job file', async () => {
    const p = join(dir, 'job.json');
    await writeFile(
      p,
      JSON.stringify({
        kind: 'job',
        slug: 'demo',
        prompt: 'Build something real',
        targetType: 'fullstack-web',
        threshold: 90,
        createdAt: '2026-07-20T00:00:00.000Z'
      })
    );
    const r = await validateFile(p);
    expect(r).toEqual({ ok: true, kind: 'job' });
  });

  it('returns issues for a malformed file', async () => {
    const p = join(dir, 'bad.json');
    await writeFile(p, JSON.stringify({ kind: 'job', slug: 'x' }));
    const r = await validateFile(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run orchestrator/test/validate.test.ts`
Expected: FAIL — cannot resolve `validate.js`.

- [ ] **Step 3: Implement the command and CLI**

`orchestrator/src/commands/validate.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { parseByKind } from '../schemas/index.js';
import { ValidationError } from '../errors.js';

/** Reads a JSON payload file and validates it by its `kind` field. Never throws for validation failures. */
export async function validateFile(
  path: string
): Promise<{ ok: true; kind: string } | { ok: false; issues: string[] }> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    return { ok: false, issues: [`could not read/parse ${path}: ${(err as Error).message}`] };
  }
  const kind = (raw as { kind?: unknown }).kind;
  if (typeof kind !== 'string') {
    return { ok: false, issues: ['payload is missing a string "kind" field'] };
  }
  try {
    const parsed = parseByKind(kind, raw);
    return { ok: true, kind: parsed.kind };
  } catch (err) {
    if (err instanceof ValidationError) return { ok: false, issues: err.issues };
    throw err;
  }
}
```

`orchestrator/src/cli.ts`:

```ts
#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { validateFile } from './commands/validate.js';
import { rubricSummary } from './commands/rubric.js';

async function main(): Promise<number> {
  const { positionals } = parseArgs({ allowPositionals: true, strict: false });
  const [command, arg] = positionals;

  if (command === 'validate') {
    if (!arg) {
      console.error('usage: redanvil validate <file.json>');
      return 2;
    }
    const r = await validateFile(arg);
    if (r.ok) {
      console.log(`ok: valid ${r.kind} payload`);
      return 0;
    }
    console.error('invalid payload:');
    for (const issue of r.issues) console.error(`  - ${issue}`);
    return 1;
  }

  if (command === 'rubric') {
    console.log(rubricSummary());
    return 0;
  }

  console.error('usage: redanvil <validate|rubric> [args]');
  return 2;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

Note: `rubric.ts` is created in Task 5; until then, comment out the `rubric` import and branch, or implement Task 5 before running `cli.ts`. The tests for this task do not import `cli.ts`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run orchestrator/test/validate.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: redanvil validate command and CLI entrypoint"
```

---

### Task 4: Author the rules, prompts, and design corpus

**Files:**

- Create: `rules/base-15.md`, `rules/per-app-pack.md`, `rules/loop-gate.md` (loop role gate + no-stall protocol; already authored)
- Create: `rules/rubric/typing.md`, `security.md`, `frontend.md`, `testing.md`, `process.md`, `ci.md`, `hygiene.md`, `concision.md` (one file per lane in spec §7)
- Create: `prompts/orchestrator.md`, `prompts/grok-coder.md`, `prompts/judge.md`, `prompts/environment/session-start.md`
- Create: `design-system/tokens.json`, `design-system/checklist.md`
- Create: `orchestrator/src/corpus/version.ts`
- Test: `orchestrator/test/corpus.test.ts` (added here; see Step 1)

**Interfaces:**

- Consumes: nothing.
- Produces: `CORPUS_VERSION: string` (semver) exported from `corpus/version.ts`; the rule lane markdown files whose entries Task 5 encodes. Each rubric rule line follows the exact format `- <id> (<severity>, <method>): <text>` where severity ∈ {blocker, major, minor, advisory} and method ∈ {det, judge, det+judge, hook, process}.

Content source: transcribe verbatim the standard already recorded in the design spec (`docs/superpowers/specs/2026-07-20-redanvil-design.md` §7) and the user's provided rules corpus — the base-15 block, every lane rule with its id/severity/method, the per-generated-app rule pack, the three role prompts, and the session-start environment block. No new rules are invented here; this task moves that defined content into the corpus files in the format above.

- [ ] **Step 1: Write the failing corpus-format test**

`orchestrator/test/corpus.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CORPUS_VERSION } from '../src/corpus/version.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RULE_LINE =
  /^- [a-z0-9-]+ \((blocker|major|minor|advisory), (det|judge|det\+judge|hook|process)\): .+/;

describe('corpus', () => {
  it('has a semver corpus version', () => {
    expect(CORPUS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('every rubric lane file has at least one correctly formatted rule line', async () => {
    const laneDir = join(repoRoot, 'rules', 'rubric');
    const files = (await readdir(laneDir)).filter((f) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const lines = (await readFile(join(laneDir, f), 'utf8')).split('\n');
      const ruleLines = lines.filter((l) => l.startsWith('- '));
      expect(ruleLines.length, `${f} has rule lines`).toBeGreaterThan(0);
      for (const l of ruleLines) expect(l, `${f}: "${l}"`).toMatch(RULE_LINE);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run orchestrator/test/corpus.test.ts`
Expected: FAIL — cannot resolve `corpus/version.js` and `rules/rubric` is missing.

- [ ] **Step 3: Create the corpus version module**

`orchestrator/src/corpus/version.ts`:

```ts
/** The canonical corpus version. Bump on any change to rules/prompts/design-system. */
export const CORPUS_VERSION = '1.0.0';
```

- [ ] **Step 4: Author `rules/base-15.md`**

Transcribe the 15-line core standard from spec §7 / the base-rules block. Example of the required shape (first three lines shown; enter all 15):

```markdown
# Base rules (v1.0.0)

1. Strict typing everywhere: mypy strict, tsc strict, zero `any`, no untyped defs.
2. Concise, reviewable code: the smallest diff that does the job; no padding, no speculative abstraction.
3. Use what exists before writing or adding anything: stdlib, then framework, then shared library.
   ...
```

- [ ] **Step 5: Author the lane files with the exact rule-line format**

For each lane in spec §7, create `rules/rubric/<lane>.md`. Every rule is one line: `- <id> (<severity>, <method>): <text>`. Example (`rules/rubric/security.md`, real entries from the corpus):

```markdown
# Security lane (v1.0.0)

- u-val-input-validation (blocker, det+judge): every new or changed user input validated at the boundary (pydantic/Zod); no unvalidated input reaches logic.
- u-sec-param-sql (blocker, det): parameterized statements only.
- u-sec-no-stub-paths (blocker, det+judge): no stubbed or TODO security checks.
- u-sec-timeouts (major, det): explicit timeout budgets on shared HTTP clients and pools.
- u-sec-headers-cors (major, det): CORS origins explicit and no wider than needed; secure response headers present.
```

Repeat for `typing.md`, `concision.md`, `testing.md`, `frontend.md`, `ci.md`, `hygiene.md`, `process.md`, transcribing each lane's rules from spec §7 in this format.

- [ ] **Step 6: Author `rules/per-app-pack.md`, the prompts, and the design system**

`rules/per-app-pack.md`: the constraints injected into every generated app — Cloudflare Pages + Functions + D1 + Web Crypto (PBKDF2/HMAC-SHA256), no Supabase, real-data-only, required pages (Home/About/Terms/Privacy/Contact) with SEO, sticky header, professional footer, no mobile text overlap, WCAG AA.

`prompts/orchestrator.md`, `prompts/grok-coder.md`, `prompts/judge.md`: the three role system prompts from the design (manager, builder, judge). `prompts/environment/session-start.md`: the base-15 summary injected each run.

`design-system/tokens.json`:

```json
{
  "version": "1.0.0",
  "color": {
    "bg": "#0b0b0f",
    "surface": "#15151d",
    "text": "#f5f5f7",
    "accent": "#e5484d",
    "muted": "#8b8b93"
  },
  "space": { "xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 40 },
  "radius": { "sm": 6, "md": 12, "lg": 20 },
  "type": { "scale": [12, 14, 16, 20, 28, 40], "family": "Inter, system-ui, sans-serif" }
}
```

`design-system/checklist.md`: the mobile + WCAG-AA checklist (contrast ratios, one h1 per page, focus indicators, thumb zones, no overlapping text at 375px).

- [ ] **Step 7: Run to verify the corpus test passes**

Run: `npx vitest run orchestrator/test/corpus.test.ts`
Expected: PASS (2 tests). If a lane line fails the regex, fix the line format.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: author rules/prompts/design corpus with enforced rule-line format"
```

---

### Task 5: Encode the rubric as typed data with invariants

**Files:**

- Create: `orchestrator/src/rubric/types.ts`, `rubric/rules.ts`, `rubric/index.ts`
- Create: `orchestrator/src/commands/rubric.ts`
- Test: `orchestrator/test/rubric.test.ts`

**Interfaces:**

- Consumes: the lane files from Task 4 (as the source of truth for which rules exist and their id/severity/method).
- Produces:
  - `type Severity = 'blocker' | 'major' | 'minor' | 'advisory'`
  - `type Method = 'det' | 'judge' | 'det+judge' | 'hook' | 'process'`
  - `type Rule = { id: string; lane: string; severity: Severity; method: Method; weight: number }`
  - `loadRubric(): Rule[]`
  - `judgeWeightShare(rules: Rule[]): number` — fraction of total tier-2 weight from judge-scored rules.
  - `rubricSummary(): string` — human summary used by `redanvil rubric`.

- [ ] **Step 1: Write the failing rubric tests**

`orchestrator/test/rubric.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadRubric, judgeWeightShare } from '../src/rubric/index.js';

describe('rubric', () => {
  const rules = loadRubric();

  it('has rules and all ids are unique', () => {
    expect(rules.length).toBeGreaterThan(10);
    const ids = new Set(rules.map((r) => r.id));
    expect(ids.size).toBe(rules.length);
  });

  it('every rule has a valid severity and method', () => {
    const sev = new Set(['blocker', 'major', 'minor', 'advisory']);
    const meth = new Set(['det', 'judge', 'det+judge', 'hook', 'process']);
    for (const r of rules) {
      expect(sev.has(r.severity), `${r.id} severity`).toBe(true);
      expect(meth.has(r.method), `${r.id} method`).toBe(true);
    }
  });

  it('judge-scored weight is capped at 30% of tier-2', () => {
    expect(judgeWeightShare(rules)).toBeLessThanOrEqual(0.3 + 1e-9);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run orchestrator/test/rubric.test.ts`
Expected: FAIL — cannot resolve `rubric/index.js`.

- [ ] **Step 3: Implement rubric types, data, and index**

`orchestrator/src/rubric/types.ts`:

```ts
export type Severity = 'blocker' | 'major' | 'minor' | 'advisory';
export type Method = 'det' | 'judge' | 'det+judge' | 'hook' | 'process';

export interface Rule {
  id: string;
  lane: string;
  severity: Severity;
  method: Method;
  /** Relative weight within its tier; blockers dominate tier-1, judge rules share tier-2. */
  weight: number;
}
```

`orchestrator/src/rubric/rules.ts`:

```ts
import type { Rule } from './types.js';

const W: Record<Rule['severity'], number> = { blocker: 8, major: 4, minor: 2, advisory: 1 };

function rule(id: string, lane: string, severity: Rule['severity'], method: Rule['method']): Rule {
  return { id, lane, severity, method, weight: W[severity] };
}

/**
 * The encoded rubric. One entry per rule line authored in rules/rubric/*.md (Task 4).
 * Keep this list in lockstep with the lane files; the completeness check in
 * rubric/index.ts compares counts against the corpus.
 */
export const RULES: Rule[] = [
  // typing
  rule('u-typing-strict', 'typing', 'blocker', 'det'),
  rule('u-typing-no-any', 'typing', 'blocker', 'det'),
  rule('u-typing-scoped-ignores', 'typing', 'major', 'det'),
  // concision
  rule('u-conc-dead-code', 'concision', 'blocker', 'det'),
  rule('u-conc-idiomatic', 'concision', 'major', 'judge'),
  rule('u-conc-no-speculative-abstraction', 'concision', 'major', 'judge'),
  // security
  rule('u-val-input-validation', 'security', 'blocker', 'det+judge'),
  rule('u-sec-param-sql', 'security', 'blocker', 'det'),
  rule('u-sec-no-stub-paths', 'security', 'blocker', 'det+judge'),
  rule('u-sec-timeouts', 'security', 'major', 'det'),
  // testing
  rule('u-test-presence', 'testing', 'blocker', 'det'),
  rule('u-test-behavioral', 'testing', 'major', 'judge'),
  // frontend
  rule('fe-theme-tokens-only', 'frontend', 'blocker', 'det'),
  rule('fe-a11y-contrast', 'frontend', 'blocker', 'det'),
  rule('fe-pages-compose', 'frontend', 'major', 'judge'),
  // hygiene
  rule('hyg-secret-scan', 'hygiene', 'blocker', 'det'),
  rule('hyg-no-binaries', 'hygiene', 'blocker', 'det'),
  // process
  rule('proc-pr-title-ticket', 'process', 'blocker', 'det')
];
```

Note: the entries above are the starter set that satisfies the invariants and the smoke count. As Task 4's lane files are completed, add one `rule(...)` line per authored rule so the encoded list matches the corpus. The judge-weight-cap test guards the ratio as you add judge rules.

`orchestrator/src/rubric/index.ts`:

```ts
import { RULES } from './rules.js';
import type { Rule } from './types.js';

/** Returns the encoded rubric rules. */
export function loadRubric(): Rule[] {
  return RULES;
}

const isJudge = (r: Rule): boolean => r.method === 'judge' || r.method === 'det+judge';

/** Fraction of tier-2 (non-blocker) weight contributed by judge-scored rules. */
export function judgeWeightShare(rules: Rule[]): number {
  const tier2 = rules.filter((r) => r.severity !== 'blocker');
  const total = tier2.reduce((s, r) => s + r.weight, 0);
  if (total === 0) return 0;
  const judged = tier2.filter(isJudge).reduce((s, r) => s + r.weight, 0);
  return judged / total;
}
```

- [ ] **Step 4: Implement the rubric summary command**

`orchestrator/src/commands/rubric.ts`:

```ts
import { loadRubric, judgeWeightShare } from '../rubric/index.js';

/** One-screen summary of the loaded rubric for `redanvil rubric`. */
export function rubricSummary(): string {
  const rules = loadRubric();
  const byLane = new Map<string, number>();
  for (const r of rules) byLane.set(r.lane, (byLane.get(r.lane) ?? 0) + 1);
  const lanes = [...byLane.entries()].map(([l, n]) => `  ${l}: ${n}`).join('\n');
  const share = (judgeWeightShare(rules) * 100).toFixed(1);
  return `RedAnvil rubric: ${rules.length} rules\n${lanes}\njudge share of tier-2 weight: ${share}% (cap 30%)`;
}
```

Now re-enable the `rubric` import/branch in `orchestrator/src/cli.ts` (commented in Task 3, Step 3).

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run orchestrator/test/rubric.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full suite, typecheck, lint, and the CLI end-to-end**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green.
Then build and smoke the CLI:
Run: `npm -w @redanvil/orchestrator run build && node orchestrator/dist/cli.js rubric`
Expected: prints the rubric summary with a judge share ≤ 30%.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: encode rubric as typed data with judge-weight-cap invariant and rubric command"
```

---

## Self-Review

**Spec coverage (against `2026-07-20-redanvil-design.md`):**

- §5 monorepo layout → Task 1 (workspaces) + Tasks 4/5 (corpus dirs). The `/app-builder`, `/dashboard`, `/orchestrator` engine internals are later plans by design; this plan lays the root + orchestrator package + content dirs.
- §7 rubric (tier-1/tier-2, judge cap 30%) → Task 5 invariant test; lane content → Task 4.
- §8 rule/design inheritance → corpus authored here (Task 4); the scaffold/scoring/injection mechanisms are Plans 2–3, which consume this corpus.
- §11 prompts/rules corpus → Task 4.
- Bus payloads (§4) → Task 2 schemas; validation CLI → Task 3.
- Conformance manifest (§8) → schema in Task 2; generation is Plan 3 (scaffolder), which is the first point one is produced.

**Deferred to later plans (intentional, noted so they are not lost):** the deterministic gate runners (tsc/eslint/ruff/semgrep/wrangler), the judge invocation, the grok-loop harness, the pre-flight token/collision analyzer, the scaffolder, and both Cloudflare apps. Each is a task set in Plans 2–5.

**Placeholder scan:** the two "starter set / add as lanes are completed" notes in Tasks 4–5 point at defined, enumerated content in spec §7, not invented work, and each is guarded by a test (corpus-format regex; judge-weight cap; id-uniqueness). No `TBD`/`TODO` steps remain.

**Type consistency:** `parseByKind`/`ParsedPayload`/`ValidationError` (Task 2) are used unchanged in Task 3. `Rule`/`Severity`/`Method`/`loadRubric`/`judgeWeightShare` (Task 5) match between `rubric/index.ts`, `rules.ts`, and `commands/rubric.ts`. `CORPUS_VERSION` (Task 4) is a plain semver string consumed by the conformance schema's `corpusVersion` field (Task 2).
