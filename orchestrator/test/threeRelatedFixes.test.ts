/**
 * Proofs for three related PM / product / test-lane fixes.
 *
 *   a. PM on app with NO results file → all rows unmet, no crash, no passes
 *   b. PM on CORRUPT results file → hard error
 *   c. Product role missing its brief → counted as NOT run (artifact contract)
 *   d. PRD promise with no owning row → hard error, named
 *   e. Ordering: product before design before build; refusal when product missing
 *   f. u-test-runners fails when browser OR VRT lane absent (unit+pytest green)
 *   g. typecheck / lint / suite green (asserted by the CI invocation, not here)
 *
 * No real grok CLI. No push. No deploy.
 */
import { describe, it, expect } from 'vitest';
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync
} from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  planFromResult,
  statusesWhenNoResults,
  loadGateResultFile,
  CorruptResultsError,
  runPmCommand
} from '../src/commands/pm';
import { planIteration, roleDispatchOrder } from '../src/team/pm';
import { ROLES, getRole } from '../src/team/roles';
import {
  evaluateProductDeliverables,
  parseProductPromises,
  findPromisesWithoutOwner,
  enforceProductBeforeDesign
} from '../src/team/productPrecondition';
import { runRole } from '../src/team/runRole';
import { loadChecklistRows } from '../src/done/checklist.mjs';
import { checklistCoverage } from '../src/done/coverage.mjs';
import {
  detectRunners,
  runTestRunners
} from '../scripts/checks/u-test-runners.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CHECKLIST_PATH = join(REPO_ROOT, 'docs/DONE-CHECKLIST.md');

/**
 * Build statuses that would dispatch product + design + build without gates.
 */
function statusesWithProductDesignBuild() {
  const rows = loadChecklistRows(CHECKLIST_PATH);
  return checklistCoverage({
    rows,
    ruleOutcomes: [
      { ruleId: 'fe-product-completeness', passed: false },
      { ruleId: 'u-claims-covered', passed: false },
      { ruleId: 'fe-brand-mark-size', passed: false },
      { ruleId: 'proc-design-options', passed: false },
      { ruleId: 'u-typing-strict', passed: false },
      { ruleId: 'fe-legal-substance', passed: false }
    ],
    optValues: {
      unitTestsPass: false,
      acceptanceTestsPass: false,
      screenshotsPresent: true,
      evidenceStale: false,
      independentReviewOk: true,
      qaVisualOk: true,
      userRefuseOk: true
    },
    scoreMet: false,
    noFailedRules: false
  });
}

describe('a. PM with NO results file → all rows unmet, no crash, no passes', () => {
  it('plans without ENOENT and reports zero passing rows', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ra-fix-a-'));
    const slug = 'brand-new-app';
    try {
      mkdirSync(join(root, slug), { recursive: true });
      // Deliberately no results/<slug>.json
      expect(existsSync(join(root, 'results', `${slug}.json`))).toBe(false);

      const statuses = statusesWhenNoResults(CHECKLIST_PATH);
      expect(statuses.length).toBeGreaterThan(0);
      const passed = statuses.filter((s) => s.status === 'pass');
      expect(passed).toEqual([]);
      expect(statuses.every((s) => s.status === 'unmeasured')).toBe(true);

      const out = planFromResult({
        resultPath: `results/${slug}.json`,
        repoRoot: root,
        slug,
        checklistPath: CHECKLIST_PATH
      });
      expect(out.batches).toBeGreaterThan(0);
      expect(out.lines.join('\n')).toMatch(/no results file|every checklist row is unmet/i);
      expect(out.lines.join('\n')).toMatch(/0 passing/);
      // No row reported as pass in the dry-run assignment lines.
      expect(out.lines.join('\n')).not.toMatch(/:pass\b/);

      const code = await runPmCommand({
        resultPath: `results/${slug}.json`,
        repoRoot: root,
        slug,
        checklistPath: CHECKLIST_PATH
      });
      // Exit 0 when plan succeeds (unowned may be empty for full checklist).
      // Unowned is independent of missing results.
      expect([0, 1]).toContain(code);
      console.log('a. exit code:', code);
      console.log('a. batches:', out.batches, 'passed rows:', passed.length);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('b. PM with CORRUPT results file → hard error', () => {
  it('throws CorruptResultsError / exits non-zero, does not treat as new app', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ra-fix-b-'));
    try {
      mkdirSync(join(root, 'results'), { recursive: true });
      writeFileSync(join(root, 'results', 'x.json'), '{ not valid json !!!');

      expect(() => loadGateResultFile(join(root, 'results', 'x.json'), 'results/x.json')).toThrow(
        CorruptResultsError
      );

      let threw = false;
      try {
        planFromResult({
          resultPath: 'results/x.json',
          repoRoot: root,
          checklistPath: CHECKLIST_PATH
        });
      } catch (err) {
        threw = true;
        expect(err).toBeInstanceOf(CorruptResultsError);
        expect((err as Error).message).toMatch(/corrupt results file/i);
      }
      expect(threw).toBe(true);

      const code = await runPmCommand({
        resultPath: 'results/x.json',
        repoRoot: root,
        checklistPath: CHECKLIST_PATH
      });
      expect(code).toBe(2);
      console.log('b. exit code:', code);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('c. Product role missing its brief → counted as NOT run', () => {
  it('artifact contract: exit 0 without brief is NOT RUN', async () => {
    const product = getRole('product');
    expect(product).toBeDefined();
    expect(product!.artifacts).toEqual(
      expect.arrayContaining([
        'docs/<slug>-product-brief.md',
        'docs/<slug>-prd.md'
      ])
    );
    expect(product!.needsWorktree).toBe(false);
    expect(product!.owns).toEqual(
      expect.arrayContaining(['fe-product-completeness', 'u-claims-covered'])
    );

    const dir = mkdtempSync(join(tmpdir(), 'ra-fix-c-'));
    try {
      const res = await runRole(
        { role: product!, rows: [{ id: 'fe-product-completeness', status: 'fail' }] },
        1,
        { workDir: dir, slug: 'demo' },
        {
          writeBrief: () => undefined,
          // Fake agent: exit 0, produce nothing (no real grok).
          spawn: () => ({ code: 0, out: 'I wrote the product brief (claim only).' })
        }
      );
      expect(res.exitCode).toBe(0);
      expect(res.countedAsRun).toBe(false);
      expect(res.missing.some((m) => m.includes('product-brief'))).toBe(true);
      expect(res.reason).toMatch(/NOT RUN/i);
      console.log('c. countedAsRun:', res.countedAsRun, 'reason:', res.reason);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('d. PRD promise with no owning row → hard error, named', () => {
  it('names the promise that has no owner', () => {
    const promises = parseProductPromises(`
# Product brief

## Promises

- Browse sitters by neighbourhood | owns: B4
- Teleport pets across the galaxy
- Invented feature | owns: Z99-nobody-owns-this
`);
    expect(promises.length).toBe(3);
    const bad = findPromisesWithoutOwner(promises, ROLES);
    expect(bad.length).toBeGreaterThanOrEqual(2);
    const names = bad.map((b) => b.name).join(' | ');
    expect(names).toMatch(/Teleport pets/i);
    expect(names).toMatch(/Invented feature/i);
    expect(bad.some((b) => /no owning row/i.test(b.reason))).toBe(true);
    expect(bad.some((b) => /no role owns/i.test(b.reason))).toBe(true);
    console.log(
      'd. hard errors:\n' + bad.map((b) => `  - ${b.reason}`).join('\n')
    );
  });

  it('surfaces the hard error through planFromResult', () => {
    const root = mkdtempSync(join(tmpdir(), 'ra-fix-d-'));
    const slug = 'promise-app';
    try {
      mkdirSync(join(root, 'results'), { recursive: true });
      writeFileSync(
        join(root, 'results', `${slug}.json`),
        JSON.stringify({
          slug,
          finalScore: 0,
          threshold: 90,
          rules: [{ ruleId: 'lg-shipped', passed: false }]
        })
      );
      mkdirSync(join(root, slug, 'docs'), { recursive: true });
      writeFileSync(
        join(root, slug, 'docs', `${slug}-product-brief.md`),
        [
          '# Product brief',
          '',
          '## Promises',
          '',
          '- Feature with no owner at all',
          ''
        ].join('\n')
      );

      const out = planFromResult({
        resultPath: `results/${slug}.json`,
        repoRoot: root,
        slug,
        checklistPath: CHECKLIST_PATH
      });
      expect(out.unowned.some((u) => u.startsWith('promise:'))).toBe(true);
      expect(out.lines.join('\n')).toMatch(/HARD ERROR/i);
      expect(out.lines.join('\n')).toMatch(/Feature with no owner/i);
      console.log('d. plan unowned:', out.unowned.filter((u) => u.startsWith('promise:')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('e. Ordering: product → design → build; refusal when product missing', () => {
  it('refuses design and build when product brief is absent', () => {
    const appDir = mkdtempSync(join(tmpdir(), 'ra-fix-e-'));
    const slug = 'ordered-app';
    try {
      // No product brief on disk.
      const statuses = statusesWithProductDesignBuild();
      const plan = planIteration(statuses, ROLES, 1, appDir, slug);
      const ids = plan.assignments.map((a) => a.role.id);

      expect(plan.productPrecondition).toBeDefined();
      expect(plan.productPrecondition!.deliverables.ok).toBe(false);
      expect(ids).toContain('product');
      expect(ids).not.toContain('logo');
      expect(ids).not.toContain('layout');
      expect(ids).not.toContain('engineer');
      expect(ids).not.toContain('content');
      expect(ids).not.toContain('testwriter');

      const msg = plan.productPrecondition!.messages.join('\n');
      expect(msg).toMatch(/REFUSED|product brief missing|product has not run/i);
      console.log('e. refusal when product missing:\n' + msg);

      // Dispatch order keys.
      expect(roleDispatchOrder('product')).toBeLessThan(roleDispatchOrder('logo'));
      expect(roleDispatchOrder('logo')).toBeLessThan(roleDispatchOrder('layout'));
      expect(roleDispatchOrder('layout')).toBeLessThan(roleDispatchOrder('engineer'));
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  it('allows design roles only after product brief exists (still blocks build without design)', () => {
    const appDir = mkdtempSync(join(tmpdir(), 'ra-fix-e2-'));
    const slug = 'ordered-app';
    try {
      mkdirSync(join(appDir, 'docs'), { recursive: true });
      writeFileSync(
        join(appDir, 'docs', `${slug}-product-brief.md`),
        [
          '# Product brief',
          '',
          '## Promises',
          '',
          '- Search | owns: B4',
          '',
          '## Core user job',
          '',
          'Find and use the product.',
          ''
        ].join('\n')
      );
      expect(evaluateProductDeliverables(appDir, slug).ok).toBe(true);

      const statuses = statusesWithProductDesignBuild();
      const plan = planIteration(statuses, ROLES, 1, appDir, slug);
      const ids = plan.assignments.map((a) => a.role.id);
      // Product ok → design gate runs → logo/layout, not engineer.
      expect(plan.productPrecondition?.deliverables.ok).toBe(true);
      expect(ids).toEqual(expect.arrayContaining(['logo', 'layout']));
      expect(ids).not.toContain('engineer');
      expect(plan.designPrecondition?.refusedBuildRoles ?? []).toEqual(
        expect.arrayContaining(['engineer', 'content'])
      );
      console.log('e2. after product, design first; refused build:', plan.designPrecondition?.refusedBuildRoles);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });
});

describe('f. u-test-runners fails when browser or VRT lane is absent', () => {
  it('FAILS when unit + pytest are green but browser lane is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ra-fix-f-browser-'));
    let captured = '';
    try {
      // Input: vitest unit configured, pytest configured, NO browser, NO vrt.
      writeFileSync(join(dir, 'vitest.config.ts'), "export default { test: { name: 'unit' } }\n");
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 't', scripts: { test: 'vitest run' } }));
      mkdirSync(join(dir, 'tests'), { recursive: true });
      writeFileSync(join(dir, 'tests', 'test_ok.py'), 'def test_ok():\n  assert True\n');

      const detected = detectRunners(dir);
      const names = detected.map((r) => r.name);
      expect(names).toContain('vitest-unit');
      expect(names).toContain('vitest-browser');
      expect(names).toContain('vitest-vrt');
      expect(names).toContain('pytest');
      expect(detected.find((r) => r.name === 'vitest-browser')?.configured).toBe(false);
      expect(detected.find((r) => r.name === 'vitest-vrt')?.configured).toBe(false);

      try {
        runTestRunners(
          dir,
          {
            pass: () => {
              throw new Error('unexpected pass');
            },
            fail: (m?: string) => {
              captured = m ?? '';
              throw new Error('STOP');
            },
            notApplicable: () => {
              throw new Error('unexpected n/a');
            }
          },
          {
            // Real detect; fake run so unit+pytest look green.
            run: (_d, runner) => ({
              name: runner.name,
              passed: runner.name === 'vitest-unit' || runner.name === 'pytest',
              output: `${runner.name} ok`,
              exitCode: 0
            })
          }
        );
      } catch (err) {
        if (!(err instanceof Error) || err.message !== 'STOP') throw err;
      }

      expect(captured).toMatch(/vitest-browser/);
      expect(captured).toMatch(/not configured|FAIL/i);
      // Unit and pytest being green must not hide the missing browser lane.
      expect(captured).toMatch(/vitest-unit/);
      console.log('f. missing browser fail output:\n', captured.slice(0, 800));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('FAILS when unit + pytest are green but VRT lane is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ra-fix-f-vrt-'));
    let captured = '';
    try {
      // Input: unit + browser present, VRT absent, pytest present.
      writeFileSync(
        join(dir, 'vitest.config.ts'),
        `
export default {
  test: {
    projects: [
      { test: { name: 'unit', environment: 'node' } },
      { test: { name: 'browser', browser: { enabled: true, provider: 'playwright' } } }
    ]
  }
}
`
      );
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 't',
          scripts: { test: 'vitest run', 'test:browser': 'vitest run --project browser' }
        })
      );
      mkdirSync(join(dir, 'src'), { recursive: true });
      writeFileSync(join(dir, 'src', 'x.browser.test.ts'), 'import { it } from "vitest"; it("x", () => {});');
      mkdirSync(join(dir, 'tests'), { recursive: true });
      writeFileSync(join(dir, 'tests', 'test_ok.py'), 'def test_ok():\n  assert True\n');

      const detected = detectRunners(dir);
      expect(detected.find((r) => r.name === 'vitest-browser')?.configured).toBe(true);
      expect(detected.find((r) => r.name === 'vitest-vrt')?.configured).toBe(false);

      try {
        runTestRunners(
          dir,
          {
            pass: () => {
              throw new Error('unexpected pass');
            },
            fail: (m?: string) => {
              captured = m ?? '';
              throw new Error('STOP');
            },
            notApplicable: () => {
              throw new Error('unexpected n/a');
            }
          },
          {
            run: (_d, runner) => ({
              name: runner.name,
              passed: true,
              output: 'ok',
              exitCode: 0
            })
          }
        );
      } catch (err) {
        if (!(err instanceof Error) || err.message !== 'STOP') throw err;
      }

      expect(captured).toMatch(/vitest-vrt/);
      expect(captured).toMatch(/not configured|FAIL/i);
      console.log('f. missing VRT fail output:\n', captured.slice(0, 800));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('product role registry', () => {
  it('is registered and product is earlier than design in ROLES ownership map', () => {
    expect(ROLES.some((r) => r.id === 'product')).toBe(true);
    const product = getRole('product')!;
    const brainstorm = getRole('brainstorm')!;
    const testwriter = getRole('testwriter')!;
    // Product owns the product-outcome rows; brainstorm no longer does.
    expect(product.owns).toContain('fe-product-completeness');
    expect(product.owns).toContain('u-claims-covered');
    expect(brainstorm.owns).not.toContain('fe-product-completeness');
    expect(testwriter.owns).not.toContain('u-claims-covered');
  });
});

describe('enforceProductBeforeDesign pure', () => {
  it('strips design and build when brief missing', () => {
    const appDir = mkdtempSync(join(tmpdir(), 'ra-fix-prod-'));
    try {
      const product = getRole('product')!;
      const logo = getRole('logo')!;
      const engineer = getRole('engineer')!;
      const plan = {
        iteration: 1,
        assignments: [
          { role: product, rows: [], matchedOwns: [...product.owns] },
          { role: logo, rows: [], matchedOwns: [...logo.owns] },
          { role: engineer, rows: [], matchedOwns: [...engineer.owns] }
        ],
        worktreeRoles: ['logo', 'engineer'] as import('../src/team/roles').RoleId[],
        readOnlyRoles: ['product'] as import('../src/team/roles').RoleId[]
      };
      const gated = enforceProductBeforeDesign(plan, appDir, 'x', ROLES);
      const ids = gated.plan.assignments.map((a) => a.role.id);
      expect(ids).toContain('product');
      expect(ids).not.toContain('logo');
      expect(ids).not.toContain('engineer');
      expect(gated.refusedRoles).toEqual(expect.arrayContaining(['logo', 'engineer']));
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });
});
