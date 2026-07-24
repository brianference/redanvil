/**
 * Pass / fail / N/A tests for orchestrator/scripts/checks/ci-actionlint.mjs.
 * Fixtures are temp git repos (mirrors checks.test.ts CI fixtures) and cleaned after each test.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/checks/ci-actionlint.mjs', import.meta.url));
const node = process.execPath;

/** Full-commit pin used in good fixtures (actions/checkout v4). */
const CHECKOUT_SHA = '11bd71901bbe5b1630ceea73d27597364c9af683';

/** Temp dirs created this file; cleaned in afterEach. */
const tempDirs: string[] = [];

/**
 * Create a unique temp app directory and track it for cleanup.
 * @returns Absolute path to the empty app root.
 */
function makeAppDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'redanvil-actionlint-'));
  tempDirs.push(dir);
  return dir;
}

/**
 * Write a file under appDir, creating parent directories as needed.
 * @param appDir App root.
 * @param relPath Path relative to app root.
 * @param body File contents.
 * @returns Absolute path written.
 */
function write(appDir: string, relPath: string, body: string): string {
  const full = join(appDir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, 'utf8');
  return full;
}

/**
 * Init a git repo, add all files, and commit.
 * @param appDir App root that becomes the git root.
 * @param message Commit message.
 */
function gitCommitAll(appDir: string, message: string): void {
  const run = (args: string[]) => spawnSync('git', args, { cwd: appDir, encoding: 'utf8' });
  run(['init', '-q']);
  run(['add', '-A']);
  run(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', message]);
}

/**
 * Write a workflow, git-init, and commit (same pattern as checks.test.ts).
 * @param app App root.
 * @param yml Workflow body.
 */
function commitWorkflow(app: string, yml: string): void {
  write(app, '.github/workflows/ci.yml', yml);
  gitCommitAll(app, 'wf');
}

/**
 * Run ci-actionlint.mjs against an app directory.
 * @param appDir App root.
 * @returns Child-process result with status and stderr.
 */
function runLint(appDir: string) {
  return spawnSync(node, [SCRIPT, appDir], {
    encoding: 'utf8',
    env: process.env
  });
}

/** A workflow that satisfies every structural rule this check enforces. */
function goodWorkflow(): string {
  return [
    'name: ci',
    'on: push',
    'permissions:',
    '  contents: read',
    'jobs:',
    '  build:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    `      - uses: actions/checkout@${CHECKOUT_SHA} # v4`,
    '        with:',
    '          persist-credentials: false',
    '      - run: echo hi',
    ''
  ].join('\n');
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) break;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
});

describe('ci-actionlint', () => {
  it('PASS: good workflow (SHA-pinned, permissions, no injection) exits 0', () => {
    const app = makeAppDir();
    commitWorkflow(app, goodWorkflow());
    const r = runLint(app);
    expect(r.status, r.stderr).toBe(0);
  });

  it('FAIL: unpinned uses: tag exits 1 with actionable message', () => {
    const app = makeAppDir();
    commitWorkflow(
      app,
      [
        'on: push',
        'permissions:',
        '  contents: read',
        'jobs:',
        '  b:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '        with:',
        '          persist-credentials: false',
        '      - run: echo hi',
        ''
      ].join('\n')
    );
    const r = runLint(app);
    expect(r.status, r.stderr).toBe(1);
    expect(r.stderr).toMatch(/unpinned/i);
    expect(r.stderr).toMatch(/actions\/checkout@v4/);
  });

  it('FAIL: missing top-level permissions exits 1', () => {
    const app = makeAppDir();
    commitWorkflow(
      app,
      [
        'on: push',
        'jobs:',
        '  b:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        `      - uses: actions/checkout@${CHECKOUT_SHA}`,
        '        with:',
        '          persist-credentials: false',
        '      - run: echo hi',
        ''
      ].join('\n')
    );
    const r = runLint(app);
    expect(r.status, r.stderr).toBe(1);
    expect(r.stderr).toMatch(/permissions/i);
  });

  it('FAIL: permissions write-all exits 1', () => {
    const app = makeAppDir();
    commitWorkflow(
      app,
      [
        'on: push',
        'permissions: write-all',
        'jobs:',
        '  b:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        `      - uses: actions/checkout@${CHECKOUT_SHA}`,
        '        with:',
        '          persist-credentials: false',
        '      - run: echo hi',
        ''
      ].join('\n')
    );
    const r = runLint(app);
    expect(r.status, r.stderr).toBe(1);
    expect(r.stderr).toMatch(/write-all/);
  });

  it('FAIL: untrusted ${{ }} in run: exits 1', () => {
    const app = makeAppDir();
    commitWorkflow(
      app,
      [
        'on: issues',
        'permissions:',
        '  contents: read',
        'jobs:',
        '  b:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        `      - uses: actions/checkout@${CHECKOUT_SHA}`,
        '        with:',
        '          persist-credentials: false',
        '      - run: echo ${{ github.event.issue.title }}',
        ''
      ].join('\n')
    );
    const r = runLint(app);
    expect(r.status, r.stderr).toBe(1);
    expect(r.stderr).toMatch(/interpolat|injection|untrusted/i);
  });

  it('FAIL: missing on:/jobs: structure exits 1', () => {
    const app = makeAppDir();
    commitWorkflow(app, 'name: not-a-workflow\nfoo: bar\n');
    const r = runLint(app);
    expect(r.status, r.stderr).toBe(1);
    expect(r.stderr).toMatch(/structure|on:|jobs:/i);
  });

  it('N/A: app with no workflows exits 3', () => {
    const app = makeAppDir();
    write(app, 'src/x.ts', 'export const x = 1;\n');
    gitCommitAll(app, 'x');
    const r = runLint(app);
    expect(r.status, r.stderr).toBe(3);
    expect(r.stderr).toMatch(/n\/a:.*workflow/i);
  });

  it('exports runCiActionlint for parent wiring', async () => {
    const mod = await import(SCRIPT);
    expect(typeof mod.runCiActionlint).toBe('function');
  });
});
