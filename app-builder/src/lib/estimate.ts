/** Inputs for the first-pass build cost estimate. */
export interface EstimateInput {
  /** Count of distinct product features. */
  features: number;
  /** Whether the app needs authentication. */
  hasAuth: boolean;
  /** Count of main domain entities. */
  entities: number;
}

/** Confidence band for the estimate (looser as scope grows). */
export type EstimateConfidence = 'low' | 'medium' | 'high';

/** Deterministic token-cost estimate result. */
export interface EstimateResult {
  /** Expected loop iterations (always >= 2). */
  iterations: number;
  /** Rough total token budget for the run. */
  tokens: number;
  /** How confident the heuristic is given scope size. */
  confidence: EstimateConfidence;
}

const BASE_TOKENS = 30_000;
const TOKENS_PER_FEATURE = 25_000;
const TOKENS_PER_ENTITY = 12_000;
const AUTH_TOKENS = 20_000;

/**
 * Deterministic first-pass token-cost estimate for a build job.
 * Pure and monotonic: more features or entities never lowers
 * iterations or tokens. Auth adds cost when enabled.
 */
export function estimate(input: EstimateInput): EstimateResult {
  const features = Math.max(0, input.features);
  const entities = Math.max(0, input.entities);
  const authExtra = input.hasAuth ? 1 : 0;

  const iterations = Math.max(
    2,
    Math.ceil(features / 2) + Math.ceil(entities / 3) + authExtra
  );

  const perIteration =
    BASE_TOKENS +
    features * TOKENS_PER_FEATURE +
    entities * TOKENS_PER_ENTITY +
    authExtra * AUTH_TOKENS;

  const tokens = perIteration * iterations;

  const weight = features + entities + authExtra;
  const confidence: EstimateConfidence =
    weight <= 3 ? 'high' : weight <= 8 ? 'medium' : 'low';

  return { iterations, tokens, confidence };
}
