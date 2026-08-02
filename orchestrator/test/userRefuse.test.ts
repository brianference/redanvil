/**
 * user-refuse: refuse below-the-fold, accept fixed page; blocks isDone when refuse.
 */
import { describe, it, expect } from 'vitest';
import {
  decideUserRefuse,
  knownBadBelowFoldStrangerView,
  knownGoodInViewStrangerView,
  buildRefusalReport,
  userRefuseOkFromReport,
  writeRefusalReport,
  readRefusalReport
} from '../src/team/userRefuse';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('decideUserRefuse', () => {
  it('REFUSES the below-the-fold fixture and names that complaint', () => {
    const r = decideUserRefuse(knownBadBelowFoldStrangerView());
    expect(r.verdict).toBe('refuse');
    expect(r.answers.primaryResultOffScreen).toBe(true);
    const texts = r.complaints.map((c) => c.text).join(' | ');
    expect(/off-screen|search|appear to work/i.test(texts)).toBe(true);
    console.log('user-refuse known-bad:', JSON.stringify(r, null, 2));
  });

  it('ACCEPTs the fixed in-view page', () => {
    const r = decideUserRefuse(knownGoodInViewStrangerView());
    expect(r.verdict).toBe('accept');
    expect(r.complaints).toEqual([]);
    console.log('user-refuse known-good:', JSON.stringify(r, null, 2));
  });

  it('default is refuse when purpose was not accomplished', () => {
    const r = decideUserRefuse({
      ...knownGoodInViewStrangerView(),
      purposeAccomplished: false
    });
    expect(r.verdict).toBe('refuse');
  });

  it('small logo seeds a logo complaint', () => {
    const r = decideUserRefuse({
      ...knownGoodInViewStrangerView(),
      brandMarkHeight: 16
    });
    expect(r.verdict).toBe('refuse');
    expect(r.complaints.some((c) => /logo is way too small/i.test(c.text))).toBe(true);
  });
});

describe('userRefuseOkFromReport', () => {
  it('accept is ok; refuse is not; human override can clear refuse', () => {
    expect(userRefuseOkFromReport(null)).toBe(false);
    const accept = buildRefusalReport({
      slug: 'x',
      view: knownGoodInViewStrangerView()
    });
    expect(userRefuseOkFromReport(accept)).toBe(true);
    const refuse = buildRefusalReport({
      slug: 'x',
      view: knownBadBelowFoldStrangerView()
    });
    expect(refuse.verdict).toBe('refuse');
    expect(userRefuseOkFromReport(refuse)).toBe(false);
    expect(
      userRefuseOkFromReport({
        ...refuse,
        humanOverride: {
          acceptDespiteRefusal: true,
          reason: 'product owner accepted remaining risk',
          recordedAt: new Date().toISOString()
        }
      })
    ).toBe(true);
  });

  it('writes evidence/refusal-<slug>.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'refusal-'));
    try {
      const report = buildRefusalReport({
        slug: 'demo',
        view: knownGoodInViewStrangerView()
      });
      writeRefusalReport(dir, report);
      expect(readRefusalReport(dir, 'demo')?.verdict).toBe('accept');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
