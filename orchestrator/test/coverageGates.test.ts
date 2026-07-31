import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { scaffoldApp } from '../src/scaffold/scaffoldApp';
import { parseByKind } from '../src/schemas/index';
import { loadRubric } from '../src/rubric/index';
import { APP_CHECKS, gateApp } from '../src/commands/gate';
import { quoteForCmd } from '../src/process/run';
import { parseFindings, buildJudgePrompt, findClaimFiles } from '../src/commands/apiJudge';
import {
  evaluateResponse,
  primaryCollection,
  hasSuccessExample,
  withQuery
} from '../scripts/checks/u-api-real-output.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const corpusDir = join(repoRoot, 'rules');
const CHECK_SCRIPT = join(repoRoot, 'orchestrator', 'scripts', 'checks', 'check.mjs');

const parsed = parseByKind('job', {
  kind: 'job',
  slug: 'coverage-demo',
  prompt: 'Build a demo app with search',
  targetType: 'fullstack-web',
  threshold: 90,
  answers: {},
  createdAt: '2026-07-29T00:00:00.000Z'
});
if (parsed.kind !== 'job') throw new Error('job fixture invalid');
const job = parsed.value;

/**
 * Run the deterministic checker for one rule against a directory.
 *
 * @param ruleId Rubric rule to decide.
 * @param dir App directory.
 * @returns Exit status and combined output.
 */
function runCheck(ruleId: string, dir: string): { status: number; output: string } {
  const result = spawnSync('node', [CHECK_SCRIPT, ruleId, dir], { encoding: 'utf8' });
  return { status: result.status ?? -1, output: `${result.stdout}${result.stderr}` };
}

/**
 * Run a git command in a directory, ignoring failure.
 *
 * @param dir Working directory.
 * @param args Git arguments.
 */
function git(dir: string, args: string[]): void {
  spawnSync('git', ['-C', dir, ...args], { stdio: 'ignore' });
}

/**
 * Commit everything currently in a directory.
 *
 * @param dir Repository directory.
 * @param message Commit message.
 */
function commitAll(dir: string, message: string): void {
  git(dir, ['add', '-A']);
  git(dir, ['-c', 'user.email=t@t.t', '-c', 'user.name=t', 'commit', '-q', '-m', message]);
}

/**
 * Write a coverage summary in the shape vitest's json-summary reporter emits.
 *
 * Keyed by ABSOLUTE path plus a `total` entry, which is what the real reporter
 * produces and what the checks have to relativise.
 *
 * @param dir App directory.
 * @param files Repo-relative path to line percentage.
 * @param totalPct Overall line percentage.
 */
async function writeSummary(
  dir: string,
  files: Record<string, number>,
  totalPct: number
): Promise<void> {
  const summary: Record<string, unknown> = { total: { lines: { pct: totalPct } } };
  for (const [rel, pct] of Object.entries(files)) {
    summary[join(dir, rel)] = { lines: { pct } };
  }
  await mkdir(join(dir, 'coverage'), { recursive: true });
  await writeFile(join(dir, 'coverage', 'coverage-summary.json'), JSON.stringify(summary));
}

/**
 * Replace `test:coverage` with a command that succeeds without doing anything.
 *
 * These cases are about the join between the diff and the coverage summary, and
 * the summary is written directly above. Running the real vitest would mean
 * `npm install` into a throwaway scaffold for every case — minutes each, to
 * re-measure something already fixed by the fixture. What must NOT be stubbed
 * is the failure path: a red coverage run is asserted separately against the
 * real command, because "the suite is broken so the number is unknown" is a
 * distinct outcome from "the number says zero".
 *
 * @param dir App directory.
 */
async function stubCoverageRun(dir: string): Promise<void> {
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  pkg.scripts['test:coverage'] = 'node -e ""';
  await writeFile(join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
}

describe('the scaffold produces an app these gates can measure', () => {
  let out: string;
  beforeAll(async () => {
    out = await mkdtemp(join(tmpdir(), 'redanvil-cov-'));
    await scaffoldApp({ job, outDir: out, corpusDir, builtAt: '2026-07-29T00:00:00.000Z' });
  });
  afterAll(async () => {
    await rm(out, { recursive: true, force: true });
  });

  it('counts both new rules as failed blockers when nothing records an outcome', async () => {
    // The whole mechanism, end to end. A rule that is merely declared must not
    // pass by default; that is how a requirement ends up enforcing nothing while
    // still inflating the rubric count.
    const report = await gateApp(out, []);
    expect(report.blockersFailed).toContain('u-api-real-output');
    expect(report.score).toBe(0);
  });

  it('reports the ratchet as unevaluated rather than passed when nothing ran', async () => {
    const report = await gateApp(out, []);
    const recorded = report.outcomes.find((o) => o.ruleId === 'u-test-coverage-ratchet');
    expect(recorded, 'a rule nothing ran must not have an outcome').toBeUndefined();
  });
});

describe('u-test-presence reads the diff, not just the suite', () => {
  let base: string;
  beforeAll(async () => {
    base = await mkdtemp(join(tmpdir(), 'redanvil-presence-'));
    await scaffoldApp({ job, outDir: base, corpusDir, builtAt: '2026-07-29T00:00:00.000Z' });
  });
  afterAll(async () => {
    await rm(base, { recursive: true, force: true });
  });

  /**
   * Copy the green scaffold, break one thing, and return the broken copy.
   *
   * @param mutate Applied to the copy before the check runs.
   * @returns Path to the mutated app.
   */
  async function broken(mutate: (dir: string) => Promise<void>): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'redanvil-presence-red-'));
    await cp(base, dir, { recursive: true });
    await mutate(dir);
    return dir;
  }

  // Every one of these passed before this rule read the diff. The rule text has
  // promised "changed source files have tests" the whole time while both
  // wirings ran `vitest run`, so each hole gets its own red case.

  it('FAILS a generated app whose coverage provider was removed', async () => {
    const dir = await broken(async (d) => {
      const pkg = JSON.parse(await readFile(join(d, 'package.json'), 'utf8'));
      delete pkg.devDependencies['@vitest/coverage-v8'];
      await writeFile(join(d, 'package.json'), JSON.stringify(pkg, null, 2));
    });
    const { status, output } = runCheck('u-test-presence', dir);
    expect(status, output).toBe(1);
    expect(output).toContain('coverage provider');
    await rm(dir, { recursive: true, force: true });
  });

  it('FAILS a generated app whose test:coverage script was removed', async () => {
    const dir = await broken(async (d) => {
      const pkg = JSON.parse(await readFile(join(d, 'package.json'), 'utf8'));
      delete pkg.scripts['test:coverage'];
      await writeFile(join(d, 'package.json'), JSON.stringify(pkg, null, 2));
    });
    const { status, output } = runCheck('u-test-presence', dir);
    expect(status, output).toBe(1);
    expect(output).toContain('test:coverage');
    await rm(dir, { recursive: true, force: true });
  });

  it('is NOT APPLICABLE outside a generated app, rather than inventing a failure', async () => {
    // The same missing provider. Inside a generated app RedAnvil put it there,
    // so its absence is a real defect; somewhere RedAnvil never touched, the
    // same absence is just an app built another way. Exit 3 removes the rule
    // from the denominator instead of fabricating a violation.
    const dir = await broken(async (d) => {
      await rm(join(d, 'conformance.json'));
      const pkg = JSON.parse(await readFile(join(d, 'package.json'), 'utf8'));
      delete pkg.devDependencies['@vitest/coverage-v8'];
      await writeFile(join(d, 'package.json'), JSON.stringify(pkg, null, 2));
    });
    const { status, output } = runCheck('u-test-presence', dir);
    expect(status, output).toBe(3);
    await rm(dir, { recursive: true, force: true });
  });

  it('FAILS and names a changed source file that nothing exercises', async () => {
    const dir = await broken(async (d) => {
      commitAll(d, 'baseline');
      // A new module with real logic and no test. This is the whole point of
      // the rule and the exact case `vitest run` reports as green.
      await writeFile(
        join(d, 'src', 'lib', 'pricing.ts'),
        'export function surcharge(cents: number): number {\n  return Math.round(cents * 1.15);\n}\n'
      );
      await writeSummary(d, { 'src/lib/pricing.ts': 0, 'src/lib/routes.ts': 100 }, 55);
      await stubCoverageRun(d);
    });
    const { status, output } = runCheck('u-test-presence', dir);
    expect(status, output).toBe(1);
    expect(output).toContain('src/lib/pricing.ts');
    await rm(dir, { recursive: true, force: true });
  });

  it('PASSES when the changed file is covered', async () => {
    const dir = await broken(async (d) => {
      commitAll(d, 'baseline');
      await writeFile(
        join(d, 'src', 'lib', 'pricing.ts'),
        'export function surcharge(cents: number): number {\n  return Math.round(cents * 1.15);\n}\n'
      );
      await writeSummary(d, { 'src/lib/pricing.ts': 92 }, 71);
      await stubCoverageRun(d);
    });
    const { status, output } = runCheck('u-test-presence', dir);
    expect(status, output).toBe(0);
    await rm(dir, { recursive: true, force: true });
  });

  it('does NOT flag a changed file coverage cannot see', async () => {
    // The measurement bug this guard exists for, found dogfooding against
    // QuickFlight: src/i18n/en.ts is outside coverage.include, so it is never
    // instrumented, so its percentage is absent, so `?? 0` read it as untested
    // and it was reported on every run forever. A file the measurement cannot
    // see is not a file with no tests, and a gate that cries wolf gets switched
    // off. The changed-set filter must mirror coverage.include exactly.
    const dir = await broken(async (d) => {
      commitAll(d, 'baseline');
      await mkdir(join(d, 'src', 'i18n'), { recursive: true });
      await writeFile(join(d, 'src', 'i18n', 'en.ts'), 'export const en = { hello: "hi" };\n');
      await writeFile(join(d, 'src', 'components', 'Extra.tsx'), 'export const Extra = 1;\n');
      await writeSummary(d, { 'src/lib/routes.ts': 100 }, 88);
    });
    const { status, output } = runCheck('u-test-presence', dir);
    expect(status, output).toBe(0);
    expect(output).not.toContain('en.ts');
    expect(output).not.toContain('Extra.tsx');
    await rm(dir, { recursive: true, force: true });
  });
});

describe('u-test-coverage-ratchet only moves one way', () => {
  let base: string;
  beforeAll(async () => {
    base = await mkdtemp(join(tmpdir(), 'redanvil-ratchet-'));
    await scaffoldApp({ job, outDir: base, corpusDir, builtAt: '2026-07-29T00:00:00.000Z' });
  });
  afterAll(async () => {
    await rm(base, { recursive: true, force: true });
  });

  /**
   * Copy the green scaffold and mutate it.
   *
   * @param mutate Applied to the copy.
   * @returns Path to the mutated app.
   */
  async function broken(mutate: (dir: string) => Promise<void>): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'redanvil-ratchet-red-'));
    await cp(base, dir, { recursive: true });
    await mutate(dir);
    return dir;
  }

  it('FAILS when coverage falls below the recorded high-water mark', async () => {
    const dir = await broken(async (d) => {
      await writeFile(
        join(d, '.redanvil', 'coverage-state.json'),
        JSON.stringify({ baseCommit: null, highWaterPct: 80 })
      );
      await writeSummary(d, {}, 61);
    });
    const { status, output } = runCheck('u-test-coverage-ratchet', dir);
    expect(status, output).toBe(1);
    expect(output).toContain('61');
    await rm(dir, { recursive: true, force: true });
  });

  it('FAILS when the bar itself was edited down and committed', async () => {
    // The tamper case, and the reason the state file is tracked rather than
    // ignored. Lowering the bar to go green looks exactly like an ordinary
    // edit, and a correctly-shaped state file is indistinguishable from a
    // fabricated one unless its history is read. Note the CURRENT coverage is
    // healthy against the lowered bar -- the offence is the rewrite itself.
    const dir = await broken(async (d) => {
      const state = join(d, '.redanvil', 'coverage-state.json');
      await writeFile(state, JSON.stringify({ baseCommit: null, highWaterPct: 90 }));
      commitAll(d, 'record a high bar');
      await writeFile(state, JSON.stringify({ baseCommit: null, highWaterPct: 40 }));
      commitAll(d, 'quietly lower the bar');
      await writeSummary(d, {}, 42);
    });
    const { status, output } = runCheck('u-test-coverage-ratchet', dir);
    expect(status, output).toBe(1);
    expect(output).toContain('90');
    await rm(dir, { recursive: true, force: true });
  });

  it('PASSES an ordinary increase', async () => {
    const dir = await broken(async (d) => {
      const state = join(d, '.redanvil', 'coverage-state.json');
      await writeFile(state, JSON.stringify({ baseCommit: null, highWaterPct: 50 }));
      commitAll(d, 'record');
      await writeFile(state, JSON.stringify({ baseCommit: null, highWaterPct: 70 }));
      commitAll(d, 'raise');
      await writeSummary(d, {}, 71);
    });
    const { status, output } = runCheck('u-test-coverage-ratchet', dir);
    expect(status, output).toBe(0);
    await rm(dir, { recursive: true, force: true });
  });
});

describe('u-api-real-output takes its inventory from the app', () => {
  let base: string;
  beforeAll(async () => {
    base = await mkdtemp(join(tmpdir(), 'redanvil-api-'));
    await scaffoldApp({ job, outDir: base, corpusDir, builtAt: '2026-07-29T00:00:00.000Z' });
  });
  afterAll(async () => {
    await rm(base, { recursive: true, force: true });
  });

  /**
   * Copy the green scaffold and mutate it.
   *
   * @param mutate Applied to the copy.
   * @returns Path to the mutated app.
   */
  async function broken(mutate: (dir: string) => Promise<void>): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'redanvil-api-red-'));
    await cp(base, dir, { recursive: true });
    await mutate(dir);
    return dir;
  }

  it('FAILS a route on disk that no example claims', async () => {
    const dir = await broken(async (d) => {
      // A new endpoint, added the way a builder adds one: the file appears and
      // nobody remembers the example. Untested-by-default is the whole design.
      await writeFile(
        join(d, 'functions', 'api', 'orders.ts'),
        'export function onRequest(): Response {\n  return new Response("{}");\n}\n'
      );
    });
    const { status, output } = runCheck('u-api-real-output', dir);
    expect(status, output).toBe(1);
    expect(output).toContain('/api/orders');
    await rm(dir, { recursive: true, force: true });
  });

  it('FAILS when an example claim is a promise rather than a claim', async () => {
    const dir = await broken(async (d) => {
      await writeFile(
        join(d, 'tests', 'api-examples.json'),
        JSON.stringify({ examples: [{ route: 'TODO', method: 'GET', expect: { status: 200 } }] })
      );
    });
    const { status, output } = runCheck('u-api-real-output', dir);
    expect(status, output).toBe(1);
    expect(output).toContain('/api/health');
    await rm(dir, { recursive: true, force: true });
  });

  it('FAILS a parameterised route no example can fill', async () => {
    const dir = await broken(async (d) => {
      await mkdir(join(d, 'functions', 'api', 'orders'), { recursive: true });
      await writeFile(
        join(d, 'functions', 'api', 'orders', '[id].ts'),
        'export function onRequest(): Response {\n  return new Response("{}");\n}\n'
      );
      await writeFile(
        join(d, 'tests', 'api-examples.json'),
        JSON.stringify({
          examples: [
            { route: '/api/health', method: 'GET', expect: { status: 200, nonEmpty: true } },
            { route: '/api/orders/[id]', method: 'GET', expect: { status: 200 } }
          ]
        })
      );
    });
    const { status, output } = runCheck('u-api-real-output', dir);
    expect(status, output).toBe(1);
    expect(output).toContain('id');
    await rm(dir, { recursive: true, force: true });
  });

  it('is NOT APPLICABLE for an app with no API routes', async () => {
    const dir = await broken(async (d) => {
      await rm(join(d, 'functions'), { recursive: true, force: true });
    });
    const { status, output } = runCheck('u-api-real-output', dir);
    expect(status, output).toBe(3);
    await rm(dir, { recursive: true, force: true });
  });
});

describe('evasions an adversarial pass found, each now closed', () => {
  // A second model was asked to name ways an app could be broken and still pass.
  // These are the findings that survived checking them against the code. Each
  // one is here because it really worked before the fix.

  it('a 5xx expectation cannot license a permanently broken route', () => {
    // `expect.status` is written by whoever owns the handler, so declaring
    // {"status":500} made the check agree a 500 met expectations.
    const reason = evaluateResponse(
      { method: 'GET', expect: { status: 500 } },
      { status: 500, text: '{"error":"down"}', body: { error: 'down' }, error: null }
    );
    expect(reason).toMatch(/declares the endpoint broken/);
  });

  it('allows a 4xx example, because rejecting bad input is real behaviour', () => {
    // A 404 for an absent record is correct, not broken. Blanket-rejecting
    // non-2xx conflated "the server failed" with "the server correctly said no"
    // — caught while writing app-builder's examples, where /api/prd/[id]
    // answering 404 for a missing id is exactly right.
    const reason = evaluateResponse(
      { method: 'GET', expect: { status: 404, nonEmpty: true } },
      { status: 404, text: '{"error":"PRD not found"}', body: { error: 'PRD not found' }, error: null }
    );
    expect(reason).toBeNull();
  });

  it('but a 4xx example alone never proves a route returns real data', () => {
    // The 2xx requirement moved to the ROUTE: error-path examples are welcome,
    // and one of them still has to show the route working.
    expect(hasSuccessExample([{ expect: { status: 404 } }])).toBe(false);
    expect(hasSuccessExample([{ expect: { status: 404 } }, { expect: { status: 200 } }])).toBe(true);
    // Status omitted means 200, the common case.
    expect(hasSuccessExample([{ expect: { nonEmpty: true } }])).toBe(true);
  });

  it('an empty body fails even when the example never asked for nonEmpty', () => {
    // As an opt-in flag this was evaded by omitting it: `{}` passed with a 200.
    const reason = evaluateResponse(
      { method: 'GET', expect: { status: 200 } },
      { status: 200, text: '{}', body: {}, error: null }
    );
    expect(reason).toMatch(/carries nothing/);
  });

  it('still allows an explicit opt-out for a route that legitimately returns nothing', () => {
    const reason = evaluateResponse(
      { method: 'DELETE', expect: { status: 200, nonEmpty: false } },
      { status: 200, text: '{}', body: {}, error: null }
    );
    expect(reason).toBeNull();
  });

  it('counts a collection the app named itself', () => {
    // A fixed name list read {"flights":[]} as "no collection to count" and
    // skipped the breadth check, so an empty result passed by naming its field
    // something the checker had not thought of.
    expect(primaryCollection({ flights: [] })).toEqual([]);
    expect(primaryCollection({ items: [1] })).toEqual([1]);
    // Ambiguous: no principled way to pick, so it does not guess.
    expect(primaryCollection({ a: [1], b: [2] })).toBeNull();
  });

  it('fails a declared-empty collection under minItems', () => {
    const reason = evaluateResponse(
      { method: 'GET', expect: { status: 200, minItems: 1 } },
      { status: 200, text: '{"flights":[]}', body: { flights: [] }, error: null }
    );
    expect(reason).toMatch(/fewer than the declared minimum/);
  });

  it('does not flag a legitimate person named in real seed data', () => {
    // The placeholder pattern had been widened to bare "john doe", which would
    // fail a correct handler returning a real record for a real person. Only
    // the email form is a reliable placeholder signal.
    const reason = evaluateResponse(
      { method: 'GET', expect: { status: 200 } },
      {
        status: 200,
        text: '{"passenger":"John Doe"}',
        body: { passenger: 'John Doe' },
        error: null
      }
    );
    expect(reason).toBeNull();
  });

  it('sends declared headers so an auth-gated route need not be opened to pass', () => {
    // Without header support the cheapest way to make this check green was to
    // remove the access control. A gate that rewards that is worse than none.
    expect(withQuery('/api/x', { q: 'a b' })).toBe('/api/x?q=a%20b');
  });

  it('FAILS a generated app that narrowed coverage.include to hide code', async () => {
    // The quietest evasion: drop functions/** from the measured scope and no
    // changed handler can ever report 0%, so the rule passes while measuring
    // almost nothing.
    const dir = await mkdtemp(join(tmpdir(), 'redanvil-scope-'));
    await scaffoldApp({ job, outDir: dir, corpusDir, builtAt: '2026-07-29T00:00:00.000Z' });
    const config = await readFile(join(dir, 'vitest.config.ts'), 'utf8');
    await writeFile(
      join(dir, 'vitest.config.ts'),
      config.replace("include: ['src/lib/**', 'src/hooks/**', 'functions/**']", "include: ['src/lib/**']")
    );
    const { status, output } = runCheck('u-test-presence', dir);
    expect(status, output).toBe(1);
    // Both dropped directories are named, and crucially functions/ is caught
    // even though it still appears in test.include elsewhere in the same file.
    expect(output).toContain('src/hooks/');
    expect(output).toContain('functions/');
    await rm(dir, { recursive: true, force: true });
  });

  it('advances the baseline on a pass instead of pinning it to the first run', async () => {
    // writeState re-stored the ORIGINAL base commit, so every file touched
    // since then stayed in the changed set forever and an unrelated later
    // change would be failed for an old file it never touched.
    const dir = await mkdtemp(join(tmpdir(), 'redanvil-base-'));
    await scaffoldApp({ job, outDir: dir, corpusDir, builtAt: '2026-07-29T00:00:00.000Z' });
    await stubCoverageRun(dir);
    await writeSummary(dir, { 'src/lib/routes.ts': 100 }, 40);
    commitAll(dir, 'second commit');
    const head = spawnSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
      .stdout.trim();
    const { status, output } = runCheck('u-test-presence', dir);
    expect(status, output).toBe(0);
    const state = JSON.parse(await readFile(join(dir, '.redanvil', 'coverage-state.json'), 'utf8'));
    expect(state.baseCommit).toBe(head);
    await rm(dir, { recursive: true, force: true });
  });
});

describe('the measured surface follows the evidence', () => {
  // Components and pages are the largest part of a generated app and vitest
  // cannot see them, so they were excluded outright. That is right only while
  // nothing measures them: once the app collects V8 coverage over CDP during
  // its Playwright run, the numbers are real and the exclusion becomes a hole.
  // Widening unconditionally would be worse than either -- it would fail
  // well-tested components for a number nothing could have produced.

  it('IGNORES a changed component when only vitest coverage exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'redanvil-surface-'));
    await scaffoldApp({ job, outDir: dir, corpusDir, builtAt: '2026-07-29T00:00:00.000Z' });
    commitAll(dir, 'baseline');
    await stubCoverageRun(dir);
    await writeFile(join(dir, 'src', 'components', 'Widget.tsx'), 'export const Widget = 1;' + String.fromCharCode(10));
    await writeSummary(dir, { 'src/lib/routes.ts': 100 }, 70);
    const { status, output } = runCheck('u-test-presence', dir);
    expect(status, output).toBe(0);
    await rm(dir, { recursive: true, force: true });
  });

  it('FAILS the same changed component once acceptance coverage exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'redanvil-surface-e2e-'));
    await scaffoldApp({ job, outDir: dir, corpusDir, builtAt: '2026-07-29T00:00:00.000Z' });
    commitAll(dir, 'baseline');
    await stubCoverageRun(dir);
    await writeFile(join(dir, 'src', 'components', 'Widget.tsx'), 'export const Widget = 1;' + String.fromCharCode(10));
    await writeSummary(dir, { 'src/lib/routes.ts': 100 }, 70);
    // The browser half exists now, so the component surface is measurable and
    // an untouched component is a real gap rather than an unmeasurable one.
    await mkdir(join(dir, 'coverage-e2e'), { recursive: true });
    await writeFile(
      join(dir, 'coverage-e2e', 'coverage-summary.json'),
      JSON.stringify({ total: { lines: { pct: 80 } } })
    );
    const { status, output } = runCheck('u-test-presence', dir);
    expect(status, output).toBe(1);
    expect(output).toContain('Widget.tsx');
    await rm(dir, { recursive: true, force: true });
  });
});

describe('both new rules are bound to their implementations', () => {
  for (const id of ['u-test-coverage-ratchet', 'u-api-real-output']) {
    it(`${id} is encoded in the testing lane and run by the gate`, async () => {
      const rule = loadRubric().find((r) => r.id === id);
      expect(rule, `${id} is missing from the rubric`).toBeDefined();
      expect(rule?.lane).toBe('testing');
      expect(APP_CHECKS.map((c) => c.ruleId)).toContain(id);
      const lane = await readFile(join(repoRoot, 'rules', 'rubric', 'testing.md'), 'utf8');
      expect(lane).toMatch(new RegExp(`^- ${id} \\(`, 'm'));
    });
  }

  it('u-test-presence now has a check that reads the diff, alongside the suite run', () => {
    const entries = APP_CHECKS.filter((c) => c.ruleId === 'u-test-presence');
    // Two outcomes for one rule resolve fail-closed. The suite run alone was
    // what let a blocker promising diff analysis stay green over the hole.
    expect(entries.length).toBeGreaterThan(1);
    expect(entries.some((c) => c.args.some((a) => a.includes('check.mjs')))).toBe(true);
  });

  it('u-api-real-output gets a runtime budget, not the default', () => {
    // It boots the real Workers runtime, like u-plat-runtime-parity. On the
    // 120s default it would be killed mid-boot and report a failure that is
    // really a timeout.
    const check = APP_CHECKS.find((c) => c.ruleId === 'u-api-real-output');
    expect(check?.timeoutMs).toBeGreaterThanOrEqual(300_000);
  });
});

describe('the Windows shell path does not word-split arguments', () => {
  // Found while wiring the judge: runCommand uses `shell: true` for bare
  // command names on Windows, and node does NOT escape argv in shell mode, so
  // every multi-word argument arrived as several arguments. `runGrok(dir,
  // 'Reply with only {"ok":true}')` reached grok as `Reply`, `with`, `only`,
  // ... and it exited 2 with "unexpected argument 'only'". Every Grok prompt in
  // this repo is prose, so the loop command could not have been delivering the
  // prompt it composed. It looked like a model declining to answer.
  it('quotes an argument containing spaces', () => {
    expect(quoteForCmd('Reply with only this')).toBe('"Reply with only this"');
  });

  it('leaves a simple argument alone', () => {
    expect(quoteForCmd('--output-format')).toBe('--output-format');
  });

  it('escapes embedded double quotes so JSON survives', () => {
    expect(quoteForCmd('{"ok":true}')).toBe('"{\\"ok\\":true}"');
  });

  it('does not let a trailing backslash escape the closing quote', () => {
    expect(quoteForCmd('C:\\path with space\\')).toBe('"C:\\path with space\\\\"');
  });

  it('quotes an empty argument so it is not dropped', () => {
    expect(quoteForCmd('')).toBe('""');
  });
});

describe('the API judge refuses to invent a verdict', () => {
  it('returns null when the reply carries no findings', () => {
    expect(parseFindings('I could not determine this.')).toBeNull();
    expect(parseFindings('{"summary":"fine"}')).toBeNull();
    expect(parseFindings('{"findings":[]}')).toBeNull();
  });

  it('reads findings out of a fenced block, because models add fences', () => {
    const reply = '```json\n{"findings":[{"route":"/api/x","delivers":false,"reason":"empty"}]}\n```';
    expect(parseFindings(reply)?.findings[0]?.route).toBe('/api/x');
  });

  it('points the judge at files rather than inlining them', () => {
    // Inlining the captured traffic overran the Windows command-line ceiling
    // and the spawn died with ENAMETOOLONG before the model saw anything.
    const prompt = buildJudgePrompt('evidence/api-live-demo.json', ['PRD.md']);
    expect(prompt).toContain('evidence/api-live-demo.json');
    expect(prompt).toContain('PRD.md');
    expect(prompt.length).toBeLessThan(8000);
  });

  it('finds the claim files an app really ships', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'redanvil-claims-'));
    await writeFile(join(dir, 'README.md'), '# demo\n');
    expect(findClaimFiles(dir)).toEqual(['README.md']);
    await rm(dir, { recursive: true, force: true });
  });
});
