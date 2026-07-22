import { describe, it, expect } from 'vitest';
import {
  groupRulesByLane,
  parseRun,
  parseRunsFeed,
  ruleLane,
  safeUrl,
  summarize,
  type Run
} from './summary';

/**
 * Build a full Run for tests with optional field overrides.
 */
function makeRun(partial: Pick<Run, 'finalScore' | 'passed'> & Partial<Run>): Run {
  return {
    slug: partial.slug ?? 'test-app',
    finalScore: partial.finalScore,
    threshold: partial.threshold ?? 90,
    passed: partial.passed,
    evaluated: partial.evaluated ?? 41,
    total: partial.total ?? 41,
    rules: partial.rules ?? [
      { ruleId: 'u-typing-strict', passed: true },
      { ruleId: 'fe-theme-tokens-only', passed: true }
    ],
    iterations: partial.iterations ?? [{ index: 1, score: partial.finalScore, blockers: [] }],
    deployUrl: partial.deployUrl ?? null,
    finishedAt: partial.finishedAt ?? '2026-07-21T00:00:00.000Z'
  };
}

/** Minimal valid feed row matching results/all.json shape. */
function validFeedRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'results',
    slug: 'app-builder',
    finalScore: 100,
    threshold: 90,
    passed: true,
    evaluated: 41,
    total: 41,
    rules: [
      { ruleId: 'u-typing-strict', passed: true },
      { ruleId: 'fe-responsive-375', passed: false }
    ],
    iterations: [
      { index: 1, score: 0, blockers: ['fe-responsive-375'] },
      { index: 2, score: 100, blockers: [] }
    ],
    deployUrl: 'https://redanvil.pages.dev',
    finishedAt: '2026-07-21T16:40:00.000Z',
    ...overrides
  };
}

describe('summarize', () => {
  it('returns zeros for an empty list', () => {
    expect(summarize([])).toEqual({ total: 0, passed: 0, avgScore: 0 });
  });

  it('counts how many runs passed', () => {
    const runs: Run[] = [
      makeRun({ finalScore: 90, passed: true }),
      makeRun({ finalScore: 80, passed: false }),
      makeRun({ finalScore: 95, passed: true })
    ];
    const result = summarize(runs);
    expect(result.total).toBe(3);
    expect(result.passed).toBe(2);
  });

  it('computes the average final score', () => {
    const runs: Run[] = [
      makeRun({ finalScore: 90, passed: true }),
      makeRun({ finalScore: 80, passed: false }),
      makeRun({ finalScore: 100, passed: true })
    ];
    expect(summarize(runs).avgScore).toBe(90);
  });

  it('treats a single run as total 1 with its own score', () => {
    const result = summarize([makeRun({ finalScore: 72, passed: false })]);
    expect(result).toEqual({ total: 1, passed: 0, avgScore: 72 });
  });
});

describe('safeUrl', () => {
  it('keeps http and https URLs', () => {
    expect(safeUrl('https://example.com')).toBe('https://example.com');
    expect(safeUrl('http://example.com')).toBe('http://example.com');
  });

  it('rejects non-http schemes and junk', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,hi')).toBeNull();
    expect(safeUrl('not a url')).toBeNull();
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl(42)).toBeNull();
  });
});

describe('parseRun', () => {
  it('parses a full feed row with rules and iterations', () => {
    const run = parseRun(validFeedRow());
    expect(run.slug).toBe('app-builder');
    expect(run.evaluated).toBe(41);
    expect(run.total).toBe(41);
    expect(run.rules).toHaveLength(2);
    expect(run.rules[0]).toEqual({ ruleId: 'u-typing-strict', passed: true });
    expect(run.iterations).toHaveLength(2);
    expect(run.iterations[0]?.blockers).toEqual(['fe-responsive-375']);
    expect(run.deployUrl).toBe('https://redanvil.pages.dev');
  });

  it('nulls unsafe deployUrl while accepting the row', () => {
    const run = parseRun(validFeedRow({ deployUrl: 'javascript:void(0)' }));
    expect(run.deployUrl).toBeNull();
  });

  it('throws when required fields are missing', () => {
    expect(() => parseRun({ slug: 'x' })).toThrow('malformed run');
    expect(() => parseRun(validFeedRow({ evaluated: undefined }))).toThrow('malformed run');
    expect(() => parseRun(validFeedRow({ total: '41' }))).toThrow('malformed run');
    expect(() => parseRun(validFeedRow({ rules: 'nope' }))).toThrow('malformed run');
  });

  it('throws when a rule entry is malformed', () => {
    expect(() => parseRun(validFeedRow({ rules: [{ ruleId: 'u-x' }] }))).toThrow('malformed rule');
    expect(() => parseRun(validFeedRow({ rules: [{ passed: true }] }))).toThrow('malformed rule');
  });

  it('throws when an iteration entry is malformed', () => {
    expect(() =>
      parseRun(validFeedRow({ iterations: [{ index: 1, score: 0, blockers: [1] }] }))
    ).toThrow('malformed iteration');
    expect(() => parseRun(validFeedRow({ iterations: [{ index: 1 }] }))).toThrow(
      'malformed iteration'
    );
  });
});

describe('parseRunsFeed', () => {
  it('parses an array of rows', () => {
    const runs = parseRunsFeed([validFeedRow(), validFeedRow({ slug: 'other' })]);
    expect(runs).toHaveLength(2);
    expect(runs[1]?.slug).toBe('other');
  });

  it('throws when the root is not an array', () => {
    expect(() => parseRunsFeed({ runs: [] })).toThrow('malformed results feed');
  });

  it('fails closed when any row is bad', () => {
    expect(() => parseRunsFeed([validFeedRow(), { slug: 'bad' }])).toThrow('malformed run');
  });
});

describe('ruleLane and groupRulesByLane', () => {
  it('extracts the prefix before the first hyphen', () => {
    expect(ruleLane('fe-theme-tokens-only')).toBe('fe');
    expect(ruleLane('u-typing-strict')).toBe('u');
    expect(ruleLane('hyg-env-ignored')).toBe('hyg');
    expect(ruleLane('solo')).toBe('solo');
  });

  it('groups and sorts rules by lane then ruleId', () => {
    const groups = groupRulesByLane([
      { ruleId: 'fe-b', passed: true },
      { ruleId: 'u-a', passed: false },
      { ruleId: 'fe-a', passed: true },
      { ruleId: 'hyg-z', passed: true }
    ]);
    expect(groups.map((g) => g.lane)).toEqual(['fe', 'hyg', 'u']);
    expect(groups[0]?.rules.map((r) => r.ruleId)).toEqual(['fe-a', 'fe-b']);
    expect(groups[2]?.rules[0]?.passed).toBe(false);
  });
});
