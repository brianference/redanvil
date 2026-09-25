import { describe, it, expect } from 'vitest';
import {
  groupRulesByLane,
  parseRun,
  parseRunsFeed,
  ruleLane,
  summarize,
  type Run
} from './summary';
import { validFeedRow } from './runFixture';

/**
 * Parse a row that must be valid.
 *
 * @param row - Feed row.
 * @returns The run the parser produced.
 */
function parsedRun(row: unknown): Run {
  const result = parseRun(row);
  if (!result.ok) throw new Error(`expected a valid row, got: ${result.reason}`);
  return result.run;
}

/**
 * Parse a row that must be rejected.
 *
 * @param row - Feed row.
 * @returns The rejection reason.
 */
function rejectReason(row: unknown): string {
  const result = parseRun(row);
  if (result.ok) throw new Error(`expected a rejected row, got run ${result.run.slug}`);
  return result.reason;
}

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
    finishedAt: partial.finishedAt ?? '2026-07-21T00:00:00.000Z',
    commit: partial.commit ?? null
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

describe('parseRun deployUrl', () => {
  // The deploy link is rendered as an href, so the parser is where an unsafe
  // scheme has to stop. A rejected URL nulls the link; the run still renders.
  it.each(['https://example.com', 'http://example.com', 'https://example.com/path'])(
    'keeps the http(s) link %s',
    (url) => {
      expect(parsedRun(validFeedRow({ deployUrl: url })).deployUrl).toBe(url);
    }
  );

  it.each([
    'javascript:alert(1)',
    ' javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    '//evil.example',
    'data:text/html,hi',
    'not a url',
    null,
    42
  ])('nulls the unsafe or junk link %j and keeps the run', (url) => {
    const run = parsedRun(validFeedRow({ deployUrl: url }));
    expect(run.slug).toBe('app-builder');
    expect(run.deployUrl).toBeNull();
  });
});

describe('parseRun', () => {
  it('parses a full feed row with rules and iterations', () => {
    const run = parsedRun(validFeedRow());
    expect(run.slug).toBe('app-builder');
    expect(run.evaluated).toBe(41);
    expect(run.total).toBe(41);
    expect(run.rules).toHaveLength(2);
    expect(run.rules[0]).toEqual({ ruleId: 'u-typing-strict', passed: true });
    expect(run.iterations).toHaveLength(2);
    expect(run.iterations[0]?.blockers).toEqual(['fe-responsive-375']);
    expect(run.deployUrl).toBe('https://redanvil.pages.dev');
    expect(run.commit).toBe('759920006033720125b9b211737469b163d63fe3');
  });

  it('nulls a malformed provenance commit while accepting the row', () => {
    const run = parsedRun(validFeedRow({ provenance: { commit: 'not-a-sha' } }));
    expect(run.slug).toBe('app-builder');
    expect(run.commit).toBeNull();
  });

  it('nulls unsafe deployUrl while accepting the row', () => {
    const run = parsedRun(validFeedRow({ deployUrl: 'javascript:void(0)' }));
    expect(run.deployUrl).toBeNull();
  });

  it('rejects when required fields are missing', () => {
    expect(rejectReason({ slug: 'x' })).toMatch('malformed run');
    expect(rejectReason(validFeedRow({ evaluated: undefined }))).toMatch('malformed run');
    expect(rejectReason(validFeedRow({ total: '41' }))).toMatch('malformed run');
    expect(rejectReason(validFeedRow({ rules: 'nope' }))).toMatch('malformed run');
  });

  it('rejects when a rule entry is malformed, and says which field', () => {
    // The message now names the failing path instead of a fixed string, so a
    // feed regression tells you what changed shape.
    expect(rejectReason(validFeedRow({ rules: [{ ruleId: 'u-x' }] }))).toMatch(/rules\.0\.passed/);
    expect(rejectReason(validFeedRow({ rules: [{ passed: true }] }))).toMatch(/rules\.0\.ruleId/);
  });

  it('rejects when an iteration entry is malformed, and says which field', () => {
    expect(
      rejectReason(validFeedRow({ iterations: [{ index: 1, score: 0, blockers: [1] }] }))
    ).toMatch(/iterations\.0\.blockers\.0/);
    expect(rejectReason(validFeedRow({ iterations: [{ index: 1 }] }))).toMatch(
      /iterations\.0\.score/
    );
  });

  // Values the hand-rolled `typeof` chain accepted because it only asked about
  // the type, never the value. `typeof NaN === 'number'` is the classic one.
  it('rejects numerically absurd rows the old typeof narrowing let through', () => {
    expect(rejectReason(validFeedRow({ finalScore: Number.NaN }))).toMatch(/finalScore/);
    expect(rejectReason(validFeedRow({ total: -1 }))).toMatch(/total/);
    expect(rejectReason(validFeedRow({ evaluated: 1.5 }))).toMatch(/evaluated/);
    expect(rejectReason(validFeedRow({ slug: '' }))).toMatch(/slug/);
    expect(rejectReason(validFeedRow({ finishedAt: '' }))).toMatch(/finishedAt/);
  });
});

describe('parseRunsFeed', () => {
  it('parses an array of rows', () => {
    const { runs, rejected } = parseRunsFeed([validFeedRow(), validFeedRow({ slug: 'other' })]);
    expect(runs.map((run) => run.slug)).toEqual(['app-builder', 'other']);
    expect(rejected).toEqual([]);
  });

  it('throws when the root is not an array', () => {
    expect(() => parseRunsFeed({ runs: [] })).toThrow('malformed results feed');
  });

  it('keeps the valid rows and reports each bad one instead of hiding them all', () => {
    const { runs, rejected } = parseRunsFeed([validFeedRow(), { slug: 'bad' }]);
    expect(runs.map((run) => run.slug)).toEqual(['app-builder']);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatch(/malformed run at finalScore/);
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
