/**
 * Known-answer fixtures for the independent judge-over-diff loop step.
 *
 * A silent empty pass is forbidden: foundNothingExplicit must be set when
 * findings are empty. Failures need file:line citations.
 *
 * Also covers merge-commit collectDiff (first-parent patch) and the explicit
 * empty-diff terminal state (nothing to review ≠ reviewed and clean).
 */
import { describe, it, expect } from 'vitest';
import {
  buildRefutePrompt,
  collectDiff,
  evaluateReviewOk,
  hashDiff,
  headParents,
  independentReviewOkFromReport,
  parseJudgeJson,
  readJudgeDiffReport,
  runIndependentDiffReview,
  type IndependentReviewReport
} from '../src/loop/independentReview';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

/**
 * Init a temp git repo with identity configured (quiet).
 *
 * @param prefix - mkdtemp prefix.
 * @returns Absolute repo path.
 */
function initGitRepo(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  spawnSync('git', ['init', '-q'], { cwd: dir });
  spawnSync('git', ['config', 'user.email', 't@t'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 't'], { cwd: dir });
  // Avoid "main vs master" surprises in fixtures.
  spawnSync('git', ['checkout', '-q', '-b', 'main'], { cwd: dir });
  return dir;
}

/**
 * Run git in a fixture repo; throw on non-zero so tests fail loud.
 *
 * @param dir - Repo cwd.
 * @param args - git argv after `git`.
 * @returns stdout.
 */
function git(dir: string, args: string[]): string {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  }
  return (r.stdout ?? '').trim();
}

describe('independentReview pure helpers', () => {
  it('requires foundNothingExplicit when findings are empty', () => {
    const base: IndependentReviewReport = {
      kind: 'independent-diff-review',
      slug: 'demo',
      commit: 'abc',
      reviewedAt: new Date().toISOString(),
      diffHash: 'x'.repeat(64),
      completed: true,
      ok: false,
      foundNothingExplicit: false,
      findings: [],
      rawExcerpt: '',
      mode: 'fixture'
    };
    expect(evaluateReviewOk(base)).toBe(false);
    expect(evaluateReviewOk({ ...base, foundNothingExplicit: true })).toBe(true);
  });

  it('fails when any finding has passed === false', () => {
    const report: IndependentReviewReport = {
      kind: 'independent-diff-review',
      slug: 'demo',
      commit: 'abc',
      reviewedAt: new Date().toISOString(),
      diffHash: 'y'.repeat(64),
      completed: true,
      ok: false,
      foundNothingExplicit: false,
      findings: [
        {
          title: 'hardcoded hero',
          citation: 'src/theme.css:21',
          detail: 'hero stays dark',
          passed: false
        }
      ],
      rawExcerpt: '',
      mode: 'fixture'
    };
    expect(evaluateReviewOk(report)).toBe(false);
  });

  it('hashes the exact diff the judge sees', () => {
    const a = hashDiff('diff --git a/x b/x\n+hello\n');
    const b = hashDiff('diff --git a/x b/x\n+hello\n');
    const c = hashDiff('diff --git a/x b/x\n+hello!\n');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('puts the real diff into the prompt, not a summary', () => {
    const diff = 'diff --git a/src/App.tsx b/src/App.tsx\n+export const X = 1;\n';
    const prompt = buildRefutePrompt('demo-app', 'deadbeef', diff);
    expect(prompt).toContain(diff);
    expect(prompt).toMatch(/REFUTE/i);
    expect(prompt).toMatch(/foundNothingExplicit/);
    expect(prompt).not.toMatch(/summary of the diff/i);
  });

  it('parses judge JSON and tolerates surrounding prose', () => {
    const raw = `Here is my review:\n{"foundNothingExplicit":true,"findings":[]}\nThanks.`;
    const parsed = parseJudgeJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.foundNothingExplicit).toBe(true);
    expect(parsed?.findings).toEqual([]);
  });
});

describe('independentReview fixture mode (known-answer)', () => {
  it('writes a report bound to the commit and fails when findings refute', () => {
    const dir = initGitRepo('redanvil-review-');
    try {
      writeFileSync(join(dir, 'a.txt'), 'a\n');
      git(dir, ['add', 'a.txt']);
      git(dir, ['commit', '-qm', 'init']);

      const outPath = join(dir, 'evidence', 'judge-diff-test.json');
      const report = runIndependentDiffReview({
        dir,
        outPath,
        fixtureReport: {
          foundNothingExplicit: false,
          findings: [
            {
              title: 'missing test',
              citation: 'a.txt:1',
              detail: 'no coverage',
              passed: false
            }
          ]
        }
      });
      expect(report.ok).toBe(false);
      expect(report.findings).toHaveLength(1);
      expect(report.commit.length).toBeGreaterThan(6);
      expect(report.diffHash).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('accepts an explicit found-nothing report', () => {
    const dir = initGitRepo('redanvil-review-ok-');
    try {
      writeFileSync(join(dir, 'a.txt'), 'a\n');
      git(dir, ['add', 'a.txt']);
      git(dir, ['commit', '-qm', 'init']);

      const report = runIndependentDiffReview({
        dir,
        outPath: join(dir, 'evidence', 'judge-diff-ok.json'),
        fixtureReport: {
          foundNothingExplicit: true,
          findings: []
        }
      });
      expect(report.ok).toBe(true);
      expect(report.foundNothingExplicit).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('readJudgeDiffReport + independentReviewOkFromReport are commit-pinned', () => {
    const dir = initGitRepo('redanvil-review-load-');
    try {
      writeFileSync(join(dir, 'a.txt'), 'a\n');
      git(dir, ['add', 'a.txt']);
      git(dir, ['commit', '-qm', 'init']);
      const head = git(dir, ['rev-parse', 'HEAD']);
      const slug = 'load-app';
      const outPath = join(dir, 'evidence', `judge-diff-${slug}.json`);
      const written = runIndependentDiffReview({
        dir,
        outPath,
        fixtureReport: { foundNothingExplicit: true, findings: [] }
      });
      expect(written.ok).toBe(true);
      // slug from basename(dir) would differ; read by the path we wrote.
      const loaded = readJudgeDiffReport(dir, slug);
      expect(loaded).not.toBeNull();
      expect(independentReviewOkFromReport(loaded, head)).toBe(true);
      expect(independentReviewOkFromReport(loaded, '0'.repeat(40))).toBe(false);
      expect(independentReviewOkFromReport(null, head)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('collectDiff merge commits (first-parent)', () => {
  it('returns a non-empty first-parent patch on a merge HEAD (clean tree)', () => {
    const dir = initGitRepo('redanvil-merge-diff-');
    try {
      writeFileSync(join(dir, 'base.txt'), 'base\n');
      git(dir, ['add', 'base.txt']);
      git(dir, ['commit', '-qm', 'base']);

      // Feature branch with a real change.
      git(dir, ['checkout', '-qb', 'feature']);
      writeFileSync(join(dir, 'feature.txt'), 'from feature\n');
      git(dir, ['add', 'feature.txt']);
      git(dir, ['commit', '-qm', 'feature work']);

      // Merge back onto main (creates a two-parent commit at HEAD).
      git(dir, ['checkout', '-q', 'main']);
      // No-ff so HEAD is always a merge commit even with fast-forward possible.
      git(dir, ['merge', '--no-ff', '-m', 'merge feature', 'feature']);

      const parents = headParents(dir);
      expect(parents.length).toBeGreaterThan(1);

      // Reproduce the bug: plain show --patch is empty on this merge.
      const plainShow = spawnSync(
        'git',
        ['show', '--format=', '--patch', 'HEAD'],
        { cwd: dir, encoding: 'utf8' }
      ).stdout;
      expect(plainShow.trim().length).toBe(0);

      const diff = collectDiff(dir);
      expect(diff.trim().length).toBeGreaterThan(0);
      // First-parent content: the feature file addition is in the patch.
      expect(diff).toMatch(/feature\.txt/);
      // Same shape as explicit first-parent diff (byte-stable check).
      const expected = spawnSync('git', ['diff', parents[0]!, 'HEAD'], {
        cwd: dir,
        encoding: 'utf8'
      }).stdout;
      expect(diff).toBe(expected);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('non-merge clean-tree path still uses git show --patch (unchanged)', () => {
    const dir = initGitRepo('redanvil-nonmerge-diff-');
    try {
      writeFileSync(join(dir, 'only.txt'), 'line one\n');
      git(dir, ['add', 'only.txt']);
      git(dir, ['commit', '-qm', 'root']);
      // Second commit so HEAD has exactly one parent (not a root, not a merge).
      writeFileSync(join(dir, 'only.txt'), 'line two\n');
      git(dir, ['add', 'only.txt']);
      git(dir, ['commit', '-qm', 'single parent commit']);

      // Non-merge: 0 parents (root) or 1 parent — never more than one.
      expect(headParents(dir)).toHaveLength(1);

      const fromCollect = collectDiff(dir);
      const fromShow = spawnSync(
        'git',
        ['show', '--format=', '--patch', 'HEAD'],
        { cwd: dir, encoding: 'utf8' }
      ).stdout;
      expect(fromCollect).toBe(fromShow);
      expect(fromCollect.trim().length).toBeGreaterThan(0);
      expect(fromCollect).toMatch(/only\.txt/);
      expect(fromCollect).toMatch(/line two/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('working-tree changes still win over HEAD patch', () => {
    const dir = initGitRepo('redanvil-wt-diff-');
    try {
      writeFileSync(join(dir, 'a.txt'), 'a\n');
      git(dir, ['add', 'a.txt']);
      git(dir, ['commit', '-qm', 'init']);
      writeFileSync(join(dir, 'a.txt'), 'a-modified\n');

      const diff = collectDiff(dir);
      expect(diff).toMatch(/a-modified/);
      // Not the committed blob content alone.
      expect(diff).toMatch(/^-a$/m);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('empty-diff explicit fail-closed state', () => {
  it('records nothingToReview / empty-diff and keeps independentReviewOk false', () => {
    const dir = initGitRepo('redanvil-empty-diff-');
    try {
      // Empty commit: clean tree + HEAD has no patch.
      git(dir, ['commit', '--allow-empty', '-qm', 'empty root']);
      expect(collectDiff(dir).trim()).toBe('');

      // Even a fixtureReport must not paper over empty — F5 hole otherwise.
      const report = runIndependentDiffReview({
        dir,
        outPath: join(dir, 'evidence', 'judge-diff-empty.json'),
        fixtureReport: {
          foundNothingExplicit: true,
          findings: [],
          ok: true
        }
      });

      expect(report.mode).toBe('empty-diff');
      expect(report.nothingToReview).toBe(true);
      expect(report.completed).toBe(true);
      expect(report.ok).toBe(false);
      expect(report.foundNothingExplicit).toBe(false);
      expect(report.findings.some((f) => f.title === 'nothing to review' && f.passed === false)).toBe(
        true
      );
      expect(evaluateReviewOk(report)).toBe(false);
      expect(independentReviewOkFromReport(report, report.commit)).toBe(false);

      // Hand-stamping ok/foundNothingExplicit on an empty-diff body still fails.
      expect(
        evaluateReviewOk({
          ...report,
          ok: true,
          foundNothingExplicit: true,
          findings: []
        })
      ).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('evaluateReviewOk rejects nothingToReview without mode empty-diff too', () => {
    const report: IndependentReviewReport = {
      kind: 'independent-diff-review',
      slug: 'demo',
      commit: 'abc',
      reviewedAt: new Date().toISOString(),
      diffHash: 'z'.repeat(64),
      completed: true,
      ok: true,
      foundNothingExplicit: true,
      nothingToReview: true,
      findings: [],
      rawExcerpt: '',
      mode: 'fixture'
    };
    expect(evaluateReviewOk(report)).toBe(false);
  });
});
