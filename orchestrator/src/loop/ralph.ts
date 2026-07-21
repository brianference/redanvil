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
}

export interface LoopResult {
  passed: boolean;
  iterations: number;
  finalScore: number;
  /** The ralph completion promise, emitted only from a real passing score, else null. */
  promise: string | null;
  history: number[];
}

/**
 * The ralph-driven iteration loop. Always bounded by `maxIters`; the completion
 * promise is emitted only when the inline gate score clears the threshold
 * (rules/loop-gate.md: lg-ralph-bounded, lg-score-is-inline). The coder is never
 * invoked after a passing score.
 */
export async function runLoop(deps: LoopDeps, cfg: LoopConfig): Promise<LoopResult> {
  let feedback = '';
  let finalScore = 0;
  const history: number[] = [];

  for (let i = 1; i <= cfg.maxIters; i++) {
    await deps.coder(i, feedback);
    const g = await deps.gate();
    finalScore = g.score;
    history.push(g.score);
    if (g.score >= cfg.threshold) {
      return {
        passed: true,
        iterations: i,
        finalScore,
        promise: `<promise>SCORE>=${cfg.threshold}</promise>`,
        history
      };
    }
    feedback = g.feedback;
  }

  return { passed: false, iterations: cfg.maxIters, finalScore, promise: null, history };
}
