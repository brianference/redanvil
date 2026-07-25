import { scrubbedEnv } from '../process/run';
import type { Outcome } from '../gate/score';

/**
 * The operational contract in `rules/loop-gate.md`, scored.
 *
 * That file declares 30 `lg-*` rules and calls most of them blockers. None of
 * them were encoded anywhere: they appeared in the codebase only as comments
 * next to the code that was supposed to honour them. So the orchestrator's own
 * contract — isolation, secret containment, bounded iteration, no deploy from
 * the coder — was asserted on every run and measured on none, which is exactly
 * the "declared but unimplemented" failure the app rubric already fixed one
 * level down.
 *
 * These are run-level rules: they describe how a build was conducted, not what
 * the code looks like, so they are scored from the run's own record rather than
 * by a static check against an app directory.
 */
export interface RunRule {
  id: string;
  severity: 'blocker' | 'major';
  /** What the rule requires, printed when it fails. */
  requirement: string;
}

export const RUN_RULES: RunRule[] = [
  {
    id: 'lg-worktree-isolation',
    severity: 'blocker',
    requirement: 'the coder ran in a disposable git worktree, not the live tree'
  },
  {
    id: 'lg-grok-timeout',
    severity: 'blocker',
    requirement: 'every coder invocation carried a finite wall-clock timeout'
  },
  {
    id: 'lg-grok-no-secrets',
    severity: 'blocker',
    requirement: 'no secret-shaped variable reached the coder environment'
  },
  {
    id: 'lg-ralph-bounded',
    severity: 'blocker',
    requirement: 'the loop was bounded by a finite maxIters of at least 1'
  },
  {
    id: 'lg-score-is-inline',
    severity: 'blocker',
    requirement: 'every iteration was scored by the inline gate, never a self-report'
  },
  {
    id: 'lg-score-flipflop-escalates',
    severity: 'major',
    requirement: 'the score did not clear the threshold and then fall back'
  },
  {
    id: 'lg-budget-ceiling',
    severity: 'major',
    requirement: 'the run stayed within 1.5x its estimated iteration budget'
  }
];

/** Everything the run-rule scorer needs to know about a completed loop. */
export interface RunFacts {
  /** True when the coder edited a disposable worktree. */
  isolated: boolean;
  /** Per-iteration coder timeout in ms, or null when none was set. */
  coderTimeoutMs: number | null;
  /** Environment actually handed to the coder. */
  coderEnv: NodeJS.ProcessEnv;
  /** Iteration cap the loop was configured with. */
  maxIters: number;
  /** Number of iterations that produced a real gate score. */
  gatedIterations: number;
  /** Iterations actually run. */
  iterations: number;
  /** Pre-flight estimate of iterations needed, or null when not estimated. */
  estimatedIterations: number | null;
  /** True when the score cleared the threshold and later fell back below it. */
  flipFlopped: boolean;
}

/** Variable-name shapes that must never reach the coder's environment. */
const SECRET_NAME = /(_|^)(TOKEN|KEY|SECRET|PASSWORD|PASSWD|CREDENTIAL|API_KEY|PAT)(_|$)/i;

/** Multiplier on the estimated iteration budget before a run is over ceiling. */
const BUDGET_OVERRUN_FACTOR = 1.5;

/**
 * Decide whether a secret-shaped variable survived into the coder environment.
 *
 * Checked against the environment that was actually passed, not against the
 * intent to scrub one: `scrubbedEnv` being called somewhere is not evidence that
 * the call site used its result.
 *
 * @param env - Environment handed to the coder.
 * @returns Names of offending variables.
 */
export function secretsInEnv(env: NodeJS.ProcessEnv): string[] {
  return Object.keys(env)
    .filter((name) => SECRET_NAME.test(name))
    .filter((name) => (env[name] ?? '').length > 0)
    .sort();
}

/**
 * Score the operational rules against a completed run.
 *
 * @param facts - What the run actually did.
 * @returns One outcome per run rule, with a diagnostic on every failure.
 */
export function scoreRun(facts: RunFacts): Outcome[] {
  const leaked = secretsInEnv(facts.coderEnv);
  const budgetCeiling =
    facts.estimatedIterations === null
      ? null
      : Math.ceil(facts.estimatedIterations * BUDGET_OVERRUN_FACTOR);

  const results: Array<{ id: string; passed: boolean; detail?: string }> = [
    {
      id: 'lg-worktree-isolation',
      passed: facts.isolated,
      detail: 'the coder edited the live working tree; a bad run cannot be discarded cleanly'
    },
    {
      id: 'lg-grok-timeout',
      passed: facts.coderTimeoutMs !== null && Number.isFinite(facts.coderTimeoutMs),
      detail: 'the coder ran with no wall-clock ceiling, so a wedged process can stall the loop'
    },
    {
      id: 'lg-grok-no-secrets',
      passed: leaked.length === 0,
      detail: `secret-shaped variables reached the coder environment: ${leaked.join(', ')}`
    },
    {
      id: 'lg-ralph-bounded',
      passed: Number.isFinite(facts.maxIters) && facts.maxIters >= 1,
      detail: `maxIters was ${facts.maxIters}; the loop must be bounded`
    },
    {
      id: 'lg-score-is-inline',
      // Every iteration must have produced a gate score. A gap means an
      // iteration advanced on something other than a measurement.
      passed: facts.gatedIterations === facts.iterations && facts.iterations > 0,
      detail: `${facts.gatedIterations} of ${facts.iterations} iterations produced a gate score`
    },
    {
      id: 'lg-score-flipflop-escalates',
      passed: !facts.flipFlopped,
      detail: 'the score cleared the threshold and then regressed — escalate rather than loop'
    },
    {
      id: 'lg-budget-ceiling',
      passed: budgetCeiling === null || facts.iterations <= budgetCeiling,
      detail: `ran ${facts.iterations} iterations against a ceiling of ${budgetCeiling ?? 'none'}`
    }
  ];

  return results.map((r) =>
    r.passed ? { ruleId: r.id, passed: true } : { ruleId: r.id, passed: false, detail: r.detail }
  );
}

/**
 * The environment the coder should be given. Re-exported here so a caller wiring
 * a new coder path reaches for the scrubbed one by default.
 *
 * @returns Environment with secret-shaped variables removed.
 */
export function coderEnv(): NodeJS.ProcessEnv {
  return scrubbedEnv([]);
}
