/**
 * QA-visual pure decision -- vitest half (pytest/hypothesis is the other).
 */
import { describe, it, expect } from 'vitest';
import {
  decideQaVisual,
  isYInViewport,
  isExcludedFromJudgement,
  reasonsForObservation,
  knownBadBelowFoldMetrics,
  knownGoodInViewMetrics,
  buildQaVisualReport,
  writeQaVisualReport,
  readQaVisualReport,
  qaVisualOkFromReport
} from '../src/team/qaVisual';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('isYInViewport', () => {
  it('fails when y exceeds viewport height', () => {
    expect(isYInViewport(1942, 900)).toBe(false);
    expect(isYInViewport(900, 900)).toBe(false);
    expect(isYInViewport(899, 900, 40)).toBe(true);
  });

  it('fails closed on non-finite inputs', () => {
    expect(isYInViewport(NaN, 900)).toBe(false);
    expect(isYInViewport(10, 0)).toBe(false);
  });
});

describe('isExcludedFromJudgement', () => {
  it('excludes sr-only and scroll-container samples', () => {
    expect(isExcludedFromJudgement({ srOnly: true })).toBe(true);
    expect(isExcludedFromJudgement({ insideScrollContainer: true })).toBe(true);
    expect(isExcludedFromJudgement({})).toBe(false);
  });
});

describe('decideQaVisual', () => {
  it('below-the-fold known-bad fixture FAILS', () => {
    const r = decideQaVisual([knownBadBelowFoldMetrics()]);
    expect(r.verdict).toBe('fail');
    expect(r.failReasons.some((x) => /outside viewport|1942/.test(x))).toBe(true);
    // Real output for the SPEC proof:
    console.log('QA-visual known-bad:', JSON.stringify(r, null, 2));
  });

  it('in-view known-good fixture PASSES', () => {
    const r = decideQaVisual([knownGoodInViewMetrics()]);
    expect(r.verdict).toBe('pass');
    expect(r.failReasons).toEqual([]);
    console.log('QA-visual known-good:', JSON.stringify(r, null, 2));
  });

  it('empty observations fail closed', () => {
    expect(decideQaVisual([]).verdict).toBe('fail');
  });

  it('verdict is invariant to observation order of the same samples', () => {
    const a = knownGoodInViewMetrics();
    const b = { ...knownGoodInViewMetrics(), theme: 'dark' as const, route: '/about' };
    const forward = decideQaVisual([a, b]);
    const reverse = decideQaVisual([b, a]);
    expect(forward.verdict).toBe(reverse.verdict);
  });

  it('no combination with off-screen primary result yields pass', () => {
    const bad = {
      ...knownGoodInViewMetrics(),
      primaryResultY: 2000,
      viewportHeight: 900
    };
    expect(decideQaVisual([bad]).verdict).toBe('fail');
  });

  it('brand mark too small fails', () => {
    const m = { ...knownGoodInViewMetrics(), brandMarkHeight: 16 };
    const reasons = reasonsForObservation(m);
    expect(reasons.some((r) => /brand-mark/.test(r))).toBe(true);
  });
});

describe('qa-visual report IO', () => {
  it('writes and reads a report; qaVisualOkFromReport requires pass', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qa-visual-'));
    try {
      const report = buildQaVisualReport({
        slug: 'fixture-app',
        observations: [knownGoodInViewMetrics()],
        findings: [
          {
            where: '/ 1280 light',
            firstAction: 'type in search',
            offScreen: 'nothing important',
            looksFinished: 'yes',
            firstNotice: 'search is prominent'
          }
        ]
      });
      expect(report.verdict).toBe('pass');
      writeQaVisualReport(dir, report);
      const loaded = readQaVisualReport(dir, 'fixture-app');
      expect(qaVisualOkFromReport(loaded)).toBe(true);
      expect(qaVisualOkFromReport(null)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
