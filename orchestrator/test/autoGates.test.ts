import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Auto-gate resolver and generator.
 *
 * Lives next to the other n8n-prototype coverage in this vitest lane so it
 * actually runs in CI. A bespoke harness beside the scripts would be the same
 * mistake verify-contracts.mjs already made: a proof layer nobody executes.
 */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUTO_DECIDE = join(REPO, 'n8n-prototype', 'roles', 'auto-decide.mjs');
const BUILD_WORKFLOW = join(REPO, 'n8n-prototype', 'build-workflow.mjs');
const WORKFLOW_JSON = join(REPO, 'n8n-prototype', 'workflows', 'redanvil-full-build.json');

/** Scratch dirs created by a test; drained in afterEach. */
const scratchDirs: string[] = [];

afterEach(() => {
  for (const d of scratchDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

/**
 * A unique scratch directory that afterEach will delete.
 * @returns absolute path
 */
function scratch(): string {
  const dir = join(tmpdir(), `redanvil-auto-gates-${process.pid}-${Date.now()}-${scratchDirs.length}`);
  mkdirSync(dir, { recursive: true });
  scratchDirs.push(dir);
  return dir;
}

/**
 * Write a file, creating parents.
 * @param root base directory
 * @param rel relative path
 * @param body file contents
 */
function put(root: string, rel: string, body: string | Buffer): void {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body);
}

/**
 * Run auto-decide.mjs as a real process. The known-bad case is this spawn,
 * not an imported function -- an in-process call cannot prove the exit code.
 * @param args axis, slug, repoRoot
 * @returns spawn result
 */
function runAutoDecide(args: { axis: string; slug: string; repoRoot: string }) {
  return spawnSync(
    process.execPath,
    [AUTO_DECIDE, `--axis=${args.axis}`, `--slug=${args.slug}`, `--repoRoot=${args.repoRoot}`],
    { encoding: 'utf8' }
  );
}

/**
 * Run the workflow generator with a specific AUTO_GATES value, or with the
 * variable deleted to prove the default path.
 * @param value env value, or undefined to unset
 * @returns spawn result
 */
function runGenerator(value: string | undefined) {
  const env = { ...process.env };
  if (value === undefined) delete env.REDANVIL_AUTO_GATES;
  else env.REDANVIL_AUTO_GATES = value;
  return spawnSync(process.execPath, [BUILD_WORKFLOW], { encoding: 'utf8', env, cwd: REPO });
}

describe('auto-decide.mjs', () => {
  it('exits non-zero on an empty design-refs directory and does not create DECISION.md (known-bad)', () => {
    // THE check that must be able to fail: inventing mark-01 when no logo was
    // generated would let 18 later steps build on a decision about nothing.
    const repoRoot = scratch();
    const slug = 'empty-app';
    const app = join(repoRoot, slug);
    mkdirSync(join(app, 'design-refs'), { recursive: true });
    const decisionPath = join(app, 'design-refs', 'logos', 'DECISION.md');

    const r = runAutoDecide({ axis: 'logo', slug, repoRoot });

    expect(r.status, `stdout=${r.stdout}\nstderr=${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/design-refs/);
    expect(r.stderr).toMatch(/logos/);
    expect(existsSync(decisionPath)).toBe(false);
  });

  it('refuses when DECISION.md EXISTS but no candidate file does, and leaves it byte-identical', () => {
    // Isolates the no-candidates guard. The test above cannot: its fixture has
    // no DECISION.md either, so deleting the candidates guard outright still
    // exits 1 via the missing-DECISION.md guard, whose message also contains
    // "design-refs" and "logos" -- every assertion there passes against a
    // resolver with no candidate check at all. Verified by deleting the guard
    // and watching all five tests stay green, which is the definition of a
    // check that cannot fail.
    //
    // Here the only thing that can refuse is the candidate count, and the
    // byte comparison is what catches a resolver that invents an id instead.
    const repoRoot = scratch();
    const slug = 'decision-but-no-marks';
    const app = join(repoRoot, slug);
    const body = '# Logo options\n\nmark-01 through mark-05 were explored.\nChoice OPEN.\n';
    put(app, 'design-refs/logos/DECISION.md', body);

    const r = runAutoDecide({ axis: 'logo', slug, repoRoot });

    expect(r.status, `stdout=${r.stdout}\nstderr=${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/no candidates in/);
    expect(readFileSync(join(app, 'design-refs/logos/DECISION.md'), 'utf8')).toBe(body);
    expect(existsSync(join(app, 'public', 'brand-mark.png'))).toBe(false);
  });

  it('a fixture with three real candidates writes CHOSEN for one of them and names the other two as alternatives', () => {
    const repoRoot = scratch();
    const slug = 'three-marks';
    const app = join(repoRoot, slug);
    put(app, 'design-refs/logos/mark-01.png', Buffer.from('mark-01-bytes'));
    put(app, 'design-refs/logos/mark-02.png', Buffer.from('mark-02-bytes'));
    put(app, 'design-refs/logos/mark-03.png', Buffer.from('mark-03-bytes'));
    put(
      app,
      'design-refs/logos/DECISION.md',
      '# Brand mark decision\n\nChoice OPEN. Candidates: mark-01, mark-02, mark-03.\n'
    );

    const r = runAutoDecide({ axis: 'logo', slug, repoRoot });
    expect(r.status, `stdout=${r.stdout}\nstderr=${r.stderr}`).toBe(0);

    const text = readFileSync(join(app, 'design-refs', 'logos', 'DECISION.md'), 'utf8');
    const chosenLine = text.split('\n').find((l) => /\*{0,2}CHOSEN\*{0,2}\s*:\s*\S+/i.test(l));
    expect(chosenLine).toBeTruthy();
    const chosen = /\*{0,2}CHOSEN\*{0,2}\s*:\s*(\S+)/i.exec(chosenLine ?? '')?.[1];
    expect(['mark-01', 'mark-02', 'mark-03']).toContain(chosen);

    const altLine = text.split('\n').find((l) => /Alternatives not taken:/i.test(l)) ?? '';
    const others = ['mark-01', 'mark-02', 'mark-03'].filter((id) => id !== chosen);
    for (const id of others) expect(altLine).toContain(id);
    expect(altLine).not.toContain(chosen);
  });

  it('leaves a DECISION.md that already has CHOSEN: mark-02 unmodified', () => {
    const repoRoot = scratch();
    const slug = 'already-chosen';
    const app = join(repoRoot, slug);
    put(app, 'design-refs/logos/mark-01.png', Buffer.from('mark-01-bytes'));
    put(app, 'design-refs/logos/mark-02.png', Buffer.from('mark-02-bytes'));
    put(app, 'design-refs/logos/mark-03.png', Buffer.from('mark-03-bytes'));
    const original =
      '# Brand mark decision\n\nCHOSEN: mark-02\n\nOwner picked mark-02. Leave this file alone.\n';
    const decisionPath = join(app, 'design-refs', 'logos', 'DECISION.md');
    put(app, 'design-refs/logos/DECISION.md', original);
    const before = readFileSync(decisionPath);

    const r = runAutoDecide({ axis: 'logo', slug, repoRoot });
    expect(r.status, `stdout=${r.stdout}\nstderr=${r.stderr}`).toBe(0);
    expect(Buffer.from(readFileSync(decisionPath)).equals(before)).toBe(true);
  });
});

describe('build-workflow.mjs auto gates', () => {
  it('with REDANVIL_AUTO_GATES unset produces zero diff against the file on disk', () => {
    const before = readFileSync(WORKFLOW_JSON);
    try {
      const env = { ...process.env };
      delete env.REDANVIL_AUTO_GATES;
      const r = runGenerator(undefined);
      expect(r.status, `stdout=${r.stdout}\nstderr=${r.stderr}`).toBe(0);
      const after = readFileSync(WORKFLOW_JSON);
      expect(after.equals(before), 'generator with AUTO_GATES unset must be byte-identical').toBe(
        true
      );
    } finally {
      writeFileSync(WORKFLOW_JSON, before);
    }
  });

  it('with REDANVIL_AUTO_GATES=1 emits auto-decide roles instead of wait nodes', () => {
    const before = readFileSync(WORKFLOW_JSON);
    try {
      const r = runGenerator('1');
      expect(r.status, `stdout=${r.stdout}\nstderr=${r.stderr}`).toBe(0);
      expect(r.stdout).toMatch(/auto gates:\s*on/i);

      const workflow = JSON.parse(readFileSync(WORKFLOW_JSON, 'utf8')) as {
        nodes: Array<{
          name: string;
          type: string;
          onError?: string;
          parameters?: { jsCode?: string; text?: string };
        }>;
      };
      const names = workflow.nodes.map((n) => n.name);
      expect(names).toContain('auto-logo params');
      expect(names).toContain('Role: auto-logo');
      expect(names).toContain('auto-palette params');
      expect(names).toContain('Role: auto-palette');
      expect(names).toContain('auto-layout params');
      expect(names).toContain('Role: auto-layout');
      expect(names).toContain('Notify: logo needs approval');
      expect(names).toContain('Notify: decide needs approval');
      expect(names).not.toContain('Owner approves: logo');
      expect(names).not.toContain('Owner approves: palette');
      expect(names).not.toContain('Owner approves: layout');
      expect(names).not.toContain('Owner approves: decide');
      expect(workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.wait')).toHaveLength(0);

      const autoLogo = workflow.nodes.find((n) => n.name === 'auto-logo params');
      expect(autoLogo?.parameters?.jsCode).toMatch(
        /auto-decide\.mjs --axis=logo --slug=\{slug\} --repoRoot=\{root\}/
      );
      expect(autoLogo?.parameters?.jsCode).toMatch(/design-refs\/logos\/DECISION\.md/);

      const notify = workflow.nodes.find((n) => n.name === 'Notify: logo needs approval');
      expect(notify?.onError).toBe('continueRegularOutput');
      expect(notify?.parameters?.text).toMatch(/auto-resolved/i);
      expect(notify?.parameters?.text).toMatch(/pending/i);
      expect(notify?.parameters?.text).not.toMatch(/needs a decision/i);
    } finally {
      writeFileSync(WORKFLOW_JSON, before);
    }
  });
});
