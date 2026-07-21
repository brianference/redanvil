import { loadRubric } from '../src/rubric/index';
import { gateApp } from '../src/commands/gate';
import type { Outcome } from '../src/gate/score';

/**
 * Five gate simulations proving the enforced threshold behaves correctly.
 * Each scenario is a set of rule outcomes fed to the same gate the loop uses.
 */
const ids = loadRubric().map((r) => r.id);
const allPass = (): Outcome[] => ids.map((id) => ({ ruleId: id, passed: true }));
const flip = (base: Outcome[], failIds: string[]): Outcome[] =>
  base.map((o) => (failIds.includes(o.ruleId) ? { ...o, passed: false } : o));

const scenarios: { name: string; outcomes: Outcome[] }[] = [
  { name: '1 clean app — every rule passes', outcomes: allPass() },
  { name: '2 failing blocker — parameterized SQL', outcomes: flip(allPass(), ['u-sec-param-sql']) },
  {
    name: '3 judge-tier deficit — concision/componentization fail',
    outcomes: flip(allPass(), [
      'u-conc-idiomatic',
      'u-conc-no-speculative-abstraction',
      'u-conc-use-what-exists',
      'u-conc-smallest-diff',
      'u-test-behavioral',
      'u-test-adequacy',
      'fe-pages-compose',
      'fe-fail-closed-states'
    ])
  },
  { name: '4 low coverage — only 5 rules evaluated', outcomes: ids.slice(0, 5).map((id) => ({ ruleId: id, passed: true })) },
  {
    name: '5 real app-builder — i18n blocker + timeouts + headers fail',
    outcomes: flip(allPass(), ['fe-i18n-central-copy', 'u-sec-timeouts', 'u-sec-headers-cors'])
  }
];

const THRESHOLD = 90;

for (const s of scenarios) {
  const r = await gateApp(process.cwd(), [], s.outcomes);
  const verdict = r.score >= THRESHOLD ? 'PASS' : 'FAIL';
  const blockers = r.blockersFailed.length > 0 ? ` blockers=[${r.blockersFailed.join(',')}]` : '';
  console.log(
    `${verdict}  score ${String(r.score).padStart(3)}/100  evaluated ${r.evaluated}/${r.total}${blockers}  — ${s.name}`
  );
}
