/**
 * Thin CLI wrapper so lg-result-reproduces.mjs can call the ONE score
 * implementation in gate/score.ts without reimplementing the formula.
 *
 * Usage: npx tsx lg-result-reproduces-score.mts <payload.json>
 * payload: { outcomes: Outcome[], notApplicable?: string[] }
 * Prints one JSON line: { score, blockers, rubricIds }
 */
import { readFileSync } from 'node:fs';
import { computeScore } from '../../src/gate/score';
import { loadRubric } from '../../src/rubric/index';

const file = process.argv[2];
if (!file) {
  console.error('usage: lg-result-reproduces-score.mts <payload.json>');
  process.exit(2);
}

const payload = JSON.parse(readFileSync(file, 'utf8')) as {
  outcomes: Array<{ ruleId: string; passed: boolean }>;
  notApplicable?: string[];
};

const na = new Set(payload.notApplicable ?? []);
const all = loadRubric();
// Exclude rules waived by exact id or by lane name (same as gateApp).
const rules = all.filter((r) => !na.has(r.id) && !na.has(r.lane));
const { score, blockers } = computeScore(payload.outcomes, rules);

process.stdout.write(
  JSON.stringify({
    score,
    blockers,
    rubricIds: rules.map((r) => r.id)
  }) + '\n'
);
