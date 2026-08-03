import { describe, it, expect } from 'vitest';
// @ts-expect-error -- plain .mjs script, no declarations
import { reasonIsOnlyAboutWaived, scoreBarReasons } from '../../.github/scripts/meets_the_bar.mjs';

/**
 * Known-issue waivers let a release ship with a recorded, dated defect instead of
 * one app's deferred work blocking every other app's finished work. The danger is
 * obvious: a waiver that absorbs MORE than it was granted for is an escape hatch,
 * and this repo's whole history is checks that quietly stopped being able to fail.
 */
describe('release waivers', () => {
  const waived = new Map([['fe-touch-targets', { reason: 'deferred to the redesign' }]]);

  it('absorbs a reason naming only the waived rule', () => {
    const r = 'done-checklist X (fail): touch targets — fe-touch-targets failed';
    expect(reasonIsOnlyAboutWaived(r, waived, [])).toBe(true);
  });

  it('does NOT absorb a reason naming an unwaived rule (known-bad)', () => {
    // The one that matters. If this passes, the waiver is swallowing failures it
    // was never granted for and the finish line has a hole.
    const r = 'done-checklist Y (fail): api — u-api-not-found failed';
    expect(reasonIsOnlyAboutWaived(r, waived, ['u-api-not-found'])).toBe(false);
  });

  it('keeps blocking on score while ANY unwaived rule is failing', () => {
    const r = 'finalScore 0 is below the finish-line threshold 90';
    expect(reasonIsOnlyAboutWaived(r, waived, ['u-api-not-found'])).toBe(false);
    // ...and only releases it once nothing unwaived fails.
    expect(reasonIsOnlyAboutWaived(r, waived, [])).toBe(true);
  });

  it('waives nothing when no waivers are configured', () => {
    const r = 'finalScore 0 is below the finish-line threshold 90';
    expect(reasonIsOnlyAboutWaived(r, new Map(), [])).toBe(false);
  });

  it('scoreBarReasons still lists unwaived failing rules', () => {
    const result = {
      finalScore: 100,
      threshold: 90,
      rules: [
        { ruleId: 'fe-touch-targets', passed: false },
        { ruleId: 'u-api-not-found', passed: false }
      ],
      // parseResultShape always emits this field, null included, so a fixture
      // without it is a shape the function is never handed in practice.
      provenance: null
    };
    const reasons = scoreBarReasons(result, { waivedRules: ['fe-touch-targets'] });
    expect(reasons.join(' ')).toContain('u-api-not-found');
    expect(reasons.join(' ')).not.toContain('fe-touch-targets');
  });
});
