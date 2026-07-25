import { describe, it, expect } from 'vitest';
import { scoreRun, secretsInEnv, RUN_RULES, type RunFacts } from '../src/loop/runRules';

/**
 * A run that honours the whole operational contract, so each test varies one fact.
 * @param over Fields to override.
 * @returns Complete run facts.
 */
function facts(over: Partial<RunFacts> = {}): RunFacts {
  return {
    isolated: true,
    coderTimeoutMs: 600_000,
    coderEnv: { PATH: '/usr/bin', HOME: '/home/x' },
    maxIters: 8,
    gatedIterations: 3,
    iterations: 3,
    estimatedIterations: 4,
    flipFlopped: false,
    ...over
  };
}

/**
 * Look up one rule's outcome.
 * @param outcomes Scored outcomes.
 * @param id Rule id.
 * @returns The outcome, or undefined.
 */
function byId(
  outcomes: ReturnType<typeof scoreRun>,
  id: string
): { ruleId: string; passed: boolean; detail?: string } | undefined {
  return outcomes.find((o) => o.ruleId === id);
}

describe('operational run rules', () => {
  it('every scored run rule is declared in rules/loop-gate.md', async () => {
    // The corpus file is the written contract; RUN_RULES is what enforces it.
    // Binding them stops the enforcement drifting away from the document the
    // way the 30 lg-* rules already did once.
    const { readFile } = await import('node:fs/promises');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const corpus = await readFile(join(repoRoot, 'rules', 'loop-gate.md'), 'utf8');
    const undeclared = RUN_RULES.map((r) => r.id).filter((id) => !corpus.includes(id));
    expect(undeclared, `scored but not declared in loop-gate.md: ${undeclared.join(', ')}`).toEqual(
      []
    );
  });

  it('scores every declared run rule', () => {
    const outcomes = scoreRun(facts());
    expect(outcomes).toHaveLength(RUN_RULES.length);
    expect(outcomes.every((o) => o.passed)).toBe(true);
  });

  it('fails worktree isolation when the coder edited the live tree', () => {
    const o = byId(scoreRun(facts({ isolated: false })), 'lg-worktree-isolation');
    expect(o?.passed).toBe(false);
    expect(o?.detail).toMatch(/live working tree/);
  });

  it('fails when the coder ran without a timeout', () => {
    expect(byId(scoreRun(facts({ coderTimeoutMs: null })), 'lg-grok-timeout')?.passed).toBe(false);
  });

  it('fails when a secret-shaped variable reaches the coder', () => {
    const o = byId(
      scoreRun(facts({ coderEnv: { PATH: '/usr/bin', GITHUB_TOKEN: 'abc123' } })),
      'lg-grok-no-secrets'
    );
    expect(o?.passed).toBe(false);
    expect(o?.detail).toMatch(/GITHUB_TOKEN/);
  });

  it('does not flag an empty secret-shaped variable', () => {
    // An unset name carries nothing, and treating it as a leak trains people to
    // ignore the rule.
    expect(secretsInEnv({ API_KEY: '' })).toEqual([]);
  });

  it('fails an unbounded loop', () => {
    expect(byId(scoreRun(facts({ maxIters: Infinity })), 'lg-ralph-bounded')?.passed).toBe(false);
    expect(byId(scoreRun(facts({ maxIters: 0 })), 'lg-ralph-bounded')?.passed).toBe(false);
  });

  it('fails when an iteration advanced without a gate score', () => {
    const o = byId(scoreRun(facts({ iterations: 4, gatedIterations: 3 })), 'lg-score-is-inline');
    expect(o?.passed).toBe(false);
    expect(o?.detail).toMatch(/3 of 4/);
  });

  it('fails a flip-flopped run', () => {
    expect(
      byId(scoreRun(facts({ flipFlopped: true })), 'lg-score-flipflop-escalates')?.passed
    ).toBe(false);
  });

  it('fails a run that overran 1.5x its estimated budget', () => {
    // 4 estimated -> ceiling 6. Seven iterations is over.
    expect(
      byId(scoreRun(facts({ estimatedIterations: 4, iterations: 7 })), 'lg-budget-ceiling')?.passed
    ).toBe(false);
    expect(
      byId(scoreRun(facts({ estimatedIterations: 4, iterations: 6 })), 'lg-budget-ceiling')?.passed
    ).toBe(true);
  });

  it('does not fail the budget rule when nothing was estimated', () => {
    expect(
      byId(scoreRun(facts({ estimatedIterations: null, iterations: 99 })), 'lg-budget-ceiling')
        ?.passed
    ).toBe(true);
  });
});
