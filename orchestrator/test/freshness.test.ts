import { describe, it, expect } from 'vitest';
import { findStaleVerdicts, verdictScope } from '../src/gate/freshness';
import type { Verdict } from '../src/schemas/verdicts';

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
});
