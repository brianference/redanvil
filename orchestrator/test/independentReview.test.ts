/**
 * Known-answer fixtures for the independent judge-over-diff loop step.
 *
 * A silent empty pass is forbidden: foundNothingExplicit must be set when
 * findings are empty. Failures need file:line citations.
 */
import { describe, it, expect } from 'vitest';
import {
  buildRefutePrompt,
  evaluateReviewOk,
  hashDiff,
  parseJudgeJson,
  runIndependentDiffReview,
  type IndependentReviewReport
} from '../src/loop/independentReview';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

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
    const dir = mkdtempSync(join(tmpdir(), 'redanvil-review-'));
    try {
      spawnSync('git', ['init', '-q'], { cwd: dir });
      spawnSync('git', ['config', 'user.email', 't@t'], { cwd: dir });
      spawnSync('git', ['config', 'user.name', 't'], { cwd: dir });
      writeFileSync(join(dir, 'a.txt'), 'a\n');
      spawnSync('git', ['add', 'a.txt'], { cwd: dir });
      spawnSync('git', ['commit', '-qm', 'init'], { cwd: dir });

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
    const dir = mkdtempSync(join(tmpdir(), 'redanvil-review-ok-'));
    try {
      spawnSync('git', ['init', '-q'], { cwd: dir });
      spawnSync('git', ['config', 'user.email', 't@t'], { cwd: dir });
      spawnSync('git', ['config', 'user.name', 't'], { cwd: dir });
      writeFileSync(join(dir, 'a.txt'), 'a\n');
      spawnSync('git', ['add', 'a.txt'], { cwd: dir });
      spawnSync('git', ['commit', '-qm', 'init'], { cwd: dir });

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
});
