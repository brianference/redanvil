/**
 * Tests for .github/scripts/cross_app_duplication.mjs — discovery, identifier
 * normalisation, block detection, budget exit codes, and not-vacuous proof via
 * a TEMP COPY of the implementation (never mutate the real script in place).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(REPO_ROOT, '.github', 'scripts', 'cross_app_duplication.mjs');
const node = process.execPath;

/** Temp dirs created this file; cleaned in afterEach. */
const tempDirs: string[] = [];

/**
 * Create a tracked temp directory.
 * @param prefix Directory name prefix.
 * @returns Absolute path.
 */
function makeTemp(prefix = 'redanvil-cad-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/**
 * Write a file under root, creating parents.
 * @param root Base directory.
 * @param relPath Relative path.
 * @param body Contents.
 */
function write(root: string, relPath: string, body: string): void {
  const full = join(root, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, 'utf8');
}

/**
 * Scaffold a minimal app dir (package.json + src file).
 * @param root Repo or parent directory.
 * @param appName App directory name.
 * @param relSrc Path under src/.
 * @param body File body.
 */
function writeApp(root: string, appName: string, relSrc: string, body: string): void {
  write(root, join(appName, 'package.json'), JSON.stringify({ name: appName, private: true }));
  write(root, join(appName, 'src', relSrc), body);
}

/**
 * Spawn the cross_app_duplication CLI.
 * @param args Extra argv.
 * @param cwd Working directory (repo root under test).
 * @returns status, stdout, stderr.
 */
function runCli(
  args: string[] = [],
  cwd: string = REPO_ROOT
): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(node, [SCRIPT, ...args], {
    encoding: 'utf8',
    cwd,
    env: process.env,
    timeout: 60_000
  });
  return {
    status: r.status,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? ''
  };
}

/** Subset of cross_app_duplication.mjs exports exercised by these tests. */
interface CrossAppDupModule {
  MIN_BLOCK: number;
  DEFAULT_BUDGET: number;
  parseArgs: (argv: string[]) => {
    repoRoot: string;
    jsonPath: string | null;
    max: number | null;
  };
  discoverApps: (repoRoot: string) => string[];
  normaliseLine: (line: string) => string;
  normaliseSource: (source: string) => string[];
  isStylePropLine: (line: string) => boolean;
  isLowSubstanceLine: (line: string) => boolean;
  isMostlyStyleProps: (lines: string[]) => boolean;
  findDuplicatedBlocks: (
    linesA: string[],
    linesB: string[],
    minBlock?: number
  ) => { aStart: number; bStart: number; length: number }[];
  compareFiles: (
    pathA: string,
    pathB: string,
    minBlock?: number
  ) => {
    duplicatedLines: number;
    blocks: { aStart: number; bStart: number; length: number }[];
  } | null;
  runCrossAppDuplication: (
    repoRoot: string,
    opts?: { budget?: number; minBlock?: number }
  ) => {
    checkedAt: string;
    pairs: {
      a: string;
      b: string;
      duplicatedLines: number;
      blocks: { aStart: number; bStart: number; length: number }[];
    }[];
    totalDuplicatedLines: number;
    budget: number;
    ok: boolean;
    apps: string[];
  };
  isDeclarationSkeleton: (line: string) => boolean;
  main: (argv: string[]) => number;
}

/**
 * Dynamically import the script module (real or TEMP COPY).
 * @param scriptPath Path to cross_app_duplication.mjs.
 * @returns Module namespace.
 */
async function loadMod(scriptPath: string = SCRIPT): Promise<CrossAppDupModule> {
  const href = `${pathToFileURL(scriptPath).href}?t=${Date.now()}-${Math.random()}`;
  return import(href) as Promise<CrossAppDupModule>;
}

/**
 * A 10-line substantive block (not mostly style props) for clone fixtures.
 * @param idPrefix Identifier prefix so renames can swap names while keeping shape.
 * @returns Source fragment (no leading newline).
 */
function sharedLogicBlock(idPrefix: string): string {
  const p = idPrefix;
  return [
    `export function ${p}Run(items: string[]): number {`,
    `  let ${p}Total = 0;`,
    `  for (const ${p}Item of items) {`,
    `    if (${p}Item.length === 0) {`,
    `      continue;`,
    `    }`,
    `    ${p}Total += ${p}Item.length;`,
    `    if (${p}Total > 100) {`,
    `      return ${p}Total;`,
    `    }`,
    `  }`,
    `  return ${p}Total;`,
    `}`
  ].join('\n');
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir === undefined) break;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
});

describe('cross_app_duplication — discovery', () => {
  it('discovers sibling dirs with package.json + src, not hard-coded names', async () => {
    const { discoverApps } = await loadMod();
    const root = makeTemp();
    writeApp(root, 'alpha', 'index.ts', 'export const x = 1;\n');
    writeApp(root, 'beta', 'index.ts', 'export const y = 2;\n');
    // No src/ — ignored
    write(root, 'gamma/package.json', '{}');
    // No package.json — ignored
    write(root, 'delta/src/index.ts', 'export {};\n');

    const apps = discoverApps(root).map((p) => p.replace(/\\/g, '/'));
    expect(apps.some((a) => a.endsWith('/alpha'))).toBe(true);
    expect(apps.some((a) => a.endsWith('/beta'))).toBe(true);
    expect(apps.some((a) => a.endsWith('/gamma'))).toBe(false);
    expect(apps.some((a) => a.endsWith('/delta'))).toBe(false);
  });
});

describe('cross_app_duplication — normalisation', () => {
  it('makes renamed identifiers compare equal while keeping keywords and strings', async () => {
    const { normaliseLine } = await loadMod();
    const a = normaliseLine('const runs = items.filter((x) => x > 0);');
    const b = normaliseLine('const things = rows.filter((y) => y > 0);');
    expect(a).toBe(b);
    // Keywords stay; identifiers (including method names) become `$`.
    expect(a).toContain('const');
    expect(a).toMatch(/const \$ = \$ \. \$/);
    // String literals must survive.
    const withStr = normaliseLine(`const label = 'hello-world';`);
    expect(withStr).toContain("'hello-world'");
    expect(withStr).toMatch(/^const \$ = 'hello-world' ;$/);
  });
});

describe('cross_app_duplication — detection', () => {
  it('detects a genuinely shared 10-line block across two temp apps', async () => {
    const { runCrossAppDuplication } = await loadMod();
    const root = makeTemp();
    const block = sharedLogicBlock('alpha');
    writeApp(root, 'app-one', 'util.ts', `${block}\nexport const one = 1;\n`);
    writeApp(root, 'app-two', 'helper.ts', `export const two = 2;\n${block}\n`);

    const report = runCrossAppDuplication(root, { budget: 0 });
    expect(report.totalDuplicatedLines).toBeGreaterThanOrEqual(10);
    expect(report.pairs.length).toBeGreaterThanOrEqual(1);
    expect(report.pairs[0]?.duplicatedLines).toBeGreaterThanOrEqual(10);
    expect(report.ok).toBe(false); // budget 0, any duplication fails
  });

  it('still detects the same block when every identifier is renamed', async () => {
    const { runCrossAppDuplication, normaliseSource } = await loadMod();
    const root = makeTemp();
    const original = sharedLogicBlock('alpha');
    const renamed = sharedLogicBlock('beta');
    // Control: raw text differs
    expect(original).not.toBe(renamed);
    // Point of the feature: normalised forms match
    expect(normaliseSource(original)).toEqual(normaliseSource(renamed));

    writeApp(root, 'app-one', 'util.ts', `${original}\n`);
    writeApp(root, 'app-two', 'helper.ts', `${renamed}\n`);

    const report = runCrossAppDuplication(root, { budget: 9999 });
    expect(report.totalDuplicatedLines).toBeGreaterThanOrEqual(10);
    expect(report.pairs.some((p) => p.duplicatedLines >= 10)).toBe(true);
  });

  it('reports clean (exit 0) when two apps share no logic', async () => {
    const { main, runCrossAppDuplication } = await loadMod();
    const root = makeTemp();
    writeApp(
      root,
      'app-one',
      'a.ts',
      [
        'export function greet(name: string): string {',
        "  return 'hello ' + name;",
        '}',
        'export const VERSION = 1;',
        'export function onlyInOne(): number {',
        '  return 42;',
        '}'
      ].join('\n')
    );
    writeApp(
      root,
      'app-two',
      'b.ts',
      [
        'export function farewell(name: string): string {',
        "  return 'bye ' + name;",
        '}',
        'export const BUILD = 9;',
        'export function onlyInTwo(): number {',
        '  return 7;',
        '}'
      ].join('\n')
    );

    const report = runCrossAppDuplication(root, { budget: 0 });
    expect(report.totalDuplicatedLines).toBe(0);
    expect(report.pairs).toEqual([]);
    expect(report.ok).toBe(true);

    const code = main([root, '--max', '0']);
    expect(code).toBe(0);
  });
});

describe('cross_app_duplication — budget exits', () => {
  it('exits 1 when total is over budget and 0 when under or equal', async () => {
    const { main, runCrossAppDuplication } = await loadMod();
    const root = makeTemp();
    const block = sharedLogicBlock('shared');
    writeApp(root, 'app-one', 'util.ts', `${block}\n`);
    writeApp(root, 'app-two', 'helper.ts', `${block}\n`);

    const report = runCrossAppDuplication(root, { budget: 9999 });
    const total = report.totalDuplicatedLines;
    expect(total).toBeGreaterThanOrEqual(10);

    expect(main([root, '--max', String(total - 1)])).toBe(1);
    expect(main([root, '--max', String(total)])).toBe(0);
    expect(main([root, '--max', String(total + 5)])).toBe(0);
  });

  it('writes JSON report in the evidence shape when --json is set', async () => {
    const { main } = await loadMod();
    const root = makeTemp();
    writeApp(root, 'app-one', 'a.ts', 'export const a = 1;\n');
    writeApp(root, 'app-two', 'b.ts', 'export const b = 2;\n');
    const out = join(root, 'dup.json');
    const code = main([root, '--json', out, '--max', '0']);
    expect(code).toBe(0);
    const json = JSON.parse(readFileSync(out, 'utf8')) as {
      checkedAt: string;
      pairs: unknown[];
      totalDuplicatedLines: number;
      budget: number;
      ok: boolean;
    };
    expect(typeof json.checkedAt).toBe('string');
    expect(json.checkedAt.length).toBeGreaterThan(10);
    expect(Array.isArray(json.pairs)).toBe(true);
    expect(json.totalDuplicatedLines).toBe(0);
    expect(json.budget).toBe(0);
    expect(json.ok).toBe(true);
  });
});

describe('cross_app_duplication — CLI against this repo', () => {
  it('runs on the real repo and reports a finite total under the default budget', () => {
    // Smoke: the wired script is executable. Budget must pass at the measured baseline.
    const r = runCli([REPO_ROOT]);
    expect(r.status).toBe(0);
    const text = `${r.stdout}${r.stderr}`;
    expect(text).toMatch(/total duplicated lines:\s*\d+/i);
    expect(text).toMatch(/PASS\s+cross-app-duplication/i);
  });
});

describe('cross_app_duplication — not-vacuous (TEMP COPY only)', () => {
  it('breaking identifier normalisation in a TEMP COPY makes rename detection go red', async () => {
    // Never mutate the real script in place — break a disposable copy only.
    const copyDir = makeTemp('redanvil-cad-broken-');
    const brokenScript = join(copyDir, 'cross_app_duplication.mjs');
    cpSync(SCRIPT, brokenScript);

    let source = readFileSync(brokenScript, 'utf8');
    // Sabotage: stop replacing identifiers so renames defeat the detector.
    const needle = "tokens.push(KEYWORDS.has(word) ? word : '$');\n      i = j;\n      continue;";
    const sabotaged =
      'tokens.push(word); // TEMP COPY sabotage — keep raw identifiers\n      i = j;\n      continue;';
    expect(source.includes(needle), 'sabotage needle must match current source').toBe(true);
    source = source.replace(needle, sabotaged);
    writeFileSync(brokenScript, source, 'utf8');

    const broken = await loadMod(brokenScript);
    const real = await loadMod(SCRIPT);

    const original = sharedLogicBlock('alpha');
    const renamed = sharedLogicBlock('beta');

    // Broken: renamed identifiers no longer normalise equal.
    expect(broken.normaliseSource(original)).not.toEqual(broken.normaliseSource(renamed));
    // Real: still equal (control).
    expect(real.normaliseSource(original)).toEqual(real.normaliseSource(renamed));

    // Full scan: broken misses the rename clone; real finds it.
    const root = makeTemp();
    writeApp(root, 'app-one', 'util.ts', `${original}\n`);
    writeApp(root, 'app-two', 'helper.ts', `${renamed}\n`);

    const brokenReport = broken.runCrossAppDuplication(root, { budget: 9999 });
    const realReport = real.runCrossAppDuplication(root, { budget: 9999 });
    expect(brokenReport.totalDuplicatedLines).toBe(0);
    expect(realReport.totalDuplicatedLines).toBeGreaterThanOrEqual(10);
  });
});

describe('what counts as a copy', () => {
  // These two carve-outs were added after unifying the in-app and cross-app
  // definitions exposed them. Both were inflating the total with code that is
  // identical because TypeScript only has one way to write it, not because
  // anyone copied anything. Without these tests the corrected definition could
  // silently regress and the ratchet would climb back with no real change.

  it('does not count a props interface plus a component signature as duplication', async () => {
    const { normaliseSource, isMostlyStyleProps, MIN_BLOCK } = await loadMod();
    const component = (name: string, prop: string) => `
interface ${name}Props {
  ${prop}: string;
  onClose: () => void;
}

export function ${name}({
  ${prop},
  onClose,
  theme,
  locale
}: ${name}Props): JSX.Element {
`;
    const a = normaliseSource(component('Header', 'title'));
    const b = normaliseSource(component('Drawer', 'label'));
    // They DO normalise to the same text — that is the point, and why the old
    // definition counted them.
    expect(a).toEqual(b);
    // But every window of them is declaration scaffolding, so none counts.
    for (let i = 0; i + MIN_BLOCK <= a.length; i++) {
      expect(isMostlyStyleProps(a.slice(i, i + MIN_BLOCK))).toBe(true);
    }
  });

  it('still counts real logic that was copied and renamed', async () => {
    const { normaliseSource, isMostlyStyleProps, MIN_BLOCK } = await loadMod();
    const logic = (v: string) => `
export function run(${v}: number[]): number {
  let total = 0;
  for (const item of ${v}) {
    if (item < 0) {
      throw new Error('negative value');
    }
    total += item * 2;
  }
  return total;
}
`;
    const a = normaliseSource(logic('values'));
    const b = normaliseSource(logic('items'));
    expect(a).toEqual(b);
    // At least one window must survive the carve-out, or the check is blind.
    const surviving = Array.from({ length: a.length - MIN_BLOCK + 1 }, (_, i) =>
      isMostlyStyleProps(a.slice(i, i + MIN_BLOCK))
    ).filter((skipped) => !skipped);
    expect(surviving.length).toBeGreaterThan(0);
  });

  it('drops a multi-line import statement, not just its first line', async () => {
    const { normaliseSource } = await loadMod();
    const lines = normaliseSource(
      "import {\n  alpha,\n  beta,\n  gamma\n} from './styles';\n\nconst total = alpha + beta;\n"
    );
    // The `} from './styles';` tail used to survive, and its module specifier is
    // a real string literal, which made a pure-import block look substantive.
    expect(lines.some((l) => l.includes('./styles'))).toBe(false);
    expect(lines).toEqual(['const $ = $ + $ ;']);
  });
});
