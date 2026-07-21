import type { Rule, Severity, Method } from './types';

const W: Record<Severity, number> = { blocker: 8, major: 4, minor: 2, advisory: 1 };

function rule(id: string, lane: string, severity: Severity, method: Method): Rule {
  return { id, lane, severity, method, weight: W[severity] };
}

/**
 * The encoded rubric. One entry per rule line authored in rules/rubric/*.md.
 * Keep this list in lockstep with the lane files.
 */
export const RULES: Rule[] = [
  rule('u-typing-strict', 'typing', 'blocker', 'det'),
  rule('u-typing-no-any', 'typing', 'blocker', 'det'),
  rule('u-typing-scoped-ignores', 'typing', 'major', 'det'),

  rule('u-conc-dead-code', 'concision', 'blocker', 'det'),
  rule('u-conc-idiomatic', 'concision', 'major', 'judge'),
  rule('u-conc-no-speculative-abstraction', 'concision', 'major', 'judge'),
  rule('u-conc-use-what-exists', 'concision', 'major', 'det+judge'),
  rule('u-conc-no-padding', 'concision', 'major', 'det'),
  rule('u-conc-smallest-diff', 'concision', 'major', 'det+judge'),

  rule('u-val-input-validation', 'security', 'blocker', 'det+judge'),
  rule('u-sec-param-sql', 'security', 'blocker', 'det'),
  rule('u-sec-no-stub-paths', 'security', 'blocker', 'det+judge'),
  rule('u-sec-timeouts', 'security', 'major', 'det'),
  rule('u-sec-headers-cors', 'security', 'major', 'det'),
  rule('u-sec-sast', 'security', 'major', 'det'),

  rule('u-test-presence', 'testing', 'blocker', 'det'),
  rule('u-test-adequacy', 'testing', 'major', 'det+judge'),
  rule('u-test-behavioral', 'testing', 'major', 'judge'),

  rule('fe-theme-tokens-only', 'frontend', 'blocker', 'det'),
  rule('fe-a11y-contrast', 'frontend', 'blocker', 'det'),
  rule('fe-i18n-central-copy', 'frontend', 'blocker', 'det'),
  rule('fe-no-unsanitized-html', 'frontend', 'blocker', 'det'),
  rule('fe-pages-compose', 'frontend', 'major', 'judge'),
  rule('fe-fail-closed-states', 'frontend', 'major', 'det+judge'),

  rule('ci-actionlint', 'ci', 'major', 'det'),
  rule('ci-sha-pinned', 'ci', 'blocker', 'det'),
  rule('ci-least-privilege', 'ci', 'blocker', 'det'),
  rule('ci-no-injection', 'ci', 'blocker', 'det'),

  rule('hyg-secret-scan', 'hygiene', 'blocker', 'det'),
  rule('hyg-no-binaries', 'hygiene', 'blocker', 'det'),
  rule('hyg-no-duplication', 'hygiene', 'blocker', 'det'),
  rule('hyg-env-ignored', 'hygiene', 'blocker', 'det'),

  rule('proc-pr-title-ticket', 'process', 'blocker', 'det'),
  rule('proc-conventional-commits', 'process', 'minor', 'det'),
  rule('proc-full-local-suite', 'process', 'major', 'hook')
];
