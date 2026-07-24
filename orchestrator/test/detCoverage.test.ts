import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadRubric } from '../src/rubric/index';
import { APP_CHECKS } from '../src/commands/gate';

/**
 * Path to the deterministic rule checker. Cases are extracted from source text
 * so this coverage test tracks reality and cannot drift from a hard-coded list.
 */
const CHECK_SCRIPT_PATH = fileURLToPath(
  new URL('../scripts/checks/check.mjs', import.meta.url)
);

/**
 * Matches switch `case 'rule-id':` labels in check.mjs, including fall-through
 * chains where several labels share one block.
 */
const CASE_LABEL_RE = /case\s+'([^']+)':/g;

/**
 * Extract every `case '<id>':` label from check.mjs source.
 * Fall-through groups (multiple labels, one body) each contribute every label.
 * @param source Full text of check.mjs.
 * @returns Unique rule ids that have a switch case.
 */
function extractCheckCaseIds(source: string): Set<string> {
  const ids = new Set<string>();
  for (const match of source.matchAll(CASE_LABEL_RE)) {
    const id = match[1];
    if (id !== undefined) ids.add(id);
  }
  return ids;
}

/**
 * Rule ids implemented as APP_CHECKS entries (tsc, eslint, check.mjs wrappers, etc.).
 * @returns Set of ruleId values from APP_CHECKS.
 */
function appCheckRuleIds(): Set<string> {
  return new Set(APP_CHECKS.map((check) => check.ruleId));
}

/**
 * Methods that claim a machine can decide the rule (pure det or hybrid).
 * A pure-judge rule is method `'judge'` and is out of scope for this guard.
 *
 * Note: some `det+judge` hybrids are still judge-scored only (no det case yet).
 * Requiring those here would keep this test red forever without a separate
 * det-half project. We require pure `'det'` fully, and also require any
 * `det+judge` that already has a det case to keep it (via the same extract).
 * The pure-det gap (28 det / 25 implemented → 3 unknowns) is the hole the
 * pipeline simulation found and this test must not allow back in.
 */
const MACHINE_METHODS = new Set(['det', 'det+judge']);

/**
 * `det+judge` rules that are intentionally judge-only today (no det half).
 * They must not reappear as pure `'det'` without an implementation. Listed
 * explicitly so adding a fourth unguarded hybrid is a deliberate edit, not
 * silent drift — and so pure-det coverage stays the load-bearing assertion.
 */
const JUDGE_ONLY_DET_HYBRIDS = new Set([
  'u-conc-use-what-exists',
  'u-conc-smallest-diff',
  'u-test-adequacy',
  'fe-fail-closed-states'
]);

describe('det rule implementation coverage', () => {
  it('every pure-det rubric rule has an APP_CHECKS entry or a check.mjs case', () => {
    const checkSource = readFileSync(CHECK_SCRIPT_PATH, 'utf8');
    const caseIds = extractCheckCaseIds(checkSource);
    const appIds = appCheckRuleIds();

    const pureDetRules = loadRubric().filter((rule) => rule.method === 'det');
    expect(pureDetRules.length, 'expected at least one pure-det rule in the rubric').toBeGreaterThan(
      0
    );

    const unimplemented = pureDetRules
      .map((rule) => rule.id)
      .filter((id) => !appIds.has(id) && !caseIds.has(id))
      .sort();

    expect(
      unimplemented,
      `unimplemented det rules: ${unimplemented.join(', ')}`
    ).toEqual([]);
  });

  it('every det+judge rule either has a det implementation or is an explicit judge-only hybrid', () => {
    const checkSource = readFileSync(CHECK_SCRIPT_PATH, 'utf8');
    const caseIds = extractCheckCaseIds(checkSource);
    const appIds = appCheckRuleIds();

    const hybrids = loadRubric().filter((rule) => rule.method === 'det+judge');
    const unimplemented = hybrids
      .map((rule) => rule.id)
      .filter(
        (id) => !appIds.has(id) && !caseIds.has(id) && !JUDGE_ONLY_DET_HYBRIDS.has(id)
      )
      .sort();

    expect(
      unimplemented,
      `unimplemented det+judge rules (add a case or list as judge-only): ${unimplemented.join(', ')}`
    ).toEqual([]);

    // Every listed judge-only hybrid must still exist as det+judge in the rubric
    // (a rename or method change without updating this set would hide a gap).
    const hybridIds = new Set(hybrids.map((rule) => rule.id));
    for (const id of JUDGE_ONLY_DET_HYBRIDS) {
      expect(hybridIds.has(id), `judge-only hybrid missing from rubric: ${id}`).toBe(true);
    }
    expect(MACHINE_METHODS.has('det') && MACHINE_METHODS.has('det+judge')).toBe(true);
  });
});
