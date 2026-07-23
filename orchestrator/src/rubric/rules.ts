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
  // loop-gate.md declares runtime parity a blocker, but no rubric rule encoded
  // it, so the corpus's most emphatic requirement scored nothing. Node-only
  // globals pass every unit test (which runs in Node) and then throw at runtime
  // in Workers and browsers, which have neither -- the single most repeated
  // production failure in this environment.
  rule('u-plat-worker-runtime', 'security', 'blocker', 'det'),

  rule('u-test-presence', 'testing', 'blocker', 'det'),
  rule('u-test-adequacy', 'testing', 'major', 'det+judge'),
  rule('u-test-behavioral', 'testing', 'major', 'judge'),

  rule('fe-theme-tokens-only', 'frontend', 'blocker', 'det'),
  rule('fe-a11y-contrast', 'frontend', 'blocker', 'det'),
  rule('fe-i18n-central-copy', 'frontend', 'blocker', 'det'),
  rule('fe-no-unsanitized-html', 'frontend', 'blocker', 'det'),
  rule('fe-pages-compose', 'frontend', 'major', 'judge'),
  rule('fe-fail-closed-states', 'frontend', 'major', 'det+judge'),

  // Premium/design requirements. Method 'visual' = scored from the recorded
  // visual-review verdict and FAIL-CLOSED: with no recorded verdict they fail,
  // so a run cannot score above zero without an actual visual review. These
  // close the exact holes that shipped a barebones site (no light mode, bare
  // nav, missing pages, dead-end flow) despite a code-clean diff.
  rule('fe-light-dark', 'frontend', 'blocker', 'visual'),
  rule('fe-premium-nav', 'frontend', 'blocker', 'visual'),
  rule('fe-required-pages', 'frontend', 'blocker', 'visual'),
  rule('fe-no-attribution', 'frontend', 'blocker', 'visual'),
  rule('fe-responsive-375', 'frontend', 'blocker', 'visual'),
  rule('fe-product-completeness', 'frontend', 'blocker', 'visual'),
  rule('fe-visual-review-recorded', 'frontend', 'blocker', 'visual'),
  rule('fe-seo-og', 'frontend', 'major', 'visual'),
  rule('fe-cross-link', 'frontend', 'major', 'visual'),

  // Measurable mobile-ux rules (from design-system/mobile-design-rules R1–R12),
  // promoted from prose/checklist to scored visual rules so they are actually
  // measured on the rendered page, not just described.
  rule('fe-touch-targets', 'frontend', 'blocker', 'visual'), // R1.1 >=44px targets
  rule('fe-type-floor', 'frontend', 'blocker', 'visual'), // R3.1 >=16px body
  rule('fe-noncolor-state', 'frontend', 'major', 'visual'), // R4.2 state not by color alone
  rule('fe-safe-areas', 'frontend', 'major', 'visual'), // R2.1/R2.2 safe areas, no chrome collision

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
