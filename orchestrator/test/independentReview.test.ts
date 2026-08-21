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
  aggregateChunkReviews,
  buildIndependentReviewGrokArgs,
  buildRefutePrompt,
  collectDiff,
  evaluateReviewOk,
  hashDiff,
  headParents,
  independentReviewOkFromReport,
  isScopeTruncationFinding,
  JUDGE_DIFF_JSON_SCHEMA,
  JUDGE_PROMPT_DIFF_BUDGET,
  MAX_DIFF_REVIEW_CHUNKS,
  parseJudgeJson,
  readJudgeDiffReport,
  runIndependentDiffReview,
  splitDiffByFile,
  splitDiffIntoChunks,
  splitOversizedFileSection,
  type DiffChunk,
  type IndependentReviewReport
} from '../src/loop/independentReview';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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

  it('unwraps the grok --output-format json envelope and reads model text', () => {
    // Real CLI shape (harness / independent_judge): envelope.text is the model body.
    const modelBody = JSON.stringify({
      foundNothingExplicit: false,
      findings: [
        {
          title: 'missing SOURCES',
          citation: 'README.md:1',
          detail: 'no SOURCES.md in the tree',
          passed: false
        }
      ]
    });
    const envelope = JSON.stringify({
      text: modelBody,
      stopReason: 'EndTurn',
      usage: { total_tokens: 99 },
      sessionId: '019f-test'
    });
    const parsed = parseJudgeJson(envelope);
    expect(parsed).not.toBeNull();
    expect(parsed?.foundNothingExplicit).toBe(false);
    expect(parsed?.findings).toHaveLength(1);
    expect(parsed?.findings[0]?.title).toBe('missing SOURCES');
    expect(parsed?.findings[0]?.passed).toBe(false);
  });

  it('prefers envelope.structuredOutput when --json-schema succeeds', () => {
    const envelope = JSON.stringify({
      text: 'ignored intermediate prose',
      stopReason: 'EndTurn',
      structuredOutput: {
        foundNothingExplicit: true,
        findings: []
      },
      structuredOutputError: null
    });
    const parsed = parseJudgeJson(envelope);
    expect(parsed).not.toBeNull();
    expect(parsed?.foundNothingExplicit).toBe(true);
    expect(parsed?.findings).toEqual([]);
  });

  it('takes the LAST findings body when multi-turn schema output is concatenated', () => {
    // Live grok --json-schema multi-turn: each turn's object is appended to text.
    const intermediate = JSON.stringify({
      foundNothingExplicit: false,
      findings: [
        {
          title: 'reviewing',
          citation: 'x.ts:1',
          detail: 'still looking',
          passed: false
        }
      ]
    });
    const finalBody = JSON.stringify({
      foundNothingExplicit: false,
      findings: [
        {
          title: 'real defect',
          citation: 'src/a.ts:10',
          detail: 'hardcoded secret',
          passed: false
        },
        {
          title: 'verified ok',
          citation: 'src/b.ts:2',
          detail: 'input validated',
          passed: true
        }
      ]
    });
    const envelope = JSON.stringify({
      text: intermediate + finalBody,
      stopReason: 'EndTurn'
    });
    const parsed = parseJudgeJson(envelope);
    expect(parsed).not.toBeNull();
    expect(parsed?.findings).toHaveLength(2);
    expect(parsed?.findings[0]?.title).toBe('real defect');
    expect(parsed?.findings[1]?.passed).toBe(true);
  });

  it('returns null on garbage / pure prose (fail closed — no silent pass)', () => {
    expect(parseJudgeJson('')).toBeNull();
    expect(parseJudgeJson('not json at all')).toBeNull();
    expect(parseJudgeJson('The diff looks fine to me. Ship it.')).toBeNull();
    // Envelope whose text is prose, not the findings object.
    expect(
      parseJudgeJson(
        JSON.stringify({
          text: 'I reviewed the diff and found nothing wrong. Looks good!',
          stopReason: 'EndTurn'
        })
      )
    ).toBeNull();
    // Envelope without a review body (usage-only / wrong shape).
    expect(parseJudgeJson(JSON.stringify({ stopReason: 'EndTurn', usage: {} }))).toBeNull();
    // Malformed findings listed but none well-formed → not "found nothing".
    expect(
      parseJudgeJson(
        JSON.stringify({
          foundNothingExplicit: true,
          findings: [{ title: 1, citation: 42, passed: false }]
        })
      )
    ).toBeNull();
    // Cancelled run with intermediate schema text must not become a review.
    expect(
      parseJudgeJson(
        JSON.stringify({
          text: JSON.stringify({
            foundNothingExplicit: false,
            findings: [
              {
                title: 'still looking',
                citation: 'x.ts:1',
                detail: 'inspecting',
                passed: false
              }
            ]
          }),
          stopReason: 'Cancelled',
          structuredOutput: null,
          structuredOutputError: 'model did not produce structured output'
        })
      )
    ).toBeNull();
    // structuredOutput failed even with EndTurn — fail closed.
    expect(
      parseJudgeJson(
        JSON.stringify({
          text: JSON.stringify({ foundNothingExplicit: true, findings: [] }),
          stopReason: 'EndTurn',
          structuredOutput: null,
          structuredOutputError: 'model did not produce structured output'
        })
      )
    ).toBeNull();
  });

  it('buildIndependentReviewGrokArgs uses real CLI flags only', () => {
    const argv = buildIndependentReviewGrokArgs({
      cwd: 'C:\\apps\\demo',
      promptFile: 'C:\\tmp\\REFUTE_TASK.md',
      sessionId: '019f0000-0000-4000-8000-000000000001'
    });
    // Must match how independent_judge.mjs / harness.ts invoke grok.
    expect(argv).toEqual(
      expect.arrayContaining([
        '--no-auto-update',
        '--always-approve',
        '--no-alt-screen',
        '--cwd',
        'C:\\apps\\demo',
        '-m',
        'grok-4.6',
        '--max-turns',
        '1',
        '--json-schema',
        JUDGE_DIFF_JSON_SCHEMA,
        '--prompt-file',
        'C:\\tmp\\REFUTE_TASK.md'
      ])
    );
    // The broken flags that made F5 permanently unparseable.
    expect(argv).not.toContain('--grokmodel');
    expect(argv).not.toContain('-d');
    expect(argv.indexOf('--cwd') + 1).toBe(argv.indexOf('C:\\apps\\demo'));
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

  // Recording a verdict is not a product change, and a commit containing only a
  // verdict cannot substantiate itself. While evidence stayed in scope, F5
  // reviewed whatever sat at HEAD and every evidence commit drew the same
  // finding — "an acceptance claim cannot be verified from a hand-edited
  // evidence file alone" — which made a passing review guarantee the next
  // review failed. Measured on sushi-finder 2026-08-12.
  it('skips a gate-artifact-only commit and reviews the newest product commit', () => {
    const dir = initGitRepo('redanvil-artifact-skip-');
    try {
      writeFileSync(join(dir, 'feature.ts'), 'export const answer = 42;\n');
      git(dir, ['add', 'feature.ts']);
      git(dir, ['commit', '-qm', 'feat: the real change']);

      mkdirSync(join(dir, 'evidence'), { recursive: true });
      writeFileSync(join(dir, 'evidence', 'judge-diff-x.json'), '{"verdict":"accept"}\n');
      mkdirSync(join(dir, 'results'), { recursive: true });
      writeFileSync(join(dir, 'results', 'x.json'), '{"finalScore":100}\n');
      git(dir, ['add', '-A']);
      git(dir, ['commit', '-qm', 'chore(evidence): record the verdict']);

      const diff = collectDiff(dir);
      expect(diff, 'must review the product commit').toMatch(/feature\.ts/);
      expect(diff).toMatch(/answer = 42/);
      expect(diff, 'must not review the evidence file').not.toMatch(/judge-diff-x\.json/);
      expect(diff, 'must not review the results file').not.toMatch(/"finalScore"/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('still reviews a normal commit that also touches evidence', () => {
    const dir = initGitRepo('redanvil-artifact-mixed-');
    try {
      writeFileSync(join(dir, 'seed.ts'), 'export const seed = 1;\n');
      git(dir, ['add', 'seed.ts']);
      git(dir, ['commit', '-qm', 'init']);

      writeFileSync(join(dir, 'seed.ts'), 'export const seed = 2;\n');
      mkdirSync(join(dir, 'evidence'), { recursive: true });
      writeFileSync(join(dir, 'evidence', 'note.json'), '{"a":1}\n');
      git(dir, ['add', '-A']);
      git(dir, ['commit', '-qm', 'fix: bump seed and record evidence']);

      const diff = collectDiff(dir);
      expect(diff).toMatch(/seed = 2/);
      expect(diff, 'evidence is stripped, the code change is not').not.toMatch(/note\.json/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // The same exclusion has to apply to BOTH branches of collectDiff. It was
  // added to the commit walk only, and a tree dirtied purely by regenerated
  // measurement-meta files still handed the judge an evidence-only diff, which
  // drew the identical "evidence-only re-stamp, no code" finding.
  it('a working tree dirtied only by evidence falls through to the product commit', () => {
    const dir = initGitRepo('redanvil-wt-artifact-');
    try {
      writeFileSync(join(dir, 'thing.ts'), 'export const thing = 1;\n');
      mkdirSync(join(dir, 'evidence'), { recursive: true });
      writeFileSync(join(dir, 'evidence', 'measurement-meta.json'), '{"at":"first"}\n');
      git(dir, ['add', '-A']);
      git(dir, ['commit', '-qm', 'feat: thing']);

      // Only the artifact changes in the working tree, as a test run would do.
      writeFileSync(join(dir, 'evidence', 'measurement-meta.json'), '{"at":"second"}\n');

      const diff = collectDiff(dir);
      expect(diff, 'must not review the re-stamped evidence').not.toMatch(/measurement-meta/);
      expect(diff, 'falls through to the product commit').toMatch(/thing\.ts/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // The real-world paths are NESTED -- sushi-finder/evidence/,
  // known-bad-fixtures/<x>/bad-app/evidence/ -- not a root evidence/ dir, and the
  // first version of these tests only covered the root case. Flagged by the
  // independent judge as coverage that did not reach the shape it was written for.
  it('excludes nested app evidence and results, not just root ones', () => {
    const dir = initGitRepo('redanvil-nested-artifact-');
    try {
      mkdirSync(join(dir, 'src'), { recursive: true });
      writeFileSync(join(dir, 'src', 'real.ts'), 'export const real = 1;\n');
      git(dir, ['add', '-A']);
      git(dir, ['commit', '-qm', 'feat: real code']);

      mkdirSync(join(dir, 'my-app', 'evidence'), { recursive: true });
      mkdirSync(join(dir, 'my-app', 'results'), { recursive: true });
      writeFileSync(join(dir, 'my-app', 'evidence', 'judge.json'), '{"ok":true}\n');
      writeFileSync(join(dir, 'my-app', 'results', 'app.json'), '{"finalScore":99}\n');
      git(dir, ['add', '-A']);
      git(dir, ['commit', '-qm', 'chore(evidence): nested artifacts']);

      const diff = collectDiff(dir);
      expect(diff, 'nested evidence must be excluded').not.toMatch(/judge\.json/);
      expect(diff, 'nested results must be excluded').not.toMatch(/finalScore/);
      expect(diff, 'falls through to the real commit').toMatch(/real\.ts/);
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

/**
 * Build a minimal unified-diff file section of approximately `bodyChars` size.
 *
 * @param path - File path in the diff header.
 * @param bodyChars - Approximate size of +lines body.
 */
function fakeFileDiff(path: string, bodyChars: number): string {
  const header = `diff --git a/${path} b/${path}\nindex 1111111..2222222 100644\n--- a/${path}\n+++ b/${path}\n@@ -1,1 +1,1 @@\n`;
  const line = `+${'x'.repeat(60)}\n`;
  let body = '';
  while (body.length < bodyChars) body += line;
  return header + body;
}

describe('splitDiffByFile / splitDiffIntoChunks (file boundaries)', () => {
  it('splits on file boundaries and never mid-line', () => {
    const a = fakeFileDiff('src/a.ts', 200);
    const b = fakeFileDiff('src/b.ts', 200);
    const diff = a + b;
    const sections = splitDiffByFile(diff);
    expect(sections).toHaveLength(2);
    expect(sections[0]?.path).toBe('src/a.ts');
    expect(sections[1]?.path).toBe('src/b.ts');
    expect((sections[0]?.text ?? '') + (sections[1]?.text ?? '')).toBe(diff);
    expect(sections[0]?.text.startsWith('diff --git ')).toBe(true);
    expect(sections[1]?.text.startsWith('diff --git ')).toBe(true);
  });

  it('packs multiple small files into one chunk under budget', () => {
    const diff =
      fakeFileDiff('one.ts', 100) +
      fakeFileDiff('two.ts', 100) +
      fakeFileDiff('three.ts', 100);
    const split = splitDiffIntoChunks(diff, 50_000, 10);
    expect(split.chunks).toHaveLength(1);
    expect(split.coverageChars).toBe(diff.length);
    expect(split.diffChars).toBe(diff.length);
    expect(split.chunkLimitExceeded).toBe(false);
    expect(split.chunks[0]?.text).toBe(diff);
    expect(split.chunks[0]?.splitFile).toBe(false);
  });

  it('keeps whole files in separate chunks when packing would exceed budget', () => {
    // Each file ~40k; budget 50k ⇒ one file per chunk, not mid-file.
    const f1 = fakeFileDiff('big1.ts', 40_000);
    const f2 = fakeFileDiff('big2.ts', 40_000);
    const f3 = fakeFileDiff('big3.ts', 40_000);
    const diff = f1 + f2 + f3;
    const budget = 50_000;
    const split = splitDiffIntoChunks(diff, budget, 10);
    expect(split.chunks.length).toBe(3);
    expect(split.chunks.every((c) => c.splitFile === false)).toBe(true);
    expect(split.chunks.every((c) => c.coverageChars <= budget)).toBe(true);
    expect(split.coverageChars).toBe(diff.length);
    // Each chunk is exactly one file section.
    expect(split.chunks[0]?.text).toBe(f1);
    expect(split.chunks[1]?.text).toBe(f2);
    expect(split.chunks[2]?.text).toBe(f3);
  });

  it('splits an oversized single file on line boundaries and records splitFiles', () => {
    const budget = 5_000;
    const huge = fakeFileDiff('huge.ts', 12_000);
    expect(huge.length).toBeGreaterThan(budget);
    const split = splitDiffIntoChunks(huge, budget, 20);
    expect(split.chunks.length).toBeGreaterThan(1);
    expect(split.splitFiles).toContain('huge.ts');
    expect(split.chunks.every((c) => c.splitFile === true)).toBe(true);
    expect(split.chunks.every((c) => c.coverageChars <= budget)).toBe(true);
    expect(split.coverageChars).toBe(huge.length);
    // Reassembly equals original — no silent gap.
    expect(split.chunks.map((c) => c.text).join('')).toBe(huge);
    // No mid-line cut: each non-final piece ends with newline (line-bounded).
    for (let i = 0; i < split.chunks.length - 1; i++) {
      expect(split.chunks[i]?.text.endsWith('\n')).toBe(true);
    }
  });

  it('splitOversizedFileSection coverage sums to the section length', () => {
    const section = { path: 'x.ts', text: fakeFileDiff('x.ts', 8_000) };
    const parts = splitOversizedFileSection(section, 3_000);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.reduce((s, p) => s + p.coverageChars, 0)).toBe(section.text.length);
    expect(parts.map((p) => p.text).join('')).toBe(section.text);
  });

  it('marks chunkLimitExceeded when more chunks than the bound (incomplete, not pass)', () => {
    const files = Array.from({ length: 6 }, (_, i) =>
      fakeFileDiff(`f${i}.ts`, 4_000)
    );
    const diff = files.join('');
    const split = splitDiffIntoChunks(diff, 5_000, 3);
    expect(split.chunkLimitExceeded).toBe(true);
    expect(split.chunks).toHaveLength(3);
    expect(split.coverageChars).toBeLessThan(diff.length);
  });

  it('single-chunk path still embeds truncation notice when over budget in prompt', () => {
    // Safety net for callers that pass an over-budget string without splitting.
    const over = 'y'.repeat(JUDGE_PROMPT_DIFF_BUDGET + 500);
    const prompt = buildRefutePrompt('demo', 'deadbeef', over);
    expect(prompt).toContain(
      `[diff truncated at ${JUDGE_PROMPT_DIFF_BUDGET} chars for the judge prompt]`
    );
    expect(prompt).not.toContain(over); // full over-budget body must not appear
  });

  it('exposes MAX_DIFF_REVIEW_CHUNKS as a finite sane bound', () => {
    expect(MAX_DIFF_REVIEW_CHUNKS).toBeGreaterThan(1);
    expect(MAX_DIFF_REVIEW_CHUNKS).toBeLessThanOrEqual(100);
  });
});

describe('aggregateChunkReviews', () => {
  /**
   * Minimal planned chunks + matching clean results for a synthetic diff.
   */
  function cleanPair(diffChars: number, n: number): {
    chunks: DiffChunk[];
    results: Array<{
      index: number;
      coverageChars: number;
      completed: boolean;
      foundNothingExplicit: boolean;
      findings: IndependentReviewReport['findings'];
      rawExcerpt: string;
    }>;
  } {
    const each = Math.floor(diffChars / n);
    const chunks: DiffChunk[] = [];
    const results: Array<{
      index: number;
      coverageChars: number;
      completed: boolean;
      foundNothingExplicit: boolean;
      findings: IndependentReviewReport['findings'];
      rawExcerpt: string;
    }> = [];
    let covered = 0;
    for (let i = 0; i < n; i++) {
      const cov = i === n - 1 ? diffChars - covered : each;
      covered += cov;
      chunks.push({
        index: i,
        text: 'x'.repeat(cov),
        coverageChars: cov,
        splitFile: false
      });
      results.push({
        index: i,
        coverageChars: cov,
        completed: true,
        foundNothingExplicit: true,
        findings: [],
        rawExcerpt: `ok-${i}`
      });
    }
    return { chunks, results };
  }

  it('ok when every chunk completed, coverage full, and all findings passed', () => {
    const { chunks, results } = cleanPair(10_000, 3);
    const agg = aggregateChunkReviews({
      diffChars: 10_000,
      chunks,
      results,
      chunkLimitExceeded: false,
      splitFiles: []
    });
    expect(agg.completed).toBe(true);
    expect(agg.ok).toBe(true);
    expect(agg.coverageComplete).toBe(true);
    expect(agg.coverageChars).toBe(10_000);
    expect(agg.chunkCount).toBe(3);
    expect(agg.foundNothingExplicit).toBe(true);
  });

  it('unions findings across chunks', () => {
    const { chunks, results } = cleanPair(1000, 2);
    results[0] = {
      ...results[0]!,
      foundNothingExplicit: false,
      findings: [
        {
          title: 'defect a',
          citation: 'a.ts:1',
          detail: 'bad',
          passed: false
        }
      ]
    };
    results[1] = {
      ...results[1]!,
      foundNothingExplicit: false,
      findings: [
        {
          title: 'verified b',
          citation: 'b.ts:2',
          detail: 'ok',
          passed: true
        }
      ]
    };
    const agg = aggregateChunkReviews({
      diffChars: 1000,
      chunks,
      results,
      chunkLimitExceeded: false,
      splitFiles: []
    });
    expect(agg.findings.map((f) => f.title)).toEqual(
      expect.arrayContaining(['defect a', 'verified b'])
    );
    expect(agg.completed).toBe(true);
    expect(agg.ok).toBe(false);
  });

  it('AGGREGATE is completed false / ok false when one chunk is unparseable', () => {
    // The case that matters: partial coverage must never read as a clean review.
    const { chunks, results } = cleanPair(2000, 2);
    results[1] = {
      index: 1,
      coverageChars: results[1]!.coverageChars,
      completed: false,
      foundNothingExplicit: false,
      findings: [
        {
          title: 'unparseable judge output',
          citation: 'orchestrator/src/loop/independentReview.ts:1',
          detail: 'chunk 2/2 did not return JSON — cannot verify; fail closed',
          passed: false
        }
      ],
      rawExcerpt: 'NOT JSON AT ALL'
    };
    const agg = aggregateChunkReviews({
      diffChars: 2000,
      chunks,
      results,
      chunkLimitExceeded: false,
      splitFiles: []
    });
    expect(agg.completed).toBe(false);
    expect(agg.ok).toBe(false);
    expect(agg.findings.some((f) => f.title === 'unparseable judge output')).toBe(
      true
    );
  });

  it('coverage shortfall fails the aggregate', () => {
    const { chunks, results } = cleanPair(1000, 2);
    // Lie about coverage on purpose — sum 800 !== 1000.
    results[0] = { ...results[0]!, coverageChars: 400 };
    results[1] = { ...results[1]!, coverageChars: 400 };
    const agg = aggregateChunkReviews({
      diffChars: 1000,
      chunks,
      results,
      chunkLimitExceeded: false,
      splitFiles: []
    });
    expect(agg.coverageComplete).toBe(false);
    expect(agg.completed).toBe(false);
    expect(agg.ok).toBe(false);
    expect(agg.findings.some((f) => f.title === 'diff coverage shortfall')).toBe(
      true
    );
  });

  it('chunk limit exceeded is explicit incomplete, not a pass', () => {
    const { chunks, results } = cleanPair(3000, 2);
    const agg = aggregateChunkReviews({
      diffChars: 5000, // more diff than the limited chunks cover
      chunks,
      results,
      chunkLimitExceeded: true,
      splitFiles: []
    });
    expect(agg.completed).toBe(false);
    expect(agg.ok).toBe(false);
    expect(agg.findings.some((f) => f.title === 'diff chunk limit exceeded')).toBe(
      true
    );
  });

  it('records oversized file split as an explicit (passed) finding, not a silent cut', () => {
    const { chunks, results } = cleanPair(1000, 2);
    chunks[0] = {
      ...chunks[0]!,
      splitFile: true,
      splitFilePath: 'huge.ts',
      splitPart: 1,
      splitParts: 2
    };
    chunks[1] = {
      ...chunks[1]!,
      splitFile: true,
      splitFilePath: 'huge.ts',
      splitPart: 2,
      splitParts: 2
    };
    const agg = aggregateChunkReviews({
      diffChars: 1000,
      chunks,
      results,
      chunkLimitExceeded: false,
      splitFiles: ['huge.ts']
    });
    const meta = agg.findings.find((f) => f.title === 'oversized file split for review');
    expect(meta).toBeDefined();
    expect(meta?.passed).toBe(true);
    expect(meta?.detail).toMatch(/split/i);
    expect(meta?.citation).toBe('huge.ts:1');
  });

  it('drops scope-truncation findings when coverage is complete (full review ran)', () => {
    const { chunks, results } = cleanPair(2000, 2);
    results[0] = {
      ...results[0]!,
      foundNothingExplicit: false,
      findings: [
        {
          title: 'diff truncated; cannot verify full change set',
          citation: 'x.ts:1',
          detail: 'The provided unified diff was truncated mid-file',
          passed: false
        },
        {
          title: 'hardcoded secret',
          citation: 'x.ts:2',
          detail: 'API key in source',
          passed: false
        }
      ]
    };
    const agg = aggregateChunkReviews({
      diffChars: 2000,
      chunks,
      results,
      chunkLimitExceeded: false,
      splitFiles: []
    });
    expect(agg.coverageComplete).toBe(true);
    expect(agg.findings.some((f) => /diff truncated/i.test(f.title))).toBe(false);
    expect(agg.findings.some((f) => f.title === 'hardcoded secret')).toBe(true);
    expect(agg.ok).toBe(false);
  });

  it('KEEPS scope-truncation findings when coverage is incomplete (judge truly blind)', () => {
    const { chunks, results } = cleanPair(1000, 1);
    results[0] = {
      ...results[0]!,
      coverageChars: 500, // shortfall
      foundNothingExplicit: false,
      findings: [
        {
          title: 'diff truncated; cannot verify full change set',
          citation: 'x.ts:1',
          detail: 'diff truncated at 120000 chars for the judge prompt',
          passed: false
        }
      ]
    };
    const agg = aggregateChunkReviews({
      diffChars: 1000,
      chunks,
      results,
      chunkLimitExceeded: false,
      splitFiles: []
    });
    expect(agg.coverageComplete).toBe(false);
    expect(agg.completed).toBe(false);
    expect(agg.findings.some((f) => /diff truncated/i.test(f.title))).toBe(true);
  });

  it('isScopeTruncationFinding classifies the known refusal shapes', () => {
    expect(
      isScopeTruncationFinding({
        title: 'diff truncated; cannot verify full change set',
        citation: 'a:1',
        detail: 'judge saw truncated prompt',
        passed: false
      })
    ).toBe(true);
    expect(
      isScopeTruncationFinding({
        title: 'hardcoded hero paint',
        citation: 'theme.css:1',
        detail: 'hero stays black in light mode',
        passed: false
      })
    ).toBe(false);
  });
});

describe('runIndependentDiffReview multi-chunk via reviewChunk hook', () => {
  it('reviews every chunk and reports full coverage (no diff-truncated finding)', () => {
    const dir = initGitRepo('redanvil-chunk-hook-');
    try {
      // Several mid-size files + tiny budget ⇒ multiple file-boundary chunks.
      const names: string[] = [];
      for (let i = 0; i < 4; i++) {
        const name = `f${i}.txt`;
        writeFileSync(join(dir, name), `${'line\n'.repeat(80)}`);
        names.push(name);
      }
      git(dir, ['add', ...names]);
      git(dir, ['commit', '-qm', 'base']);
      for (let i = 0; i < 4; i++) {
        writeFileSync(join(dir, `f${i}.txt`), `${'changed\n'.repeat(80)}`);
      }

      let calls = 0;
      const seenPrompts: string[] = [];
      const report = runIndependentDiffReview({
        dir,
        outPath: join(dir, 'evidence', 'judge-diff-chunk.json'),
        // ~1.5k forces one file per chunk for the ~2k+ file diffs above.
        diffBudget: 1_500,
        reviewChunk: ({ prompt }) => {
          calls += 1;
          seenPrompts.push(prompt);
          return {
            stdout: JSON.stringify({
              foundNothingExplicit: true,
              findings: []
            })
          };
        }
      });
      expect(calls).toBeGreaterThan(1);
      expect(report.chunkCount).toBe(calls);
      expect(report.completed).toBe(true);
      expect(report.ok).toBe(true);
      expect(report.coverageComplete).toBe(true);
      expect(report.coverageChars).toBe(report.diffChars);
      expect(report.findings.some((f) => /diff truncated/i.test(f.title))).toBe(
        false
      );
      expect(report.findings.some((f) => /diff truncated/i.test(f.detail))).toBe(
        false
      );
      // Multi-chunk prompts carry chunk scope; never the old single-pass truncate note.
      expect(seenPrompts.some((p) => /Chunk scope/i.test(p))).toBe(true);
      expect(
        seenPrompts.some((p) => /diff truncated at .* chars for the judge prompt/.test(p))
      ).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('simulates unparseable chunk output → aggregate completed false / ok false', () => {
    const dir = initGitRepo('redanvil-chunk-unparse-');
    try {
      writeFileSync(join(dir, 'a.txt'), 'a\n');
      git(dir, ['add', 'a.txt']);
      git(dir, ['commit', '-qm', 'init']);
      writeFileSync(join(dir, 'a.txt'), 'b\n');

      const report = runIndependentDiffReview({
        dir,
        outPath: join(dir, 'evidence', 'judge-diff-unparse.json'),
        reviewChunk: () => ({ stdout: 'this is not json and not a review' })
      });
      expect(report.completed).toBe(false);
      expect(report.ok).toBe(false);
      expect(
        report.findings.some(
          (f) => f.title === 'unparseable judge output' && f.passed === false
        )
      ).toBe(true);
      expect(evaluateReviewOk(report)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('one of many chunks unparseable fails the whole review (partial ≠ clean)', () => {
    const dir = initGitRepo('redanvil-chunk-partial-');
    try {
      const names: string[] = [];
      for (let i = 0; i < 3; i++) {
        const name = `p${i}.txt`;
        writeFileSync(join(dir, name), `${'base\n'.repeat(100)}`);
        names.push(name);
      }
      git(dir, ['add', ...names]);
      git(dir, ['commit', '-qm', 'init']);
      for (let i = 0; i < 3; i++) {
        writeFileSync(join(dir, `p${i}.txt`), `${'new\n'.repeat(100)}`);
      }

      let n = 0;
      const report = runIndependentDiffReview({
        dir,
        outPath: join(dir, 'evidence', 'judge-diff-partial.json'),
        diffBudget: 1_500,
        reviewChunk: () => {
          n += 1;
          // Chunk 1 clean; chunk 2 garbage — aggregate must not pass.
          if (n === 1) {
            return {
              stdout: JSON.stringify({ foundNothingExplicit: true, findings: [] })
            };
          }
          return { stdout: `garbage turn ${n}` };
        }
      });
      expect(n).toBeGreaterThan(1);
      expect(report.completed).toBe(false);
      expect(report.ok).toBe(false);
      expect(report.findings.some((f) => f.title === 'unparseable judge output')).toBe(
        true
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('dashboard-shaped single chunk (fits budget) still completes as one review', () => {
    const dir = initGitRepo('redanvil-chunk-single-');
    try {
      writeFileSync(join(dir, 'small.txt'), 'hello\n');
      git(dir, ['add', 'small.txt']);
      git(dir, ['commit', '-qm', 'init']);
      writeFileSync(join(dir, 'small.txt'), 'hello world\n');

      let calls = 0;
      const report = runIndependentDiffReview({
        dir,
        outPath: join(dir, 'evidence', 'judge-diff-single.json'),
        reviewChunk: () => {
          calls += 1;
          return {
            stdout: JSON.stringify({ foundNothingExplicit: true, findings: [] })
          };
        }
      });
      expect(calls).toBe(1);
      expect(report.chunkCount).toBe(1);
      expect(report.completed).toBe(true);
      expect(report.ok).toBe(true);
      expect(report.coverageChars).toBe(report.diffChars);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});


