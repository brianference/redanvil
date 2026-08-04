/**
 * F5 wiring: loadProductJudgementOpts must read evidence/judge-diff-<slug>.json
 * fail-closed and commit-pinned — the same shape independentReview.ts writes.
 *
 * Four cases the GATE path depends on (reverify runs gate, not loop):
 *  1. No report → independentReviewOk false
 *  2. Report with unverified / unresolved findings → false
 *  3. Genuine passing report at HEAD → true
 *  4. Passing report pinned to a different commit → false (stale)
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadProductJudgementOpts } from '../src/team/finishOpts';
import {
  independentReviewOkFromReport,
  readJudgeDiffReport,
  type IndependentReviewReport
} from '../src/loop/independentReview';
import { isDone } from '../src/gate/done';

const made: string[] = [];

afterEach(() => {
  for (const d of made.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
});

/**
 * Fresh git repo + app dir; returns paths and HEAD.
 *
 * @returns { repo, app, head, slug }
 */
function fixtureRepo(): { repo: string; app: string; head: string; slug: string } {
  const repo = mkdtempSync(join(tmpdir(), 'finish-opts-jd-'));
  made.push(repo);
  spawnSync('git', ['init', '-q'], { cwd: repo });
  spawnSync('git', ['config', 'user.email', 't@t'], { cwd: repo });
  spawnSync('git', ['config', 'user.name', 't'], { cwd: repo });
  writeFileSync(join(repo, 'seed.txt'), 'seed\n');
  spawnSync('git', ['add', 'seed.txt'], { cwd: repo });
  spawnSync('git', ['commit', '-qm', 'init'], { cwd: repo });
  const head = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repo,
    encoding: 'utf8'
  }).stdout.trim();
  const slug = 'demo-app';
  const app = join(repo, slug);
  mkdirSync(join(app, 'evidence'), { recursive: true });
  mkdirSync(join(repo, 'evidence'), { recursive: true });
  return { repo, app, head, slug };
}

/**
 * Minimal IndependentReviewReport for tests.
 *
 * @param commit - Pin commit.
 * @param overrides - Field overrides.
 */
function report(
  commit: string,
  overrides: Partial<IndependentReviewReport> = {}
): IndependentReviewReport {
  return {
    kind: 'independent-diff-review',
    slug: 'demo-app',
    commit,
    reviewedAt: new Date().toISOString(),
    diffHash: 'b'.repeat(64),
    completed: true,
    ok: true,
    foundNothingExplicit: true,
    findings: [],
    rawExcerpt: 'fixture',
    mode: 'fixture',
    ...overrides
  };
}

/** isDone inputs that clear every bar except product-judgement opts. */
function almostDoneResult() {
  return {
    finalScore: 95,
    threshold: 90,
    rules: [
      { ruleId: 'u-test-presence', passed: true },
      { ruleId: 'u-test-acceptance', passed: true },
      { ruleId: 'u-test-coverage-ratchet', passed: true },
      { ruleId: 'lg-shipped', passed: true },
      { ruleId: 'lg-result-reproduces', passed: true },
      { ruleId: 'lg-bindings-bound', passed: true },
      { ruleId: 'meas-known-bad', passed: true },
      { ruleId: 'meas-two-run', passed: true },
      { ruleId: 'meas-recheck-flattering', passed: true },
      { ruleId: 'meas-standard-tool', passed: true },
      { ruleId: 'meas-engine-named', passed: true }
    ]
  };
}

describe('loadProductJudgementOpts independentReviewOk (F5)', () => {
  it('1. with NO judge-diff report → independentReviewOk is false', () => {
    const { app, slug } = fixtureRepo();
    const opts = loadProductJudgementOpts(app, slug);
    expect(opts.independentReviewOk).toBe(false);
    expect(readJudgeDiffReport(app, slug)).toBeNull();

    // F5 still fails through isDone when only this opt is false.
    const v = isDone(almostDoneResult(), {
      skipChecklist: true,
      qaVisualOk: true,
      userRefuseOk: true,
      independentReviewOk: opts.independentReviewOk
    });
    expect(v.done).toBe(false);
    expect(v.reasons.some((r) => /independent judge/i.test(r))).toBe(true);
  });

  it('2. report with unverified / unresolved findings → still false', () => {
    const { app, head, slug } = fixtureRepo();
    const body = report(head, {
      ok: false,
      foundNothingExplicit: false,
      findings: [
        {
          title: 'unverified claim',
          citation: 'src/App.tsx:12',
          detail: 'cannot verify theme paint',
          passed: false
        }
      ]
    });
    writeFileSync(
      join(app, 'evidence', `judge-diff-${slug}.json`),
      `${JSON.stringify(body, null, 2)}\n`,
      'utf8'
    );

    expect(independentReviewOkFromReport(body, head)).toBe(false);
    expect(loadProductJudgementOpts(app, slug).independentReviewOk).toBe(false);

    // Empty findings without foundNothingExplicit is also fail-closed.
    const silent = report(head, {
      ok: true,
      foundNothingExplicit: false,
      findings: []
    });
    writeFileSync(
      join(app, 'evidence', `judge-diff-${slug}.json`),
      `${JSON.stringify(silent, null, 2)}\n`,
      'utf8'
    );
    expect(loadProductJudgementOpts(app, slug).independentReviewOk).toBe(false);
  });

  it('3. genuine passing report at the right commit → true, and F5 clears', () => {
    const { app, head, slug } = fixtureRepo();
    const body = report(head, {
      ok: true,
      foundNothingExplicit: true,
      findings: []
    });
    const path = join(app, 'evidence', `judge-diff-${slug}.json`);
    writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`, 'utf8');

    // Prove we observe the real file contents, not a fabricated pass.
    const onDisk = JSON.parse(readFileSync(path, 'utf8')) as IndependentReviewReport;
    expect(onDisk.commit).toBe(head);
    expect(onDisk.ok).toBe(true);
    expect(onDisk.foundNothingExplicit).toBe(true);

    expect(independentReviewOkFromReport(onDisk, head)).toBe(true);
    const opts = loadProductJudgementOpts(app, slug);
    expect(opts.independentReviewOk).toBe(true);

    const v = isDone(almostDoneResult(), {
      skipChecklist: true,
      qaVisualOk: true,
      userRefuseOk: true,
      independentReviewOk: opts.independentReviewOk
    });
    expect(v.done).toBe(true);
    expect(v.reasons).toEqual([]);
  });

  it('4. genuine passing report pinned to a DIFFERENT commit → false (stale)', () => {
    const { app, head, slug } = fixtureRepo();
    const otherCommit = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    expect(otherCommit).not.toBe(head);

    const body = report(otherCommit, {
      ok: true,
      foundNothingExplicit: true,
      findings: []
    });
    writeFileSync(
      join(app, 'evidence', `judge-diff-${slug}.json`),
      `${JSON.stringify(body, null, 2)}\n`,
      'utf8'
    );

    // Loader sees the file but rejects the pin mismatch.
    expect(readJudgeDiffReport(app, slug)).not.toBeNull();
    expect(independentReviewOkFromReport(body, head)).toBe(false);
    expect(loadProductJudgementOpts(app, slug).independentReviewOk).toBe(false);

    const v = isDone(almostDoneResult(), {
      skipChecklist: true,
      qaVisualOk: true,
      userRefuseOk: true,
      independentReviewOk: loadProductJudgementOpts(app, slug).independentReviewOk
    });
    expect(v.done).toBe(false);
    expect(v.reasons.some((r) => /independent judge/i.test(r))).toBe(true);
  });

  it('hand-authored ok:true with a failing finding is not trusted', () => {
    const { app, head, slug } = fixtureRepo();
    const body = report(head, {
      ok: true, // stamped pass
      foundNothingExplicit: false,
      findings: [
        {
          title: 'real defect',
          citation: 'x.ts:1',
          detail: 'still broken',
          passed: false
        }
      ]
    });
    writeFileSync(
      join(app, 'evidence', `judge-diff-${slug}.json`),
      `${JSON.stringify(body, null, 2)}\n`,
      'utf8'
    );
    expect(loadProductJudgementOpts(app, slug).independentReviewOk).toBe(false);
  });

  it('resolves judge-diff from repo-root evidence/ as well as app evidence/', () => {
    const { app, head, slug, repo } = fixtureRepo();
    writeFileSync(
      join(repo, 'evidence', `judge-diff-${slug}.json`),
      `${JSON.stringify(report(head), null, 2)}\n`,
      'utf8'
    );
    expect(loadProductJudgementOpts(app, slug).independentReviewOk).toBe(true);
  });
});
