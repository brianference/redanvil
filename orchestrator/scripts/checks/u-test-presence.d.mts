/**
 * Types for the pure helpers in `u-test-presence.mjs`.
 *
 * The check is `.mjs` like every other check in this directory -- they run as
 * standalone scripts under `check.mjs` with no build step. The surface-scoping
 * logic decides which changed files the rule is entitled to judge, which is
 * worth a direct unit test rather than only being reached by spawning a
 * subprocess and reading its stderr.
 */
export declare const STATE_FILE: string;
export declare const SUMMARY_FILE: string;
export declare function isGeneratedApp(appDir: string): boolean;
export declare function measuredDirs(appDir: string): string[];
export declare function extractCoverageInclude(config: string): string[] | null;
export declare function resolveBase(appDir: string): { commit: string | null; recorded: boolean };
export declare function changedSources(appDir: string, base: string): string[] | null;
export declare function coverageByFile(summary: object, appDir: string): Map<string, number>;
export declare function writeState(appDir: string, commit: string, pct: number): void;
export declare function runTestPresence(
  appDir: string,
  io: { pass: () => void; fail: (m?: string) => void; notApplicable: (w?: string) => void },
  deps?: { runCoverage?: unknown }
): void;
