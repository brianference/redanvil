export interface PlanShape {
  tasks: number;
  features: number;
}

export interface TokenEstimate {
  iterations: number;
  grokTokens: number;
  claudeTokens: number;
  confidence: 'low' | 'medium' | 'high';
}

const GROK_TOKENS_PER_TASK_ITER = 50_000;
const CLAUDE_SHARE_OF_GROK = 0.4;

/**
 * Deterministic pre-flight token estimate. Monotonic in both inputs so a bigger
 * plan never estimates cheaper. Surfaced before the loop spends a token
 * (rules/loop-gate.md: lg-budget-ceiling).
 */
export function estimateTokens(plan: PlanShape): TokenEstimate {
  const iterations = Math.max(2, Math.ceil(plan.features / 2) + 1);
  const grokTokens = plan.tasks * GROK_TOKENS_PER_TASK_ITER * iterations;
  const claudeTokens = Math.round(grokTokens * CLAUDE_SHARE_OF_GROK);
  const confidence = plan.features <= 3 ? 'high' : plan.features <= 8 ? 'medium' : 'low';
  return { iterations, grokTokens, claudeTokens, confidence };
}
