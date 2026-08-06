/**
 * Ambient types for concurrent `.github/scripts/*.mjs` modules imported by tests.
 * Sibling `*.d.mts` next to the scripts is not always resolved under this
 * package's moduleResolution; these declarations keep `tsc --noEmit` honest.
 */

declare module '../../.github/scripts/meets_the_bar.mjs' {
  export const DEFAULT_THRESHOLD: number;
  export const FAIL_CLOSED_VISUAL_RULES: readonly string[];

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

  export function defaultRepoRoot(): string;
  export function fixCommandFor(slug: string): string;
  export function resolveResultPath(
    repoRoot: string,
    slug: string,
    appDir?: string
  ): string | null;
  export function resolveVerdictsPath(
    repoRoot: string,
    slug: string,
    appDir?: string
  ): string | null;
  export function commitTimeMs(commit: string, repoRoot: string): number | null;
  export function isAncestor(
    repoRoot: string,
    commit: string,
    head?: string
  ): boolean | null;
  export function newestSourceCommit(repoRoot: string, appDir: string): string | null;
  export function parseResultShape(raw: unknown): ParsedResult | null;
  export function scoreBarReasons(
    result: ParsedResult | null,
    // `waivedRules` arrived with the release-waiver work; the shim was not
    // updated, so callers that pass it were type errors against a function that
    // reads it.
    opts?: { threshold?: number; waivedRules?: string[] }
  ): string[];
  export function freshnessReasons(
    repoRoot: string,
    appDir: string,
    provenanceCommit: string | null,
    resultPath: string | null
  ): string[];
  export function visualCoverageReasons(
    repoRoot: string,
    slug: string,
    appDir?: string,
    verdictsPathOverride?: string | null
  ): string[];
  export function evidenceAgeReasons(
    repoRoot: string,
    ruleId: string,
    reviewedCommit: string,
    evidence: string[]
  ): string[];
  export function evaluateApp(
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
  export function evaluateApps(
    repoRoot: string,
    opts?: { slugs?: string[]; threshold?: number }
  ): MeetBarVerdict[];
  export function appsAffectedByFiles(
    changedFiles: string[],
    apps?: readonly { slug: string; dir: string }[]
  ): { slug: string; dir: string }[];
  export function filesInPushRange(
    repoRoot: string,
    localSha: string,
    remoteSha: string
  ): string[];
  export function formatRefusal(v: MeetBarVerdict): string;
  export function main(argv: string[], repoRoot?: string): number;
}

declare module '../../.github/scripts/apps.mjs' {
  export type CoreFlow = 'search' | 'wizard';
  export interface GatedApp {
    slug: string;
    dir: string;
    url: string;
    designRoutes: string;
    widthRoutes: string | null;
    e2e: boolean;
    wizard: boolean;
    coreFlow: CoreFlow;
    na: string;
  }
  export const CORE_APPS: readonly GatedApp[];
  export const APPS: readonly GatedApp[];
  export function loadManagedApps(repoRoot?: string): GatedApp[];
  export function getApps(repoRoot?: string): readonly GatedApp[];
  export function appBySlug(slug: string, repoRoot?: string): GatedApp | undefined;
  export function coreFlowForSlug(slug: string): CoreFlow;
}
