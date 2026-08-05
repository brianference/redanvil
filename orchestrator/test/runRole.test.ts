import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  runRole,
  buildRoleBrief,
  scrubEnv,
  assertRoleWorkDir,
  RoleWorktreeError
} from '../src/team/runRole';
import { getRole, type Role } from '../src/team/roles';
import {
  artifactPathPrefix,
  buildAssignment,
  missingArtifacts,
  resolveRoleArtifacts
} from '../src/team/worktreeEnforcement';

/**
 * runRole is the boundary where "the agent said it finished" stops being
 * accepted. Everything here exists to prove that boundary holds.
 */
describe('runRole', () => {
  const engineer = getRole('engineer')!;
  /**
   * Artifact-contract tests use a needsWorktree:false clone so they isolate
   * the artifact decision from worktree enforcement (tested separately).
   */
  const engineerLocal: Role = { ...engineer, needsWorktree: false };

  /**
   * A temp working directory.
   *
   * @returns Directory and cleanup.
   */
  async function workDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
    const dir = await mkdtemp(join(tmpdir(), 'redanvil-role-'));
    return { dir, cleanup: async () => rm(dir, { recursive: true, force: true }) };
  }

  it('counts a role as NOT RUN when it exits 0 but leaves no artifact (known-bad)', async () => {
    // THE test. An agent that exits 0 and reports success while producing
    // nothing is the exact failure the artifact contract exists to catch. If
    // this ever passes as "ran", the contract is decorative.
    const { dir, cleanup } = await workDir();
    const res = await runRole(
      { role: engineerLocal, rows: [{ id: 'A1', status: 'fail' }] },
      1,
      { workDir: dir, slug: 'x' },
      {
        writeBrief: () => undefined,
        spawn: () => ({ code: 0, out: 'All done! I have implemented everything.' })
      }
    );

    expect(res.exitCode).toBe(0);
    expect(res.countedAsRun).toBe(false);
    expect(res.missing).toContain('src/index.ts');
    expect(res.reason).toMatch(/NOT RUN/);
    await cleanup();
  });

  it('(a) exit 0, artifacts present but UNCHANGED from pre-run → countedAsRun false', async () => {
    // THE bug: pre-existing legal/pages files (or engineer src) made presence
    // checks pass while the role changed nothing.
    const { dir, cleanup } = await workDir();
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src', 'index.ts'), 'export const app = 1;\n');

    const res = await runRole(
      { role: engineerLocal, rows: [{ id: 'A1', status: 'fail' }] },
      1,
      { workDir: dir, slug: 'x' },
      {
        writeBrief: () => undefined,
        spawn: () => ({ code: 0, out: 'All done! (but I touched nothing)' })
      }
    );

    expect(res.exitCode).toBe(0);
    expect(res.missing).toEqual([]);
    expect(res.unchanged).toContain('src/index.ts');
    expect(res.countedAsRun).toBe(false);
    expect(res.reason).toMatch(/did not change|NOT RUN/i);
    await cleanup();
  });

  it('(b) role creates a missing artifact → countedAsRun true', async () => {
    const { dir, cleanup } = await workDir();

    const res = await runRole(
      { role: engineerLocal, rows: [{ id: 'A1', status: 'fail' }] },
      1,
      { workDir: dir, slug: 'x' },
      {
        writeBrief: () => undefined,
        spawn: (_cmd, _args, opts) => {
          const cwd = opts.cwd ?? dir;
          mkdirSync(join(cwd, 'src'), { recursive: true });
          writeFileSync(join(cwd, 'src', 'index.ts'), 'export const app = 1;\n');
          return { code: 0, out: '' };
        }
      }
    );

    expect(res.countedAsRun).toBe(true);
    expect(res.missing).toEqual([]);
    expect(res.unchanged).toEqual([]);
    await cleanup();
  });

  it('(c) role edits an existing artifact with real new content → countedAsRun true', async () => {
    const { dir, cleanup } = await workDir();
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src', 'index.ts'), 'export const app = 0;\n');

    const res = await runRole(
      { role: engineerLocal, rows: [{ id: 'A1', status: 'fail' }] },
      1,
      { workDir: dir, slug: 'x' },
      {
        writeBrief: () => undefined,
        spawn: (_cmd, _args, opts) => {
          const cwd = opts.cwd ?? dir;
          writeFileSync(join(cwd, 'src', 'index.ts'), 'export const app = 42; // real edit\n');
          return { code: 0, out: '' };
        }
      }
    );

    expect(res.countedAsRun).toBe(true);
    expect(res.unchanged).toEqual([]);
    await cleanup();
  });

  it('(d) role rewrites an artifact with identical bytes → countedAsRun false', async () => {
    const { dir, cleanup } = await workDir();
    const body = 'export const app = 1;\n';
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src', 'index.ts'), body);

    const res = await runRole(
      { role: engineerLocal, rows: [] },
      1,
      { workDir: dir, slug: 'x' },
      {
        writeBrief: () => undefined,
        spawn: (_cmd, _args, opts) => {
          const cwd = opts.cwd ?? dir;
          // No-op rewrite: same bytes as before.
          writeFileSync(join(cwd, 'src', 'index.ts'), body);
          return { code: 0, out: 'rewrote the file' };
        }
      }
    );

    expect(res.exitCode).toBe(0);
    expect(res.missing).toEqual([]);
    expect(res.unchanged).toContain('src/index.ts');
    expect(res.countedAsRun).toBe(false);
    await cleanup();
  });

  it('(e) non-zero exit → still countedAsRun false (unchanged behaviour)', async () => {
    const { dir, cleanup } = await workDir();

    const res = await runRole(
      { role: engineerLocal, rows: [] },
      1,
      { workDir: dir, slug: 'x' },
      {
        writeBrief: () => undefined,
        spawn: (_cmd, _args, opts) => {
          const cwd = opts.cwd ?? dir;
          mkdirSync(join(cwd, 'src'), { recursive: true });
          writeFileSync(join(cwd, 'src', 'index.ts'), 'export const app = 1;\n');
          return { code: 137, out: 'killed' };
        }
      }
    );
    // Artifact created, but the agent died: still not a completed role.
    expect(res.countedAsRun).toBe(false);
    expect(res.reason).toMatch(/exited 137/);
    await cleanup();
  });

  it('counts a role as NOT RUN when the artifact exists but is empty', async () => {
    // A zero-byte file is a placeholder, not a deliverable.
    const { dir, cleanup } = await workDir();
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src', 'index.ts'), '');

    const res = await runRole(
      { role: engineerLocal, rows: [] },
      1,
      { workDir: dir, slug: 'x' },
      {
        writeBrief: () => undefined,
        spawn: (_cmd, _args, opts) => {
          // "Touch" still leaves it empty.
          const cwd = opts.cwd ?? dir;
          writeFileSync(join(cwd, 'src', 'index.ts'), '');
          return { code: 0, out: '' };
        }
      }
    );

    expect(res.countedAsRun).toBe(false);
    expect(res.missing).toContain('src/index.ts');
    await cleanup();
  });

  it('does not consult the agent output when deciding the outcome', async () => {
    // Two runs, identical on disk, wildly different self-reports. The verdict
    // must be identical — the summary carries no weight at all.
    const { dir, cleanup } = await workDir();
    const mk = (out: string) =>
      runRole({ role: engineerLocal, rows: [] }, 1, { workDir: dir, slug: 'x' }, {
        writeBrief: () => undefined,
        spawn: () => ({ code: 0, out })
      });

    const boastful = await mk('SUCCESS: shipped, verified, tested, complete.');
    const silent = await mk('');
    expect(boastful.countedAsRun).toBe(silent.countedAsRun);
    expect(boastful.countedAsRun).toBe(false);
    await cleanup();
  });

  it('names the artifacts and the unmet rows in the brief', () => {
    const brief = buildRoleBrief(
      { role: engineer, rows: [{ id: 'A5', status: 'fail', detail: 'build broke' }] },
      'my-app'
    );
    expect(brief).toContain('src/index.ts');
    expect(brief).toContain('A5');
    expect(brief).toContain('build broke');
    expect(brief).toMatch(/summary is not a deliverable/i);
  });

  it('expands <slug> in artifact paths', () => {
    const qa = getRole('qa-visual')!;
    const brief = buildRoleBrief({ role: qa, rows: [] }, 'my-app');
    expect(brief).toContain('evidence/qa-visual-my-app.json');
    expect(brief).not.toContain('<slug>');
  });

  it('scrubs credential-shaped variables from the role environment', () => {
    const out = scrubEnv({
      PATH: '/usr/bin',
      CLOUDFLARE_API_TOKEN: 'secret',
      GITHUB_KEY: 'secret',
      MY_PASSWORD: 'secret',
      HOME: '/home/x'
    });
    expect(out.PATH).toBe('/usr/bin');
    expect(out.HOME).toBe('/home/x');
    expect(out.CLOUDFLARE_API_TOKEN).toBeUndefined();
    expect(out.GITHUB_KEY).toBeUndefined();
    expect(out.MY_PASSWORD).toBeUndefined();
  });

  it('(worktree) worktree-role given a non-worktree workDir FAILS loudly', async () => {
    // Enforcement: needsWorktree roles are impossible to run outside a linked
    // worktree. A plain temp dir is not isolation.
    const { dir, cleanup } = await workDir();
    expect(() => assertRoleWorkDir(engineer, dir)).toThrow(RoleWorktreeError);
    await expect(
      runRole(
        { role: engineer, rows: [] },
        1,
        { workDir: dir, slug: 'x' },
        {
          writeBrief: () => undefined,
          spawn: () => {
            throw new Error('spawn must not run when worktree enforcement fails');
          }
        }
      )
    ).rejects.toThrow(RoleWorktreeError);
    await cleanup();
  });
});

describe('runRole vs pre-commit path agreement (f)', () => {
  it('(f) runRole and assignment/hook resolve the same absolute paths for a monorepo app', async () => {
    // Reproduces the observed disagreement:
    //   runRole used workDir=app-builder → <wt>/app-builder/src/pages/Terms.tsx
    //   pre-commit used worktree root    → <wt>/src/pages/Terms.tsx
    // Both must now use worktree root + repo-relative (prefixed) paths.
    const worktreeRoot = await mkdtemp(join(tmpdir(), 'ra-path-agree-'));
    const appRel = 'app-builder';
    const appDir = join(worktreeRoot, appRel);
    await mkdir(join(appDir, 'src', 'pages'), { recursive: true });

    const content = getRole('content')!;
    const pathPrefix = artifactPathPrefix(worktreeRoot, appDir);
    expect(pathPrefix).toBe('app-builder');

    const assignment = buildAssignment(content, 'app-builder', ['D1'], { pathPrefix });
    // Hook base = worktree root (git work-tree root / process.cwd() in hooks).
    const hookResolved = assignment.artifacts.map((a) => join(worktreeRoot, a));

    const res = await runRole(
      { role: { ...content, needsWorktree: false }, rows: [] },
      1,
      {
        workDir: appDir,
        slug: 'app-builder',
        artifactRoot: worktreeRoot,
        artifactPathPrefix: pathPrefix
      },
      {
        writeBrief: () => undefined,
        spawn: () => ({ code: 0, out: '' })
      }
    );

    const runRoleResolved = res.artifacts.map((a) => join(res.artifactRoot, a));
    expect(res.artifacts).toEqual(assignment.artifacts);
    expect(res.artifactRoot).toBe(worktreeRoot);
    expect(runRoleResolved).toEqual(hookResolved);
    // And missingArtifacts with the hook's base agrees with runRole.missing.
    expect(missingArtifacts(worktreeRoot, assignment.artifacts)).toEqual(res.missing);
    // Sanity: prefixed paths, not bare src/pages under the worktree root.
    expect(assignment.artifacts[0]).toBe('app-builder/src/pages/Terms.tsx');
    expect(resolveRoleArtifacts(content.artifacts, 'app-builder', pathPrefix)).toEqual(
      assignment.artifacts
    );

    await rm(worktreeRoot, { recursive: true, force: true });
  });
});
