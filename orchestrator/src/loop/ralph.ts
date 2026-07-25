export interface GateOutcome {
  score: number;
  blockers: string[];
  /** Verbatim failing output fed to the next iteration. */
  feedback: string;
}

export interface LoopDeps {
  /** Invokes the coder (Grok) for iteration `i` with the prior iteration's feedback. */
  coder: (iteration: number, feedback: string) => Promise<void>;
  /** Runs the gate inline and returns the computed score. Never Grok's self-report. */
  gate: () => Promise<GateOutcome>;
}

export interface LoopConfig {
  threshold: number;
  maxIters: number;
  /**
   * Stop after this many consecutive iterations with no improvement over the
   * best score so far. A coder that cannot move the number is not going to move
   * it on the eighth try either, and every extra pass costs a full build.
   * Default 3. Set to 0 to disable.
   */
  stagnationLimit?: number;
  /**
   * Score that counts as "cleared" for flip-flop detection. A run that reaches
   * it and later falls back below it is escalated rather than looped
   * (rules/loop-gate.md: lg-score-flipflop-escalates). Defaults to `threshold`.
   */
  flipFlopThreshold?: number;
}

/** One recorded pass of the loop: what the gate actually measured that iteration. */
export interface IterationRecord {
  index: number;
  score: number;
  blockers: string[];
}

export interface LoopResult {
  passed: boolean;
  iterations: number;
  finalScore: number;
  /**
   * The highest score any iteration reached, and which one. The final score is
   * whatever the LAST pass produced, which is not the same thing: a run that
   * peaked at 88 on pass 3 and ended at 40 on pass 8 was previously recorded as
   * a 40 with no trace that a better state ever existed.
   */
  bestScore: number;
  bestIteration: number;
  /** True when the loop stopped before `maxIters` for a reason other than passing. */
  stoppedEarly: boolean;
  /** Why the loop stopped early, or null when it ran to a pass or to the cap. */
  stopReason: string | null;
  /** True when the score cleared `flipFlopThreshold` and later fell back below it. */
  flipFlopped: boolean;
  /** The ralph completion promise, emitted only from a real passing score, else null. */
  promise: string | null;
  history: number[];
  /**
   * Full per-iteration record (score AND blockers), in the exact shape a result
   * file's `iterations` field takes. Previously the loop kept only scores in
   * memory, so a multi-iteration history could not be backed by anything the
   * loop produced — it had to be supplied by hand, which is indistinguishable
   * from fabricating it. This is the artifact that makes it real.
   */
  records: IterationRecord[];
}

/** Consecutive non-improving iterations tolerated before the loop gives up. */
const DEFAULT_STAGNATION_LIMIT = 3;

/**
 * The ralph-driven iteration loop. Always bounded by `maxIters`; the completion
 * promise is emitted only when the inline gate score clears the threshold
 * (rules/loop-gate.md: lg-ralph-bounded, lg-score-is-inline). The coder is never
 * invoked after a passing score.
 */
export async function runLoop(deps: LoopDeps, cfg: LoopConfig): Promise<LoopResult> {
  const stagnationLimit = cfg.stagnationLimit ?? DEFAULT_STAGNATION_LIMIT;
  const flipFlopThreshold = cfg.flipFlopThreshold ?? cfg.threshold;

  let feedback = '';
  let finalScore = 0;
  let bestScore = -1;
  let bestIteration = 0;
  let sinceImprovement = 0;
  let everCleared = false;
  let flipFlopped = false;
  const history: number[] = [];
  const records: IterationRecord[] = [];

  for (let i = 1; i <= cfg.maxIters; i++) {
    await deps.coder(i, feedback);
    const g = await deps.gate();
    finalScore = g.score;
    history.push(g.score);
    records.push({ index: i, score: g.score, blockers: g.blockers });

    if (g.score > bestScore) {
      bestScore = g.score;
      bestIteration = i;
      sinceImprovement = 0;
    } else {
      sinceImprovement += 1;
    }

    // Crossing the bar and falling back is a different failure from never
    // reaching it: something the coder did later undid work that was already
    // measured good, and looping on it tends to oscillate rather than converge.
    if (g.score >= flipFlopThreshold) everCleared = true;
    else if (everCleared) flipFlopped = true;

    if (g.score >= cfg.threshold) {
      return {
        passed: true,
        iterations: i,
        finalScore,
        bestScore,
        bestIteration,
        stoppedEarly: false,
        stopReason: null,
        flipFlopped,
        promise: `<promise>SCORE>=${cfg.threshold}</promise>`,
        history,
        records
      };
    }

    if (stagnationLimit > 0 && sinceImprovement >= stagnationLimit) {
      return {
        passed: false,
        iterations: i,
        finalScore,
        bestScore,
        bestIteration,
        stoppedEarly: true,
        stopReason: `no improvement over ${bestScore}/100 in ${sinceImprovement} consecutive iterations`,
        flipFlopped,
        promise: null,
        history,
        records
      };
    }

    feedback = g.feedback;
  }

  return {
    passed: false,
    iterations: cfg.maxIters,
    finalScore,
    bestScore,
    bestIteration,
    stoppedEarly: false,
    stopReason: null,
    flipFlopped,
    promise: null,
    history,
    records
  };
}
