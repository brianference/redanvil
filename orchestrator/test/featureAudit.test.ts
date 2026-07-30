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

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const corpusDir = join(repoRoot, 'rules');
const CHECK_SCRIPT = join(repoRoot, 'orchestrator', 'scripts', 'checks', 'check.mjs');
const AUDIT_ASSET = join(
  repoRoot,
  'orchestrator',
  'src',
  'scaffold',
  'assets',
  'feature-audit.mjs'
);

const parsed = parseByKind('job', {
  kind: 'job',
  slug: 'audit-demo',
  prompt: 'Build a demo app with search',
  targetType: 'fullstack-web',
  threshold: 90,
  answers: {},
  createdAt: '2026-07-28T00:00:00.000Z'
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
 * Run the shipped audit script inside an app directory.
 *
 * @param dir App directory holding `scripts/feature-audit.mjs`.
 * @param args Extra command-line arguments.
 * @returns Exit status and combined output.
 */
function runAudit(dir: string, args: string[]): { status: number; output: string } {
  const result = spawnSync('node', [join(dir, 'scripts', 'feature-audit.mjs'), ...args], {
    encoding: 'utf8',
    cwd: dir
  });
  return { status: result.status ?? -1, output: `${result.stdout}${result.stderr}` };
}

describe('the scaffold ships an enforcing feature audit', () => {
  let out: string;
  beforeAll(async () => {
    out = await mkdtemp(join(tmpdir(), 'redanvil-feature-audit-'));
    await scaffoldApp({
      job,
      outDir: out,
      corpusDir,
      builtAt: '2026-07-28T00:00:00.000Z'
    });
  });
  afterAll(async () => {
    await rm(out, { recursive: true, force: true });
  });

  it('emits the audit script and a manifest with real controls', async () => {
    const script = await readFile(join(out, 'scripts', 'feature-audit.mjs'), 'utf8');
    expect(script).toContain('feature-audit PASS');
    const manifest = JSON.parse(
      await readFile(join(out, 'tests', 'features.manifest.json'), 'utf8')
    ) as { controls: { role: string; name: string; test: string }[] };
    expect(manifest.controls.length).toBeGreaterThan(0);
    for (const control of manifest.controls) {
      expect(control.test, `${control.role}:${control.name} needs a test claim`).not.toBe('');
    }
  });

  it('renders every control the manifest claims', async () => {
    // A manifest describing controls the app does not render is a coverage
    // claim with nothing behind it -- the failure this audit exists to catch,
    // one file over. These are the handles the crawl keys on.
    const shell = await readFile(join(out, 'src', 'components', 'Page.tsx'), 'utf8');
    const toggle = await readFile(join(out, 'src', 'components', 'ThemeToggle.tsx'), 'utf8');
    const manifest = JSON.parse(
      await readFile(join(out, 'tests', 'features.manifest.json'), 'utf8')
    ) as { controls: { name: string }[] };
    const rendered = `${shell}\n${toggle}`;
    for (const control of manifest.controls) {
      expect(rendered, `nothing renders data-testid="${control.name}"`).toContain(
        `data-testid="${control.name}"`
      );
    }
    expect(shell).toContain('<ThemeToggle />');
  });

  it('wires the audit into test:features AND verify', async () => {
    const pkg = JSON.parse(await readFile(join(out, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['test:features']).toContain('feature-audit.mjs');
    // An audit nobody runs is a file, not a gate.
    expect(pkg.scripts.verify).toContain('test:features');
  });

  it('discovers routes from the sitemap the scaffold already emits', () => {
    const { status, output } = runAudit(out, ['--print-routes', '--base', 'http://127.0.0.1:9']);
    expect(status, output).toBe(0);
    const report = JSON.parse(output) as { source: string; routes: string[] };
    expect(report.source).toContain('sitemap.xml');
    expect(report.routes).toEqual(['/', '/about', '/contact', '/privacy', '/terms']);
  });

  it('passes u-test-feature-audit on a fresh scaffold', () => {
    const { status, output } = runCheck('u-test-feature-audit', out);
    expect(status, output).toBe(0);
  });

  it('counts as a failed blocker when no verdict is recorded', async () => {
    // The whole mechanism, end to end: run the gate with no checks at all, so
    // nothing records an outcome for this rule. A rule that is merely declared
    // must not pass by default -- that is how a requirement ends up enforcing
    // nothing while still inflating the rubric count.
    const report = await gateApp(out, []);
    expect(report.blockersFailed).toContain('u-test-feature-audit');
    expect(report.score).toBe(0);
  });
});

describe('u-test-feature-audit fails closed', () => {
  let base: string;
  beforeAll(async () => {
    base = await mkdtemp(join(tmpdir(), 'redanvil-audit-red-'));
    await scaffoldApp({
      job,
      outDir: base,
      corpusDir,
      builtAt: '2026-07-28T00:00:00.000Z'
    });
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
    const dir = await mkdtemp(join(tmpdir(), 'redanvil-audit-broken-'));
    await cp(base, dir, { recursive: true });
    await mutate(dir);
    return dir;
  }

  // Every one of these passed before the rule existed. A check that cannot fail
  // is worse than no check, so each hole gets its own red case.

  it('fails when the manifest is missing', async () => {
    const dir = await broken(async (d) => {
      await rm(join(d, 'tests', 'features.manifest.json'));
    });
    const { status, output } = runCheck('u-test-feature-audit', dir);
    expect(status).toBe(1);
    expect(output).toContain('no control manifest');
    await rm(dir, { recursive: true, force: true });
  });

  it('fails when the audit script is missing', async () => {
    const dir = await broken(async (d) => {
      await rm(join(d, 'scripts', 'feature-audit.mjs'));
    });
    const { status, output } = runCheck('u-test-feature-audit', dir);
    expect(status).toBe(1);
    expect(output).toContain('no control audit');
    await rm(dir, { recursive: true, force: true });
  });

  it('fails when the manifest claims zero controls', async () => {
    const dir = await broken(async (d) => {
      await writeFile(
        join(d, 'tests', 'features.manifest.json'),
        JSON.stringify({ controls: [] })
      );
    });
    const { status, output } = runCheck('u-test-feature-audit', dir);
    expect(status).toBe(1);
    expect(output).toContain('zero controls');
    await rm(dir, { recursive: true, force: true });
  });

  it('fails when a claim names a test that does not exist', async () => {
    const dir = await broken(async (d) => {
      const path = join(d, 'tests', 'features.manifest.json');
      const manifest = JSON.parse(await readFile(path, 'utf8')) as {
        controls: { test: string }[];
      };
      const first = manifest.controls[0];
      if (first === undefined) throw new Error('fixture has no controls');
      first.test = 'acceptance.spec.ts > a test nobody ever wrote';
      await writeFile(path, JSON.stringify(manifest, null, 2));
    });
    const { status, output } = runCheck('u-test-feature-audit', dir);
    expect(status).toBe(1);
    expect(output).toContain('no such test title');
    await rm(dir, { recursive: true, force: true });
  });

  it('fails when a claim records TODO instead of a test', async () => {
    const dir = await broken(async (d) => {
      const path = join(d, 'tests', 'features.manifest.json');
      const manifest = JSON.parse(await readFile(path, 'utf8')) as {
        controls: { test: string }[];
      };
      const first = manifest.controls[0];
      if (first === undefined) throw new Error('fixture has no controls');
      first.test = 'TODO';
      await writeFile(path, JSON.stringify(manifest, null, 2));
    });
    const { status, output } = runCheck('u-test-feature-audit', dir);
    expect(status).toBe(1);
    expect(output).toContain('documents the gap');
    await rm(dir, { recursive: true, force: true });
  });

  it('fails when verify stops running the audit', async () => {
    const dir = await broken(async (d) => {
      const path = join(d, 'package.json');
      const pkg = JSON.parse(await readFile(path, 'utf8')) as {
        scripts: Record<string, string>;
      };
      pkg.scripts.verify = 'npm run typecheck && npm run lint && npm run test';
      await writeFile(path, JSON.stringify(pkg, null, 2));
    });
    const { status, output } = runCheck('u-test-feature-audit', dir);
    expect(status).toBe(1);
    expect(output).toContain('"verify" does not run the feature audit');
    await rm(dir, { recursive: true, force: true });
  });

  it('reports not-applicable rather than passing when there is no frontend', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'redanvil-audit-backend-'));
    await mkdir(join(dir, 'functions'), { recursive: true });
    await writeFile(join(dir, 'functions', 'api.ts'), 'export const onRequest = () => null;\n');
    const { status } = runCheck('u-test-feature-audit', dir);
    // Exit 3 leaves the denominator; exit 0 would credit the numerator for a
    // rule nothing measured.
    expect(status).toBe(3);
    await rm(dir, { recursive: true, force: true });
  });
});

describe('the audit refuses to guess which routes to crawl', () => {
  it('exits 2 with every source it tried when no route list can be found', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'redanvil-audit-routes-'));
    await mkdir(join(dir, 'scripts'), { recursive: true });
    await cp(AUDIT_ASSET, join(dir, 'scripts', 'feature-audit.mjs'));
    // No sitemap, no route table, no config, nothing serving on this port.
    const { status, output } = runAudit(dir, ['--base', 'http://127.0.0.1:9']);
    expect(status, output).toBe(2);
    expect(output).toContain('could not determine which routes to crawl');
    expect(output).toContain('sitemap.xml');
    expect(output).toContain('routes.ts');
    // The silent-default failure this replaces: never audit "/" alone.
    expect(output).not.toContain('feature-audit PASS');
    await rm(dir, { recursive: true, force: true });
  });

  it('reads a route table when no sitemap exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'redanvil-audit-table-'));
    await mkdir(join(dir, 'scripts'), { recursive: true });
    await mkdir(join(dir, 'src', 'lib'), { recursive: true });
    await cp(AUDIT_ASSET, join(dir, 'scripts', 'feature-audit.mjs'));
    await writeFile(
      join(dir, 'src', 'lib', 'routes.ts'),
      "export const ROUTES = [{ path: '/', name: 'Home' }, { path: '/pricing', name: 'Pricing' }];\n"
    );
    const { status, output } = runAudit(dir, ['--print-routes', '--base', 'http://127.0.0.1:9']);
    expect(status, output).toBe(0);
    const report = JSON.parse(output) as { routes: string[] };
    expect(report.routes).toEqual(['/', '/pricing']);
    await rm(dir, { recursive: true, force: true });
  });

  it('lets --routes override discovery', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'redanvil-audit-flag-'));
    await mkdir(join(dir, 'scripts'), { recursive: true });
    await cp(AUDIT_ASSET, join(dir, 'scripts', 'feature-audit.mjs'));
    const { status, output } = runAudit(dir, [
      '--print-routes',
      '--routes',
      '/,/search,https://example.com/deep/page/',
      '--base',
      'http://127.0.0.1:9'
    ]);
    expect(status, output).toBe(0);
    const report = JSON.parse(output) as { source: string; routes: string[] };
    expect(report.source).toBe('--routes flag');
    expect(report.routes).toEqual(['/', '/deep/page', '/search']);
    await rm(dir, { recursive: true, force: true });
  });
});

describe('u-test-feature-audit is bound to its implementation', () => {
  it('is encoded as a fail-closed blocker in the testing lane', () => {
    const rule = loadRubric().find((r) => r.id === 'u-test-feature-audit');
    expect(rule).toBeDefined();
    expect(rule?.severity).toBe('blocker');
    // `det` is in FAIL_CLOSED_METHODS, so an unrecorded verdict fails rather
    // than passing by default.
    expect(rule?.method).toBe('det');
    expect(rule?.lane).toBe('testing');
  });

  it('is executed by the gate runner', () => {
    expect(APP_CHECKS.map((c) => c.ruleId)).toContain('u-test-feature-audit');
  });

  it('is documented in the testing lane markdown', async () => {
    const lane = await readFile(join(repoRoot, 'rules', 'rubric', 'testing.md'), 'utf8');
    expect(lane).toMatch(/^- u-test-feature-audit \(blocker, det\): /m);
  });
});
