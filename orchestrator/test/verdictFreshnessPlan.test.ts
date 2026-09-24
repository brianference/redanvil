/**
 * reverify's planner: only the measurers a stale verdict cites, and a reason.
 *
 * A planner that returned every job would still "work". The assertion that
 * desktop width is absent when only contrast is stale is what makes it fail.
 */
import { describe, it, expect } from 'vitest';
import {
  formatStaleLines,
  measurersForStale,
  verdictStaleReason
} from '../scripts/lib/verdict-freshness.mjs';

describe('measurersForStale', () => {
  it('asks only for the audit a stale visual verdict cites', () => {
    const plan = measurersForStale('app-builder', [
      {
        ruleId: 'fe-a11y-contrast',
        method: 'visual',
        evidence: ['evidence/axe/app-builder-dark.json', 'evidence/axe/app-builder-light.json'],
        reason: 'built bundle changed (recorded aaaa, current bbbb)'
      }
    ]);
    expect(plan.measurers).toEqual(['a11y']);
    expect(plan.measurers).not.toContain('desktop_width');
    expect(plan.measurers).not.toContain('design_audit');
    expect(plan.judgeRuleIds).toEqual([]);
    expect(plan.unmapped).toEqual([]);
  });

  it('sends stale judge rules to the judge, not to a browser audit', () => {
    const plan = measurersForStale('pet-sitter', [
      {
        ruleId: 'u-conc-idiomatic',
        method: 'judge',
        evidence: ['pet-sitter/src/pages/Home.tsx'],
        reason: '2 file(s) under review changed since abcdef123456'
      }
    ]);
    expect(plan.measurers).toEqual([]);
    expect(plan.judgeRuleIds).toEqual(['u-conc-idiomatic']);
  });

  it('lists a visual verdict whose evidence no measurer writes, instead of stamping it', () => {
    const plan = measurersForStale('sushi-finder', [
      {
        ruleId: 'fe-premium-nav',
        method: 'visual',
        evidence: ['notes/handwritten.txt'],
        reason: 'built bundle changed'
      }
    ]);
    expect(plan.measurers).toEqual([]);
    expect(plan.unmapped.map((row) => row.ruleId)).toEqual(['fe-premium-nav']);
  });

  it('prints which rule and why', () => {
    const lines = formatStaleLines([
      { ruleId: 'fe-touch-targets', reason: 'built bundle changed (recorded aaaa, current bbbb)' }
    ]);
    expect(lines).toEqual([
      'fe-touch-targets: built bundle changed (recorded aaaa, current bbbb)'
    ]);
  });
});

describe('verdictStaleReason', () => {
  it('ignores source edits for a visual verdict whose bundle hash matches', () => {
    const decision = verdictStaleReason(
      { method: 'visual', bundleHash: 'a'.repeat(64), reviewedCommit: 'abcdef1234567890' },
      { changedFiles: ['app/src/lib/prd/generate.ts'], currentBundleHash: 'a'.repeat(64) }
    );
    expect(decision.stale).toBe(false);
  });

  it('stales a visual verdict with no bundle hash when source moved', () => {
    const decision = verdictStaleReason(
      { method: 'visual', reviewedCommit: 'abcdef1234567890' },
      { changedFiles: ['app/src/a.ts'], currentBundleHash: 'a'.repeat(64) }
    );
    expect(decision.stale).toBe(true);
    expect(decision.reason).toMatch(/1 file\(s\) under review changed/);
  });
});
