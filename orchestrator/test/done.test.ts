/**
 * Known-answer fixtures for isDone — the single definition of finished.
 *
 * A result at 89, or with one failing rule, or with stale evidence, is NOT done.
 * Callers must not invent their own bar.
 */
import { describe, it, expect } from 'vitest';
import {
  isDone,
  isDoneBoolean,
  DEFAULT_DONE_THRESHOLD,
  REQUIRED_DONE_RULES,
  type DoneResult
} from '../src/gate/done';

/**
 * Build a result that would look "almost done" so each test can break one axis.
 *
 * @param overrides - Partial fields to merge.
 * @returns A DoneResult with every required rule green.
 */
function almostDone(overrides: Partial<DoneResult> = {}): DoneResult {
  // Explicit string ruleIds — REQUIRED_DONE_RULES is a narrow const tuple, and
  // concatenating other ids must stay assignable to DoneResult['rules'].
  const rules: Array<{ ruleId: string; passed: boolean }> = [
    ...REQUIRED_DONE_RULES.map((ruleId: string) => ({ ruleId, passed: true })),
    { ruleId: 'fe-light-dark', passed: true },
    { ruleId: 'u-typing-strict', passed: true }
  ];
  return {
    finalScore: 92,
    threshold: DEFAULT_DONE_THRESHOLD,
    rules,
    ...overrides
  };
}

/**
 * Isolate the score/rule predicates from the definition-of-done checklist.
 *
 * These fixtures are two-rule stubs, not real gate results, so every checklist
 * row would report unmeasured and drown the axis each test is trying to break.
 * `skipChecklist` exists only for this file — `doneChecklist.test.ts` asserts no
 * production call site passes it, because a waiver nobody can see is how
 * `proc-full-local-suite` stayed permanently waived.
 */
const NO_CHECKLIST = { skipChecklist: true } as const;

describe('isDone', () => {
  it('returns done for a green result with every required rule', () => {
    const v = isDone(almostDone(), NO_CHECKLIST);
    expect(v.reasons).toEqual([]);
    expect(v.done).toBe(true);
    expect(isDoneBoolean(almostDone(), NO_CHECKLIST)).toBe(true);
  });

  it('a green result is NOT done once the real checklist is evaluated', () => {
    // The same fixture, without the escape hatch. This is the behaviour change:
    // clearing the threshold with every required rule green is no longer the
    // finish line, because rows like "npm run build exits 0" are unmeasured.
    const v = isDone(almostDone());
    expect(v.done).toBe(false);
    expect(v.reasons.some((r) => r.startsWith('done-checklist'))).toBe(true);
  });

  it('an unreadable checklist fails rather than passing vacuously', () => {
    const v = isDone(almostDone(), { checklistPath: 'no/such/DONE-CHECKLIST.md' });
    expect(v.done).toBe(false);
    expect(v.reasons.some((r) => /could not be read/.test(r))).toBe(true);
  });

  it('is NOT done at score 89', () => {
    const v = isDone(almostDone({ finalScore: 89 }));
    expect(v.done).toBe(false);
    expect(v.reasons.some((r) => /below the finish-line threshold/.test(r))).toBe(true);
  });

  it('is NOT done with one failing rule', () => {
    const base = almostDone();
    const rules = base.rules.map((r) =>
      r.ruleId === 'fe-light-dark' ? { ...r, passed: false } : r
    );
    const v = isDone({ ...base, finalScore: 0, rules });
    expect(v.done).toBe(false);
    expect(v.reasons.some((r) => /passed === false/.test(r))).toBe(true);
  });

  it('is NOT done with stale evidence', () => {
    const v = isDone(almostDone(), { evidenceStale: true });
    expect(v.done).toBe(false);
    expect(v.reasons.some((r) => /stale/.test(r))).toBe(true);
  });

  it('is NOT done when a required rule is simply missing from the result', () => {
    const v = isDone({
      finalScore: 100,
      threshold: 90,
      rules: [{ ruleId: 'u-typing-strict', passed: true }]
    });
    expect(v.done).toBe(false);
    for (const id of REQUIRED_DONE_RULES) {
      expect(v.reasons.some((r) => r.includes(id))).toBe(true);
    }
  });

  it('is NOT done when coverage is below the high-water', () => {
    const v = isDone(almostDone(), { coveragePct: 40, coverageHighWater: 72 });
    expect(v.done).toBe(false);
    expect(v.reasons.some((r) => /high-water/.test(r))).toBe(true);
  });

  it('is NOT done when screenshots are missing', () => {
    const v = isDone(almostDone(), { screenshotsPresent: false });
    expect(v.done).toBe(false);
    expect(v.reasons.some((r) => /screenshot/i.test(r))).toBe(true);
  });

  it('is NOT done when the independent review step failed', () => {
    const v = isDone(almostDone(), { independentReviewOk: false });
    expect(v.done).toBe(false);
    expect(v.reasons.some((r) => /independent judge/i.test(r))).toBe(true);
  });

  it('is NOT done when lg-shipped is false', () => {
    const base = almostDone();
    const rules = base.rules.map((r) =>
      r.ruleId === 'lg-shipped' ? { ...r, passed: false } : r
    );
    const v = isDone({ ...base, finalScore: 0, rules });
    expect(v.done).toBe(false);
    expect(v.reasons.some((r) => /lg-shipped|shipped/i.test(r))).toBe(true);
  });
});
