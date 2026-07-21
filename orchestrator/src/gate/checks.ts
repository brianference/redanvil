export interface Check {
  /** The rubric rule this check decides. */
  ruleId: string;
  command: string;
  args: string[];
  /** Per-check wall-clock ceiling; defaults applied by the runner. */
  timeoutMs?: number;
}

/**
 * The default deterministic checks for a Cloudflare TS app. Each maps a shell
 * command's exit code (0 = pass) to a rubric rule. Live runs use these against a
 * generated app; unit tests inject synthetic checks for determinism.
 */
export const DEFAULT_CHECKS: Check[] = [
  { ruleId: 'u-typing-strict', command: 'npx', args: ['tsc', '--noEmit'] },
  { ruleId: 'u-typing-no-any', command: 'npx', args: ['eslint', '.', '--max-warnings', '0'] },
  { ruleId: 'u-conc-dead-code', command: 'npx', args: ['eslint', '.', '--max-warnings', '0'] },
  { ruleId: 'u-test-presence', command: 'npm', args: ['test'] },
  { ruleId: 'hyg-env-ignored', command: 'git', args: ['check-ignore', '.env'] }
];
