import { scrubbedEnv } from '../process/run';
import { execFileSync } from 'node:child_process';
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
    id: 'lg-run-on-scratch-branch',
    severity: 'blocker',
    requirement: 'the coder ran on a disposable branch, never a default one'
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
  /**
   * True when the coder edited a disposable worktree.
   *
   * SELF-REPORTED, and that is the weakness. `secretsInEnv` exists because a
   * previous audit learned that `scrubbedEnv` being called somewhere is not
   * evidence a call site used its result — it inspects the environment actually
   * delivered. Every other fact here is still testimony from the caller, which
   * means the loop's own contract is graded on what the loop says it did.
   *
   * Prefer `coderDir`: when it is supplied, isolation is MEASURED and this
   * boolean is ignored.
   */
  isolated: boolean;
  /**
   * Directory the coder actually ran in, when known.
   *
   * Supplying it turns lg-worktree-isolation from a claim into an observation:
   * a linked worktree's `--git-dir` differs from its `--git-common-dir`, which
   * a live working tree's does not. Optional so existing callers keep working,
   * but a run that cannot be observed is reported as such rather than trusted.
   */
  coderDir?: string | null;
  /**
   * Branch the coder's tree was on, when known. `lg-run-on-scratch-branch`
   * requires a disposable branch, never the default one.
   */
  coderBranch?: string | null;
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

/** Branches a scratch run must never be on. */
const DEFAULT_BRANCHES: ReadonlySet<string> = new Set(['main', 'master', 'develop', 'HEAD']);

/**
 * Whether the coder's directory is genuinely a linked git worktree.
 *
 * A linked worktree's `--git-dir` points at `.git/worktrees/<name>` while its
 * `--git-common-dir` points at the original `.git`; in a normal working tree
 * the two are the same path. That difference is observable, which is the whole
 * point: it replaces the caller asserting `isolated: true` with the filesystem
 * being asked.
 *
 * @param dir - Directory the coder ran in, or null/undefined when unknown.
 * @returns Whether isolation could be observed, and what was seen.
 */
export function observeIsolation(dir: string | null | undefined): {
  observed: boolean;
  isolated: boolean;
  reason: string;
} {
  if (typeof dir !== 'string' || dir === '') {
    return { observed: false, isolated: false, reason: 'no directory supplied' };
  }
  const read = (args: string[]): string | null => {
    try {
      return execFileSync('git', ['-C', dir, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
    } catch {
      return null;
    }
  };
  const gitDir = read(['rev-parse', '--absolute-git-dir']);
  const commonDir = read(['rev-parse', '--path-format=absolute', '--git-common-dir']);
  if (gitDir === null || commonDir === null) {
    return { observed: false, isolated: false, reason: `${dir} is not a git repository` };
  }
  const isolated = gitDir !== commonDir;
  return {
    observed: true,
    isolated,
    reason: isolated
      ? `${dir} is a linked worktree (git-dir differs from git-common-dir)`
      : `${dir} is the live working tree; a bad run cannot be discarded cleanly`
  };
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
  const isolation = observeIsolation(facts.coderDir);
  const budgetCeiling =
    facts.estimatedIterations === null
      ? null
      : Math.ceil(facts.estimatedIterations * BUDGET_OVERRUN_FACTOR);

  const results: Array<{ id: string; passed: boolean; detail?: string }> = [
    {
      id: 'lg-worktree-isolation',
      // Observed when we can observe it, and only then falling back to the
      // caller's word. A rule graded on the subject's own account of itself is
      // the same defect as a rule whose text promises more than its check
      // measures, one level up.
      // Fail-closed, and deliberately not 'trust the caller when we cannot
      // look'. An unobserved run is an unverified one, and the repo already
      // treats unknown state as an explicit failure everywhere else. The first
      // draft of this rule passed on facts.isolated when no directory was
      // supplied, which is the same defect one level up: the subject grading
      // itself. loop.ts now always supplies coderDir, so the only way to land
      // here is a caller that declined to be observed.
      passed: isolation.observed && isolation.isolated,
      detail: isolation.observed
        ? `measured: ${isolation.reason}`
        : `isolation was never observed (${isolation.reason}); caller asserted ` +
          `isolated=${facts.isolated}, which is testimony, not measurement`
    },
    {
      id: 'lg-run-on-scratch-branch',
      // A disposable branch is what makes a bad run discardable. Unknown is a
      // failure, not an exemption.
      passed:
        typeof facts.coderBranch === 'string' &&
        facts.coderBranch !== '' &&
        !DEFAULT_BRANCHES.has(facts.coderBranch),
      detail:
        facts.coderBranch === undefined || facts.coderBranch === null
          ? 'the branch the coder ran on was never recorded, so it cannot be shown to be disposable'
          : `the coder ran on "${facts.coderBranch}", which is a default branch, not a scratch one`
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
      // An UNESTIMATED run is an unbudgeted run. This used to pass whenever
      // estimatedIterations was null -- the single most common case -- so the
      // rule was green precisely when no budget existed to enforce. A vacuous
      // pass is indistinguishable from a real one on the scoreboard.
      passed: budgetCeiling !== null && facts.iterations <= budgetCeiling,
      detail:
        budgetCeiling === null
          ? 'no pre-flight iteration estimate, so the run had no budget to stay inside'
          : `ran ${facts.iterations} iterations against a ceiling of ${budgetCeiling}`
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
