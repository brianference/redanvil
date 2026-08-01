/**
 * Types for pure helpers in `proc-artifact-verified.mjs`.
 */

export declare const MIN_BINARY_BYTES: number;
export declare const MIN_TEXT_BYTES: number;

export declare function isPlanArtifact(repoRel: string): boolean;

export declare function jsonTrivialReason(body: unknown): string | null;

export declare function validateEvidencePath(
  ruleId: string,
  evidencePath: string,
  repoRoot: string,
  reviewedCommit: string
): string[];

export declare function validateVerdicts(
  verdicts: unknown[],
  repoRoot: string
): string[];
