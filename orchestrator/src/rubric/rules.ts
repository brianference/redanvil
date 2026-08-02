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
  // base-15 rule 8 and lg-role-architecture both ask for size caps and neither
  // was measured, so the biggest module in the repo grew to 1365 lines with two
  // exported functions and nothing ever said so.
  rule('u-conc-file-size', 'concision', 'major', 'det'),
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
  // Implements lg-runtime-parity: boot wrangler pages dev and curl live paths.
  // The static grep (u-plat-worker-runtime) cannot see a Workers-incompatible
  // transitive dependency; only a real runtime boot catches that failure class.
  rule('u-plat-runtime-parity', 'security', 'blocker', 'det'),
  // Prose in per-app-pack that was mechanically checkable but scored by a human
  // verdict (or not at all). Converting asserted requirements into measured ones
  // is the only way the score's "asserted surface" shrinks.
  rule('u-data-no-placeholder', 'hygiene', 'blocker', 'det'),
  rule('u-plat-migrations', 'security', 'blocker', 'det'),
  rule('fe-seo-assets', 'frontend', 'major', 'det'),
  rule('fe-icon-button-labels', 'frontend', 'blocker', 'det'),

  rule('u-test-presence', 'testing', 'blocker', 'det'),
  // Each configured runner (vitest, pytest, …) must pass independently so a
  // green vitest cannot hide a red pytest (SPEC-agent-team §4).
  rule('u-test-runners', 'testing', 'blocker', 'det'),
  // R27. Unit tests over pure functions say nothing about whether a control is
  // wired to anything. A build passed 12/12 design rules, zero axe violations
  // and 49 unit tests while shipping a calendar that could not select a range
  // and a route that could not be changed — the filter functions were correct
  // and simply unreachable. This requires acceptance tests that drive the real
  // UI and assert on what the user observes.
  rule('u-test-acceptance', 'testing', 'blocker', 'det'),
  // u-test-acceptance proves the suite drives a browser and asserts on results.
  // It cannot prove the suite covers the app: the tests and the coverage claim
  // come from the same mental model, so the suite only ever checks what its
  // author already had in mind. A control nobody thought of is a control nobody
  // tested, and three shipped that way from a green repository — a Search button
  // with no visible response, a public write endpoint, and an assistant that had
  // answered 502 for two months. This requires a control inventory taken from
  // the RUNNING app, with every control claimed by a test that resolves.
  rule('u-test-feature-audit', 'testing', 'blocker', 'det'),
  // The tested fraction of an app drifts down one uncovered file at a time, and
  // no single change ever looks like the problem. u-test-presence catches a
  // changed file with nothing exercising it; this catches the slow slide where
  // nothing is individually untested and the whole is getting worse. `major`
  // rather than `blocker` on purpose: a failed blocker zeroes the entire score,
  // and a one-point dip is not equivalent to a security hole.
  rule('u-test-coverage-ratchet', 'testing', 'major', 'det'),
  // The control audit proved every button is clicked by a test. It says nothing
  // about what comes back: QuickFlight passed contrast, touch targets, painted
  // width, 49 unit tests, zero console errors AND the control audit, while its
  // assistant endpoint had answered 502 for two months and its catalog held two
  // route/date pairs, so any route a person typed returned nothing. `det+judge`
  // because the two halves have different oracles — a machine decides status,
  // emptiness and declared breadth; whether a well-formed answer actually
  // delivers the product's claim is a judgment, scored from a recorded verdict
  // over the live traffic the det half captures.
  rule('u-api-real-output', 'testing', 'blocker', 'det+judge'),
  // DONE-CHECKLIST A5: npm run build exits 0. Adjacent to runtime-parity but a
  // different command — wrangler boot is not the build script.
  rule('u-build-succeeds', 'testing', 'blocker', 'det'),
  // B3: detail routes return 404 for a bogus id (not 200, not 500).
  rule('u-api-not-found', 'testing', 'blocker', 'det'),
  // B5: SPA fallback must not answer unmatched /api/* with index.html 200.
  rule('u-api-no-spa-mask', 'testing', 'blocker', 'det'),
  // A feature the builder skipped is invisible to every other check: it renders
  // no control for the audit to find and serves no route for the API check to
  // call. The PRD promised it and nothing compared what was built against what
  // was promised, because the promise only existed as prose.
  rule('u-claims-covered', 'testing', 'blocker', 'det'),
  rule('u-test-adequacy', 'testing', 'major', 'det+judge'),
  rule('u-test-behavioral', 'testing', 'major', 'judge'),

  rule('fe-theme-tokens-only', 'frontend', 'blocker', 'det'),
  // Declared `det` for a long time with no check anywhere, so it silently
  // auto-passed and later became an unbacked assertion. Contrast cannot be
  // decided without rendering, so the honest method is `visual`: it must be
  // measured on the real page and recorded with evidence.
  rule('fe-a11y-contrast', 'frontend', 'blocker', 'visual'),
  rule('fe-i18n-central-copy', 'frontend', 'blocker', 'det'),
  // R32. A template emitted `'<Name> page for <slug>.'` and four one-sentence
  // legal pages shipped, passing every check, because a stub was that
  // template's finished output. A placeholder that reads as a plausible
  // sentence is indistinguishable from real copy to everyone except its author.
  rule('u-no-placeholders', 'frontend', 'blocker', 'det'),
  // R34. A control that changes state without changing anything visible is
  // indistinguishable from a broken one. Search rendered its outcome at y=1341
  // in a 1000px viewport and was reported as doing nothing; a footer link kept
  // the scroll position and landed the reader 1044px into an unseen document.
  // Both passed code review, unit tests and a green acceptance suite.
  rule('fe-visible-response', 'frontend', 'blocker', 'det'),
  // A collection nobody can search is a list, not a product. Apps cleared 90+
  // with bare browse lists and a search box that rendered and did nothing —
  // both worse than requiring a real filter affordance on every collection.
  rule('fe-search-present', 'frontend', 'blocker', 'det'),
  // Proven by Playwright row counts + optional API probe — not by grepping
  // for <select> filters or a decorative .filter( call.
  // An app that cannot answer a question about its own data makes the user do
  // the reading. Stubbed/canned assistants fail; the call runs in the Worker
  // (Workers AI by default) and must ground in the app's database or domain
  // query, not general knowledge.
  rule('fe-assistant-present', 'frontend', 'blocker', 'det'),
  // Per-app pack and §7.3a require a real brand mark. Prose only, so a literal
  // "AZ" span and a 361-byte rect+text favicon cleared the scored gate.
  rule('fe-brand-mark', 'frontend', 'blocker', 'det'),
  // D7: fe-brand-mark checks bytes/shape; this measures 32x32 ink, detail, contrast.
  rule('fe-favicon-legible', 'frontend', 'blocker', 'det'),
  // D10: rendered header mark height ≥48px@1280 and ≥32px@375 (bytes alone miss a tiny mark).
  rule('fe-brand-mark-size', 'frontend', 'blocker', 'det'),
  // C8: inner/detail pages need a breadcrumb nav with a parent link.
  rule('fe-breadcrumbs', 'frontend', 'blocker', 'det'),
  // C10: a control's result must land in the first viewport, not below the fold.
  // Search that narrows at y=1942 in a 900px viewport looks dead; fe-search-present
  // and fe-visible-response both passed that defect.
  rule('fe-result-in-viewport', 'frontend', 'blocker', 'det'),
  // D11: item detail pages must link to real external resources that resolve.
  // Invented guide URLs and "no link at all" are the same class of unfinished work.
  rule('fe-resource-links', 'frontend', 'blocker', 'det'),
  // D8: Terms/Privacy word+h2 floors and required topic coverage (reference standard).
  rule('fe-legal-substance', 'frontend', 'blocker', 'det'),
  // D9: valid JSON-LD (@context+@type) and absolute rel=canonical on home.
  rule('fe-structured-data', 'frontend', 'blocker', 'det'),
  // D4: legal/privacy claims must be true of this app (bidirectional code↔copy).
  rule('u-legal-claims-true', 'frontend', 'blocker', 'det'),
  // Prior-art artifacts (SOURCES / INTEGRATIONS / COMPETITORS) were §7.3a
  // blockers in prose only. Missing files or unwritten markers mean the step
  // never finished (R23/R29/R31).
  rule('fe-prior-art', 'frontend', 'blocker', 'det'),
  // R29/R33. Reuse-before-rebuild as prose produces nothing checkable, and a
  // search nobody recorded is a search nobody can review. Also forces the
  // session's own connectors to be enumerated first, and ages the evidence out
  // at 90 days -- Amadeus was decommissioned while still topping every "best
  // free flight API" guide.
  rule('u-integration-scan', 'hygiene', 'major', 'det'),
  // R31. COMPETITORS.md shipped with real scraped competitor structure and an
  // Assessment reading "Fill this in." Every presence signal was green -- the
  // file existed, was long, and held genuine data -- while the step that turns a
  // scrape into a work list was never done. Cost: four filters every competitor
  // ships. This scores the CONCLUSIONS, not the evidence.
  rule('u-competitor-scan', 'hygiene', 'major', 'det'),
  rule('fe-no-unsanitized-html', 'frontend', 'blocker', 'det'),
  rule('fe-pages-compose', 'frontend', 'major', 'judge'),
  rule('fe-fail-closed-states', 'frontend', 'major', 'det+judge'),

  // Premium/design requirements. Method 'visual' = scored from the recorded
  // visual-review verdict and FAIL-CLOSED: with no recorded verdict they fail,
  // so a run cannot score above zero without an actual visual review. These
  // close the exact holes that shipped a barebones site (no light mode, bare
  // nav, missing pages, dead-end flow) despite a code-clean diff.
  //
  // fe-light-dark is det (paint-measured): asserting data-theme alone shipped a
  // light page whose hero stayed black on hardcoded dark tokens. The check
  // samples computed landmark backgrounds in both themes.
  rule('fe-light-dark', 'frontend', 'blocker', 'det'),
  rule('fe-premium-nav', 'frontend', 'blocker', 'visual'),
  rule('fe-required-pages', 'frontend', 'blocker', 'visual'),
  rule('fe-no-attribution', 'frontend', 'blocker', 'visual'),
  rule('fe-responsive-375', 'frontend', 'blocker', 'visual'),
  rule('fe-product-completeness', 'frontend', 'blocker', 'visual'),
  rule('fe-visual-review-recorded', 'frontend', 'blocker', 'visual'),
  // Every other check forces the state it measures, so none of them observe
  // what a first-time visitor actually gets. That hole shipped a default theme
  // that ignored the OS and a search that returned nothing for unseeded routes.
  // §7.3a calls itself binding and nothing could read it: the archetype was
  // computed as structure and thrown away. Measures the fallback the spec names.
  rule('fe-design-archetype', 'frontend', 'major', 'visual'),
  rule('fe-cold-visitor', 'frontend', 'blocker', 'visual'),
  rule('fe-seo-og', 'frontend', 'major', 'visual'),
  rule('fe-cross-link', 'frontend', 'major', 'visual'),

  // Measurable mobile-ux rules (from design-system/mobile-design-rules R1–R12),
  // promoted from prose/checklist to scored visual rules so they are actually
  // measured on the rendered page, not just described.
  rule('fe-touch-targets', 'frontend', 'blocker', 'visual'), // R1.1 >=44px targets
  rule('fe-type-floor', 'frontend', 'blocker', 'visual'), // R3.1 >=16px body
  rule('fe-noncolor-state', 'frontend', 'major', 'visual'), // R4.2 state not by color alone
  rule('fe-safe-areas', 'frontend', 'major', 'visual'), // R2.1/R2.2 safe areas, no chrome collision
  // "The content is too narrow on desktop" was reported four times in one
  // session, on four different screens, each time a container capped in rem (or
  // by an inline style no media query could lift) inside a wide shell. Stated
  // as the outcome a person sees and measured on the rendered page.
  rule('fe-desktop-width', 'frontend', 'blocker', 'visual'),
  rule('fe-no-inline-width', 'frontend', 'blocker', 'det'),

  rule('ci-actionlint', 'ci', 'major', 'det'),
  rule('ci-sha-pinned', 'ci', 'blocker', 'det'),
  rule('ci-least-privilege', 'ci', 'blocker', 'det'),
  rule('ci-no-injection', 'ci', 'blocker', 'det'),
  // `cmd | tail` exits with tail's status. This masked a failing Playwright run
  // and an aborted merge in a single session, both read as green.
  rule('ci-exit-code-integrity', 'ci', 'major', 'det'),

  rule('hyg-secret-scan', 'hygiene', 'blocker', 'det'),
  rule('hyg-no-binaries', 'hygiene', 'blocker', 'det'),
  rule('hyg-no-duplication', 'hygiene', 'blocker', 'det'),
  rule('hyg-env-ignored', 'hygiene', 'blocker', 'det'),

  rule('proc-pr-title-ticket', 'process', 'blocker', 'det'),
  // proc-full-local-suite used to sit here. It had no implementation anywhere,
  // its `hook` method is fail-closed, and every real run passed `--na process`,
  // so it failed on paper and was waived in practice on every single
  // invocation. A rule that is always waived is not a rule; it only inflated
  // the rubric count. What it reached for is enforced structurally instead: CI
  // runs typecheck, lint and the full suite on every push, and
  // verify_commit.mjs builds the commit in an isolated worktree before one.
  rule('proc-conventional-commits', 'process', 'minor', 'det'),
  // A requirement written into a prompt/rule is not done. Verdict evidence must
  // be a real OUTPUT (report, screenshot, capture), not a plan or empty file.
  rule('proc-artifact-verified', 'process', 'blocker', 'det'),
  // C9 / §7.3a: three distinct design options + DECISION.md (not optional prose).
  rule('proc-design-options', 'process', 'blocker', 'det'),

  // An app that clears 90+ and never leaves the disk is not done. Shipping is
  // part of the gate: GitHub remote, pushed HEAD, live production URL, and a
  // deployed bundle hash that matches local dist. See rules/loop-gate.md.
  rule('lg-shipped', 'loop-gate', 'blocker', 'det'),
  // F4: a hand-authored results JSON is indistinguishable by shape — recompute.
  rule('lg-result-reproduces', 'loop-gate', 'blocker', 'det'),
  // E6: wrangler-declared bindings must not 503 as "binding unavailable" in deploy.
  rule('lg-bindings-bound', 'loop-gate', 'blocker', 'det'),

  // G1–G5: the measurement itself (provenance of how rules were decided).
  rule('meas-known-bad', 'process', 'blocker', 'det'),
  rule('meas-two-run', 'process', 'blocker', 'det'),
  rule('meas-recheck-flattering', 'process', 'major', 'det'),
  rule('meas-standard-tool', 'process', 'blocker', 'det'),
  rule('meas-engine-named', 'process', 'blocker', 'det')
];
