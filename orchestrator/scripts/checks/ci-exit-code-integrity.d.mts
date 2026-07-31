/**
 * Types for the pure helper in `ci-exit-code-integrity.mjs`.
 *
 * `pipedVerifiers` is a string-in, findings-out function with real edge cases
 * (a pipe used to search rather than verify, a `set -o pipefail` exemption, a
 * commented-out line), so it deserves direct unit tests rather than only being
 * reached by spawning a subprocess and reading its stderr.
 */
export declare function pipedVerifiers(yaml: string): { line: number; text: string }[];
export declare function runExitCodeIntegrity(
  appDir: string,
  io: { pass: () => void; fail: (m?: string) => void; notApplicable: (w?: string) => void }
): void;
