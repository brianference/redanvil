/**
 * Types for the pure helpers in `meets_the_bar.mjs`.
 * Lets the TypeScript test suite import the finish-line checker under strict.
 */

export declare const DEFAULT_THRESHOLD: number;

export declare const FAIL_CLOSED_VISUAL_RULES: readonly string[];

export interface MeetBarVerdict {
  ok: boolean;
  slug: string;
  reasons: string[];
  fixCommand: string;
  finalScore?: number;
  threshold?: number;
  resultPath?: string | null;
}

export interface ParsedResult {
  finalScore: number | null;
  threshold: number;
  rules: Array<{ ruleId: string; passed: boolean }>;
  provenance: { commit: string | null } | null;
}

export declare function defaultRepoRoot(): string;
export declare function fixCommandFor(slug: string): string;
export declare function resolveResultPath(
  repoRoot: string,
  slug: string,
  appDir?: string
): string | null;
export declare function resolveVerdictsPath(
  repoRoot: string,
  slug: string,
  appDir?: string
): string | null;
export declare function commitTimeMs(commit: string, repoRoot: string): number | null;
export declare function isAncestor(
  repoRoot: string,
  commit: string,
  head?: string
): boolean | null;
export declare function newestSourceCommit(repoRoot: string, appDir: string): string | null;
export declare function parseResultShape(raw: unknown): ParsedResult | null;
export declare function scoreBarReasons(
  result: ParsedResult | null,
  opts?: { threshold?: number }
): string[];
export declare function freshnessReasons(
  repoRoot: string,
  appDir: string,
  provenanceCommit: string | null,
  resultPath: string | null
): string[];
export declare function visualCoverageReasons(
  repoRoot: string,
  slug: string,
  appDir?: string,
  verdictsPathOverride?: string | null
): string[];
export declare function evidenceAgeReasons(
  repoRoot: string,
  ruleId: string,
  reviewedCommit: string,
  evidence: string[]
): string[];
export declare function evaluateApp(
  repoRoot: string,
  app: { slug: string; dir: string },
  opts?: {
    threshold?: number;
    resultPath?: string | null;
    verdictsPath?: string | null;
    skipGit?: boolean;
    skipVisual?: boolean;
  }
): MeetBarVerdict;
export declare function evaluateApps(
  repoRoot: string,
  opts?: { slugs?: string[]; threshold?: number }
): MeetBarVerdict[];
export declare function appsAffectedByFiles(
  changedFiles: string[],
  apps?: readonly { slug: string; dir: string }[]
): { slug: string; dir: string }[];
export declare function filesInPushRange(
  repoRoot: string,
  localSha: string,
  remoteSha: string
): string[];
export declare function formatRefusal(v: MeetBarVerdict): string;
export declare function main(argv: string[], repoRoot?: string): number;
