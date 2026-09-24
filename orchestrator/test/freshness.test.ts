import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { findStaleVerdicts, gitBundleProbe, gitChangeProbe, verdictScope, isGateOutput } from '../src/gate/freshness';
import type { Verdict } from '../src/schemas/verdicts';
import { dirtyFiles } from '../src/gate/provenance';
import { bundleHashOfApp } from '../scripts/lib/verdict-freshness.mjs';

/** A bundle hash that is long enough for the schema and stable in stubs. */
const BUNDLE_A = 'a'.repeat(64);
/** A different bundle hash. Same length so a prefix compare cannot collide. */
const BUNDLE_B = 'b'.repeat(64);

/**
 * Build a verdict with sane defaults so each test states only what it varies.
 * @param over Fields to override.
 * @returns A complete verdict.
 */
function verdict(over: Partial<Verdict> = {}): Verdict {
  return {
    ruleId: 'fe-light-dark',
    passed: true,
    method: 'visual',
    evidence: ['evidence/screenshots/a.png'],
    note: 'toggle verified in both directions',
    reviewedAt: '2026-07-23T06:15:18Z',
    reviewedCommit: 'bbfb26de9443bfccf1966613dec67bd82ea6ab77',
    ...over
  };
}

describe('verdict freshness', () => {
  it('keeps a verdict whose reviewed scope has not changed since it was recorded', () => {
    const stale = findStaleVerdicts(
      [verdict()],
      () => ['app-builder'],
      () => []
    );
    expect(stale).toEqual([]);
  });

  it('marks a verdict stale when a file in its scope changed since the review', () => {
    const stale = findStaleVerdicts(
      [verdict()],
      () => ['app-builder'],
      () => ['app-builder/src/components/Wizard.tsx']
    );
    expect(stale).toHaveLength(1);
    expect(stale[0]?.ruleId).toBe('fe-light-dark');
    expect(stale[0]?.changedFiles).toContain('app-builder/src/components/Wizard.tsx');
  });

  it('marks a verdict stale when its commit cannot be resolved in this repository', () => {
    // A probe returning null means "I cannot tell". Unknown is a failure, never a
    // silent pass: an unresolvable commit is exactly how a fabricated or
    // rebased-away verdict would look.
    const stale = findStaleVerdicts(
      [verdict()],
      () => ['app-builder'],
      () => null
    );
    expect(stale).toHaveLength(1);
    expect(stale[0]?.reason).toMatch(/not resolvable/i);
  });

  it('reports every stale verdict, not just the first', () => {
    const stale = findStaleVerdicts(
      [verdict({ ruleId: 'fe-light-dark' }), verdict({ ruleId: 'fe-premium-nav' })],
      () => ['app-builder'],
      () => ['app-builder/src/theme.css']
    );
    expect(stale.map((s) => s.ruleId)).toEqual(['fe-light-dark', 'fe-premium-nav']);
  });

  it('honours an explicit narrower scope on the verdict', () => {
    // A judge verdict about a single module should not be invalidated by an
    // unrelated edit elsewhere in the app, otherwise every verdict expires on
    // every commit and the whole mechanism gets waived out of frustration.
    const v = verdict({
      ruleId: 'u-conc-idiomatic',
      method: 'judge',
      scope: ['app-builder/src/lib']
    });
    expect(verdictScope(v, 'app-builder')).toEqual(['app-builder/src/lib']);
  });

  it('defaults an unscoped verdict to the whole app directory', () => {
    expect(verdictScope(verdict(), 'app-builder')).toEqual(['app-builder']);
  });

  it('keeps a visual verdict fresh when the bundle hash is unchanged after a source edit', () => {
    // The input that failed on the pre-change freshness.ts: the probe reports
    // a source file and the bundle probe reports the same hash. That must not
    // be stale. A source-tree check would return one stale verdict here.
    const stale = findStaleVerdicts(
      [verdict({ method: 'visual', bundleHash: BUNDLE_A, ruleId: 'fe-premium-nav' })],
      () => ['app'],
      () => ['app/src/lib/prd/generate.ts'],
      () => BUNDLE_A
    );
    expect(stale).toEqual([]);
  });

  it('marks a bundle-bound visual verdict stale when the bundle hash changes', () => {
    // Source probe is empty on purpose. If freshness ignored the bundle and
    // only looked at git, this would stay fresh — which is the wrong answer.
    const stale = findStaleVerdicts(
      [verdict({ method: 'visual', bundleHash: BUNDLE_A, ruleId: 'fe-premium-nav' })],
      () => ['app'],
      () => [],
      () => BUNDLE_B
    );
    expect(stale).toHaveLength(1);
    expect(stale[0]?.reason).toMatch(/built bundle changed/i);
  });

  it('marks a bundle-bound visual verdict stale when the build cannot be read', () => {
    const stale = findStaleVerdicts(
      [verdict({ method: 'visual', bundleHash: BUNDLE_A, ruleId: 'fe-premium-nav' })],
      () => ['app'],
      () => [],
      () => null
    );
    expect(stale).toHaveLength(1);
    expect(stale[0]?.reason).toMatch(/could not be read/i);
  });

  it('still stales a visual verdict that recorded no bundle hash when source changes', () => {
    const stale = findStaleVerdicts(
      [verdict({ method: 'visual', ruleId: 'fe-premium-nav' })],
      () => ['app'],
      () => ['app/src/a.ts'],
      () => BUNDLE_A
    );
    expect(stale).toHaveLength(1);
    expect(stale[0]?.changedFiles).toContain('app/src/a.ts');
  });

  it('does not let a bundle hash keep a judge verdict fresh', () => {
    const stale = findStaleVerdicts(
      [
        verdict({
          method: 'judge',
          ruleId: 'u-conc-idiomatic',
          bundleHash: BUNDLE_A,
          scope: ['app/src/lib']
        })
      ],
      (v) => v.scope ?? ['app'],
      () => ['app/src/lib/a.ts'],
      () => BUNDLE_A
    );
    expect(stale).toHaveLength(1);
  });
});

describe('visual freshness follows the built bundle, not a source-only commit', () => {
  /**
   * Init a temp git repo with an identity, on branch main.
   * @param prefix - mkdtemp prefix.
   * @returns Absolute path.
   */
  function initRepo(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    const git = (args: string[]): void => {
      const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
      if (result.status !== 0) {
        throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
      }
    };
    git(['init', '-q']);
    git(['config', 'user.email', 't@t']);
    git(['config', 'user.name', 't']);
    git(['checkout', '-q', '-b', 'main']);
    return dir;
  }

  /**
   * Write, stage, and commit one file.
   * @param repo - Repo root.
   * @param rel - Repo-relative path.
   * @param body - File contents.
   * @param subject - Commit subject.
   */
  function commitFile(repo: string, rel: string, body: string, subject: string): void {
    const full = join(repo, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body, 'utf8');
    const add = spawnSync('git', ['add', rel], { cwd: repo, encoding: 'utf8' });
    if (add.status !== 0) throw new Error(add.stderr || 'git add failed');
    const commit = spawnSync('git', ['commit', '-qm', subject], { cwd: repo, encoding: 'utf8' });
    if (commit.status !== 0) throw new Error(commit.stderr || 'git commit failed');
  }

  it('stays fresh after a source-only commit and goes stale when the bundle bytes change', () => {
    const repo = initRepo('redanvil-bundle-fresh-');
    try {
      commitFile(repo, 'dist/assets/index-aaa.js', 'console.log("v1")\n', 'build');
      commitFile(repo, 'dist/assets/index-aaa.css', 'body{color:#111}\n', 'styles');
      commitFile(repo, 'src/a.ts', 'export const a = 1;\n', 'source');
      const reviewed = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
      const hash = bundleHashOfApp(repo);
      expect(hash).not.toBeNull();
      commitFile(repo, 'src/b.ts', 'export const b = 2;\n', 'source only');

      const visual = verdict({
        method: 'visual',
        ruleId: 'fe-premium-nav',
        reviewedCommit: reviewed,
        bundleHash: hash ?? undefined
      });
      const fresh = findStaleVerdicts(
        [visual],
        () => ['.'],
        gitChangeProbe(repo),
        gitBundleProbe(repo, '.')
      );
      expect(fresh).toEqual([]);

      writeFileSync(join(repo, 'dist/assets/index-aaa.js'), 'console.log("v2")\n', 'utf8');
      const moved = findStaleVerdicts(
        [visual],
        () => ['.'],
        gitChangeProbe(repo),
        gitBundleProbe(repo, '.')
      );
      expect(moved).toHaveLength(1);
      expect(moved[0]?.reason).toMatch(/built bundle changed/i);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe('the gate does not invalidate its own verdicts by running', () => {
  // Scoring an app WRITES to it: the ratchet records a new high-water mark and
  // u-api-real-output saves the traffic it captured. Those writes were counted
  // as "the subject changed since review", so every verdict dropped as stale the
  // moment the gate ran — measure, stamp, gate, and the gate undoes the stamp.
  // No ordering fixes that; the loop cannot converge.

  it('ignores artifacts the gate emitted while scoring', () => {
    expect(isGateOutput('app-builder/.redanvil/coverage-state.json')).toBe(true);
    expect(isGateOutput('app-builder/evidence/api-live-app-builder.json')).toBe(true);
    expect(isGateOutput('evidence/design-app-builder.json')).toBe(true);
  });

  it('still counts real source edits, which is the whole point of the rule', () => {
    // The exclusion has to be narrow. Widened to all of .redanvil/ or any .json,
    // it would silently stop noticing the edits it exists to notice.
    expect(isGateOutput('app-builder/src/i18n/legalPages.ts')).toBe(false);
    expect(isGateOutput('app-builder/.redanvil/claims.json')).toBe(false);
    expect(isGateOutput('app-builder/src/components/ThemeToggle.tsx')).toBe(false);
    expect(isGateOutput('app-builder/package.json')).toBe(false);
  });
});

describe('a gate run does not report its own writes as uncommitted work', () => {
  it('ignores the artifacts the run produced', () => {
    const status = [
      ' M app-builder/.redanvil/coverage-state.json',
      ' M app-builder/evidence/api-live-app-builder.json',
      ' M results/app-builder.json'
    ].join('\n');
    expect(dirtyFiles(status)).toEqual([]);
  });

  it('still reports a real uncommitted source edit', () => {
    // Without this the exclusion would quietly retire the guarantee: a score
    // describes a commit only when the tree matches that commit.
    const status = ' M app-builder/src/i18n/legalPages.ts\n M results/app-builder.json';
    expect(dirtyFiles(status)).toEqual(['app-builder/src/i18n/legalPages.ts']);
  });

  it('follows a rename to the path that exists now', () => {
    expect(dirtyFiles('R  a/old.ts -> a/new.ts')).toEqual(['a/new.ts']);
  });
});

describe('freshBuildBundleProbe', () => {
  it('builds before hashing, once, and fails closed when the build fails', async () => {
    const { freshBuildBundleProbe } = await import('../src/gate/freshness');
    let builds = 0;
    const failing = freshBuildBundleProbe('.', 'no-such-app', () => {
      builds += 1;
      return false;
    });
    expect(failing()).toBeNull();
    expect(failing()).toBeNull();
    expect(builds).toBe(1);
  });
});
