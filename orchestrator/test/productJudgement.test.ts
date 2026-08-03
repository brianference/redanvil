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
 * evidence must actually be found.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  qaVisualOk,
  userRefuseOk,
  independentReviewOk,
  coveragePct,
  loadProductJudgement
} from '../src/team/productJudgement.mjs';

const made: string[] = [];

/** An app dir with an evidence/ folder, optionally with files written into it. */
function appWith(files: Record<string, unknown> = {}, atRoot = false): string {
  const repo = mkdtempSync(join(tmpdir(), 'pj-'));
  made.push(repo);
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
    const app = appWith({
      'qa-visual-the-app.json': { verdict: 'fail' },
      'refusal-the-app.json': { verdict: 'refuse' },
      'independent-review-the-app.json': { verdict: 'fail', reviewer: 'grok' }
    });
    expect(qaVisualOk(app, 'the-app')).toBe(false);
    expect(userRefuseOk(app, 'the-app')).toBe(false);
    expect(independentReviewOk(app, 'the-app')).toBe(false);
  });

  it('malformed JSON does not pass', () => {
    const app = appWith();
    writeFileSync(join(app, 'evidence', 'qa-visual-the-app.json'), '{ not json', 'utf8');
    expect(qaVisualOk(app, 'the-app')).toBe(false);
  });

  it('an unsigned independent review does not pass', () => {
    // No reviewer named means nothing establishes it was not a self-review.
    const app = appWith({ 'independent-review-the-app.json': { verdict: 'pass' } });
    expect(independentReviewOk(app, 'the-app')).toBe(false);
    const blank = appWith({
      'independent-review-the-app.json': { verdict: 'pass', reviewer: '   ' }
    });
    expect(independentReviewOk(blank, 'the-app')).toBe(false);
  });
});

describe('product judgement finds evidence that is actually there', () => {
  it('passes on real accepting evidence in the app dir', () => {
    const app = appWith({
      'qa-visual-the-app.json': { verdict: 'pass' },
      'refusal-the-app.json': { verdict: 'accept' },
      'independent-review-the-app.json': { verdict: 'pass', reviewer: 'grok-4.5' },
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
