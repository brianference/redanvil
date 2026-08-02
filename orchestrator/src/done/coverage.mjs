/**
 * Binds every row of the definition of done to the thing that measures it.
 *
 * WHY THIS IS FAIL-CLOSED
 * -----------------------
 * A checklist row with no measurement behind it is the exact failure this repo
 * keeps repeating: `proc-full-local-suite` sat in the rubric with no
 * implementation and was waived on every run; contrast was declared `det` for
 * months with no check anywhere and auto-passed; §7.3a called itself binding and
 * nothing could read it. In each case the requirement existed, looked enforced,
 * and scored nothing.
 *
 * So a row resolves to PASS only when something real reports it passed. A row
 * mapped to nothing is `unimplemented` and FAILS — it does not quietly leave the
 * denominator, and it cannot be waived by omission. Making the bar honest is
 * expected to fail apps that previously scored green; that is the point. A
 * previously-green app was not measured against these rows at all.
 *
 * `notApplicable` is deliberately NOT accepted here. Section E ("shipped") and
 * section F ("scored") apply to every app by construction, and the n/a escape
 * is how coverage silently shrinks (see reference_na_hides_coverage).
 */

/**
 * How one checklist row is decided.
 *
 * `rules` are rubric rule ids that must ALL have passed.
 * `opts` are `isDone` option keys, evaluated by `done.mjs` (it owns their
 * semantics — this module only records which row depends on which key).
 * `builtin` names a condition `isDone` already computes for itself.
 * A row with none of the three is unimplemented and fails.
 *
 * @typedef {object} RowBinding
 * @property {string[]} [rules]
 * @property {string[]} [opts]
 * @property {'score'|'noFailedRules'} [builtin]
 * @property {string} [note] Why this binding, or what is missing.
 */

/**
 * Row id -> what measures it.
 *
 * Every entry was checked against the real wiring in `commands/gate.ts`
 * (`APP_CHECKS`) and `rubric/rules.ts`, not against what the rule names suggest.
 * Rows recorded as unimplemented are gaps that were found by doing that, and
 * they are listed rather than papered over.
 *
 * @type {Record<string, RowBinding>}
 */
export const CHECKLIST_RULE_MAP = Object.freeze({
  // A. The build itself
  A1: { rules: ['u-typing-strict'], note: 'APP_CHECKS runs `npx tsc --noEmit`.' },
  A2: {
    rules: ['u-typing-no-any', 'u-conc-dead-code'],
    note: 'Both are wired to `npx eslint . --max-warnings 0`.'
  },
  A3: { rules: ['u-test-presence'], opts: ['unitTestsPass'] },
  A4: { rules: ['u-test-acceptance'], opts: ['acceptanceTestsPass'] },
  A5: {
    rules: ['u-build-succeeds'],
    note: 'Runs `npm run build` in the app dir; n/a only when no build script.'
  },
  A6: { rules: ['u-test-coverage-ratchet'], opts: ['coveragePct'] },

  // B. The backend is real
  B1: { rules: ['u-api-real-output'], note: 'Boots the runtime and calls declared routes.' },
  B2: { rules: ['u-api-real-output', 'u-data-no-placeholder'] },
  B3: {
    rules: ['u-api-not-found'],
    note: 'Detail routes with a bogus id must return 404 (discovered from functions/api/).'
  },
  B4: { rules: ['fe-search-present'], note: 'Proves narrowing via Playwright row counts.' },
  B5: {
    rules: ['u-api-no-spa-mask'],
    note: 'Unmatched /api/* must not be answered 200 with the SPA shell.'
  },

  // C. The page, seen
  C1: { opts: ['screenshotsPresent'] },
  C2: { rules: ['fe-visual-review-recorded', 'proc-artifact-verified'] },
  C3: { rules: ['fe-light-dark'], note: 'Paint-measured, not attribute-flipped.' },
  C4: { rules: ['fe-premium-nav'] },
  C5: { rules: ['fe-desktop-width'] },
  C6: { rules: ['fe-responsive-375'] },
  C7: { rules: ['fe-cold-visitor'], note: 'Console cleanliness on a real first load.' },
  C8: {
    rules: ['fe-breadcrumbs'],
    note: 'Inner/detail routes need a nav named breadcrumb with a parent link; n/a only for single-route apps.'
  },
  C9: {
    rules: ['proc-design-options'],
    note: 'design-refs/design-options/ ≥3 artifacts + DECISION.md with choice, why, and structural distinctness.'
  },
  C10: {
    rules: ['fe-result-in-viewport'],
    note: 'After a narrowing search, a changed element must sit inside the first viewport at 375 and 1280.'
  },

  // D. Content is real
  D1: { rules: ['fe-required-pages'] },
  D2: { rules: ['fe-required-pages'] },
  D3: { rules: ['fe-required-pages'] },
  D4: {
    rules: ['u-legal-claims-true'],
    note: 'Bidirectional legal-copy ↔ code comparison for cookies/auth/payments/analytics/email.'
  },
  D5: { rules: ['u-data-no-placeholder', 'fe-prior-art'] },
  D6: { rules: ['fe-brand-mark'], note: 'Byte floors plus emoji/text-span detection.' },
  D7: {
    rules: ['fe-favicon-legible'],
    note: '32x32 ink coverage, Sobel detail energy, and tab contrast — not file size alone.'
  },
  D8: {
    rules: ['fe-legal-substance'],
    note: '≥1400 words, ≥14 h2, and required topic coverage on both Terms and Privacy.'
  },
  D9: {
    rules: ['fe-structured-data'],
    note: 'Valid application/ld+json with @context+@type and absolute rel=canonical on home.'
  },
  D10: {
    rules: ['fe-brand-mark-size'],
    note: 'Rendered header mark height ≥48px at 1280 and ≥32px at 375.'
  },
  D11: {
    rules: ['fe-resource-links'],
    note: 'Item detail routes carry external links that resolve 2xx/3xx when fetched with a browser user-agent.'
  },

  // E. Shipped — one check decides all five conditions.
  E1: { rules: ['lg-shipped'] },
  E2: { rules: ['lg-shipped'] },
  E3: { rules: ['lg-shipped'] },
  E4: { rules: ['lg-shipped'] },
  E5: { rules: ['lg-shipped'], note: 'Served <title> assertion lives in the same check.' },
  E6: {
    rules: ['lg-bindings-bound'],
    note: 'Deployed endpoints must not 503 as binding-unavailable for wrangler-declared bindings.'
  },

  // F. Scored
  F1: { builtin: 'score' },
  F2: { builtin: 'noFailedRules' },
  F3: { opts: ['evidenceStale'] },
  F4: {
    rules: ['lg-result-reproduces'],
    note: 'Recomputes finalScore from outcomes, checks commit, rejects invented rule ids.'
  },
  F5: { opts: ['independentReviewOk'] },

  // G. The measurement itself
  G1: {
    rules: ['meas-known-bad'],
    note: 'Every measured rule needs a knownBad proof that still fails and is not stale.'
  },
  G2: {
    rules: ['meas-two-run'],
    note: 'Browser-driven measurements record two agreeing runs; disagreement is a fail.'
  },
  G3: {
    rules: ['meas-recheck-flattering'],
    note: 'fail→pass flips since the previous result require two agreeing runs.'
  },
  G4: {
    rules: ['meas-standard-tool'],
    note: 'Contrast/a11y measurements must record tool: "axe-core".'
  },
  G5: {
    rules: ['meas-engine-named'],
    note: 'Browser-driven measurements must name their engine (chromium|webkit|firefox).'
  }
});

/** Status of a single checklist row after evaluation. */
/**
 * @typedef {object} RowStatus
 * @property {string} id
 * @property {string} section
 * @property {string} mustBeTrue
 * @property {'pass'|'fail'|'unmeasured'|'unimplemented'} status
 * @property {string} detail
 */

/**
 * Row ids that have no measurement bound to them.
 *
 * @returns {string[]} Sorted row ids.
 */
export function unimplementedRows() {
  return Object.entries(CHECKLIST_RULE_MAP)
    .filter(([, b]) => !b.rules?.length && !b.opts?.length && !b.builtin)
    .map(([id]) => id)
    .sort();
}

/**
 * Outcome of one rule across a result set, fail-closed on duplicates.
 *
 * @param {ReadonlyArray<{ruleId: string, passed: boolean}>} rules
 * @param {string} id
 * @returns {boolean | undefined} undefined when the rule was never recorded.
 */
function rulePassed(rules, id) {
  const hits = rules.filter((r) => r.ruleId === id);
  if (hits.length === 0) return undefined;
  return hits.every((r) => r.passed === true);
}

/**
 * Evaluate every checklist row against a gate result.
 *
 * @param {object} input
 * @param {ReadonlyArray<{id: string, section: string, mustBeTrue: string}>} input.rows
 *   Parsed checklist rows — the requirement list.
 * @param {ReadonlyArray<{ruleId: string, passed: boolean}>} input.ruleOutcomes
 *   Per-rule outcomes from the gate.
 * @param {Record<string, unknown>} [input.optValues]
 *   Values for the `isDone` option keys a row depends on.
 * @param {boolean} [input.scoreMet] Whether the score cleared the threshold (row F1).
 * @param {boolean} [input.noFailedRules] Whether zero rules failed (row F2).
 * @returns {RowStatus[]} One status per row, in document order.
 */
export function checklistCoverage(input) {
  const { rows, ruleOutcomes, optValues = {}, scoreMet, noFailedRules } = input;

  return rows.map((row) => {
    const binding = CHECKLIST_RULE_MAP[row.id];
    const base = { id: row.id, section: row.section, mustBeTrue: row.mustBeTrue };

    if (binding === undefined) {
      // A row exists in the document that nothing here knows about. This is the
      // drift case the parser exists to catch: someone added a requirement and
      // no measurement. It must fail, not be skipped.
      return {
        ...base,
        status: /** @type {const} */ ('unimplemented'),
        detail: `row ${row.id} is in DONE-CHECKLIST.md but has no binding in CHECKLIST_RULE_MAP`
      };
    }

    const hasBinding = Boolean(binding.rules?.length || binding.opts?.length || binding.builtin);
    if (!hasBinding) {
      return {
        ...base,
        status: /** @type {const} */ ('unimplemented'),
        detail: binding.note ?? `row ${row.id} has no measurement bound to it`
      };
    }

    /** @type {string[]} */
    const failures = [];
    /** @type {string[]} */
    const unmeasured = [];

    for (const ruleId of binding.rules ?? []) {
      const passed = rulePassed(ruleOutcomes, ruleId);
      if (passed === undefined) unmeasured.push(`${ruleId} was never recorded`);
      else if (!passed) failures.push(`${ruleId} failed`);
    }

    for (const key of binding.opts ?? []) {
      const value = optValues[key];
      if (value === undefined) {
        unmeasured.push(`${key} was not supplied`);
        continue;
      }
      // `evidenceStale` is the one inverted key: true means bad.
      const bad = key === 'evidenceStale' ? value === true : value === false;
      if (bad) failures.push(`${key} reported a failure`);
    }

    if (binding.builtin === 'score') {
      if (scoreMet === undefined) unmeasured.push('score was not evaluated');
      else if (!scoreMet) failures.push('score is below the threshold');
    }
    if (binding.builtin === 'noFailedRules') {
      if (noFailedRules === undefined) unmeasured.push('rule outcomes were not evaluated');
      else if (!noFailedRules) failures.push('at least one rule has passed === false');
    }

    if (failures.length > 0) {
      return { ...base, status: /** @type {const} */ ('fail'), detail: failures.join('; ') };
    }
    if (unmeasured.length > 0) {
      // Unmeasured is reported separately from failed so the reason is
      // actionable, but it is NOT a pass. Base rule 15.
      return { ...base, status: /** @type {const} */ ('unmeasured'), detail: unmeasured.join('; ') };
    }
    return { ...base, status: /** @type {const} */ ('pass'), detail: binding.note ?? 'measured' };
  });
}

/**
 * Reasons a checklist evaluation does not permit "done".
 *
 * @param {RowStatus[]} statuses - Output of `checklistCoverage`.
 * @returns {string[]} One reason per unmet row.
 */
export function checklistReasons(statuses) {
  return statuses
    .filter((s) => s.status !== 'pass')
    .map((s) => `done-checklist ${s.id} (${s.status}): ${s.mustBeTrue} — ${s.detail}`);
}
