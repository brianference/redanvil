/**
 * Product-judgement evidence readers.
 *
 * These gate C2, C10, F5, A6 and the QA-visual / user-refuse rows. The bug this
 * file exists to prevent: meets_the_bar.mjs called isDone() without ever
 * supplying these opts, so every one of those rows reported "not supplied" and
 * could not be satisfied by any evidence on disk. A rule that cannot pass is
 * not a strict rule, it is a broken one -- and it hid behind output that looked
 * like ordinary enforcement.
 *
 * Both directions are pinned: absent evidence must fail closed, and present
 * evidence must actually be found. independentReviewOk is also commit-pinned.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  qaVisualOk,
  userRefuseOk,
  independentReviewOk,
  coveragePct,
  loadProductJudgement
} from '../src/team/productJudgement.mjs';

const made: string[] = [];

/**
 * Init a tiny git repo under dir and return its HEAD SHA.
 *
 * @param dir - Empty directory to turn into a repo.
 * @returns Full HEAD commit.
 */
function gitInitWithHead(dir: string): string {
  spawnSync('git', ['init', '-q'], { cwd: dir });
  spawnSync('git', ['config', 'user.email', 't@t'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 't'], { cwd: dir });
  writeFileSync(join(dir, 'seed.txt'), 'seed\n');
  spawnSync('git', ['add', 'seed.txt'], { cwd: dir });
  spawnSync('git', ['commit', '-qm', 'init'], { cwd: dir });
  return spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: dir,
    encoding: 'utf8'
  }).stdout.trim();
}

/**
 * A clean judge-diff body pinned to `commit`.
 *
 * @param commit - SHA the review claims to cover.
 * @param overrides - Fields to overlay (ok, findings, …).
 */
function judgeDiffPass(commit: string, overrides: Record<string, unknown> = {}) {
  return {
    kind: 'independent-diff-review',
    slug: 'the-app',
    commit,
    reviewedAt: new Date().toISOString(),
    diffHash: 'a'.repeat(64),
    completed: true,
    ok: true,
    foundNothingExplicit: true,
    findings: [],
    rawExcerpt: 'test',
    mode: 'fixture',
    ...overrides
  };
}

/** An app dir with an evidence/ folder, optionally with files written into it. */
function appWith(files: Record<string, unknown> = {}, atRoot = false): string {
  const repo = mkdtempSync(join(tmpdir(), 'pj-'));
  made.push(repo);
  gitInitWithHead(repo);
  const app = join(repo, 'the-app');
  mkdirSync(join(app, 'evidence'), { recursive: true });
  mkdirSync(join(repo, 'evidence'), { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(
      join(atRoot ? repo : app, 'evidence', name),
      JSON.stringify(body),
      'utf8'
    );
  }
  return app;
}

/**
 * App under a git repo; returns { app, head }.
 *
 * @param files - Evidence file name → body (body may be a fn of head).
 */
/** Evidence body or a factory that receives the repo HEAD SHA. */
type EvidenceBody = unknown | ((head: string) => unknown);

function appWithGit(
  files: Record<string, EvidenceBody> = {},
  atRoot = false
): { app: string; head: string } {
  const repo = mkdtempSync(join(tmpdir(), 'pj-'));
  made.push(repo);
  const head = gitInitWithHead(repo);
  const app = join(repo, 'the-app');
  mkdirSync(join(app, 'evidence'), { recursive: true });
  mkdirSync(join(repo, 'evidence'), { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    const resolved = typeof body === 'function' ? (body as (h: string) => unknown)(head) : body;
    writeFileSync(
      join(atRoot ? repo : app, 'evidence', name),
      JSON.stringify(resolved),
      'utf8'
    );
  }
  return { app, head };
}

afterEach(() => {
  for (const d of made.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
});

describe('product judgement fails closed on absent evidence', () => {
  it('every opt is false or null when nothing is on disk', () => {
    const app = appWith();
    expect(loadProductJudgement(app, 'the-app')).toEqual({
      qaVisualOk: false,
      userRefuseOk: false,
      independentReviewOk: false,
      coveragePct: null
    });
  });

  it('coverage is null rather than 0 when unmeasured', () => {
    // 0 would read as a real measured floor; null is "nobody measured".
    expect(coveragePct(appWith(), 'the-app')).toBeNull();
  });

  it('a fail / refuse verdict does not pass', () => {
    const { app, head } = appWithGit({
      'qa-visual-the-app.json': { verdict: 'fail' },
      'refusal-the-app.json': { verdict: 'refuse' },
      'judge-diff-the-app.json': (h: string) =>
        judgeDiffPass(h, {
          ok: false,
          foundNothingExplicit: false,
          findings: [
            {
              title: 'blocker',
              citation: 'x.ts:1',
              detail: 'bad',
              passed: false
            }
          ]
        })
    });
    expect(qaVisualOk(app, 'the-app')).toBe(false);
    expect(userRefuseOk(app, 'the-app')).toBe(false);
    expect(independentReviewOk(app, 'the-app')).toBe(false);
    expect(head.length).toBeGreaterThan(6);
  });

  it('malformed JSON does not pass', () => {
    const app = appWith();
    writeFileSync(join(app, 'evidence', 'qa-visual-the-app.json'), '{ not json', 'utf8');
    expect(qaVisualOk(app, 'the-app')).toBe(false);
  });

  it('a judge-diff without completed/ok does not pass', () => {
    const { app } = appWithGit({
      'judge-diff-the-app.json': (h: string) =>
        judgeDiffPass(h, { completed: false, ok: false, foundNothingExplicit: false })
    });
    expect(independentReviewOk(app, 'the-app')).toBe(false);
  });
});

describe('product judgement finds evidence that is actually there', () => {
  it('passes on real accepting evidence in the app dir', () => {
    const { app } = appWithGit({
      'qa-visual-the-app.json': { verdict: 'pass' },
      'refusal-the-app.json': { verdict: 'accept' },
      'judge-diff-the-app.json': (h: string) => judgeDiffPass(h),
      'coverage-the-app.json': { linesPct: 84.2 }
    });
    expect(loadProductJudgement(app, 'the-app')).toEqual({
      qaVisualOk: true,
      userRefuseOk: true,
      independentReviewOk: true,
      coveragePct: 84.2
    });
  });

  it('also resolves evidence written to the repo root', () => {
    // verdicts-<slug>.json and the screenshot set already live at the root, so
    // a report written there is following the house convention, not misplaced.
    const app = appWith({ 'qa-visual-the-app.json': { verdict: 'pass' } }, true);
    expect(qaVisualOk(app, 'the-app')).toBe(true);
  });
});
