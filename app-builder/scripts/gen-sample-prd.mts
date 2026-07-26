/**
 * Generate one real PRD and print its design direction section.
 *
 * §7.3a's variation is enforced by unit test on the chooser. This runs the
 * whole generator so the section can be read as an agent would receive it —
 * the difference between "the spec varies" and "the spec says something usable".
 *
 * Usage: npx tsx scripts/gen-sample-prd.mts
 */
import { writeFileSync } from 'node:fs';
import { generatePrd } from '../src/lib/prd';
import { estimate } from '../src/lib/estimate';
import { EMPTY_WIZARD_ANSWERS } from '../src/lib/job';

const answers = {
  ...EMPTY_WIZARD_ANSWERS,
  prompt: 'a shift scheduling app for small teams with swap requests and coverage alerts',
  appType: 'dashboard',
  hasAuth: true,
  entities: 'Shift, Staff'
};
const cost = estimate({ features: 4, hasAuth: true, entities: 2, scopeSignals: 3 });
const prd = generatePrd(answers, cost);
writeFileSync('sample-prd.md', prd.markdown);

const start = prd.markdown.indexOf('### 7.3a');
const end = prd.markdown.indexOf('## 8.');
console.log(prd.markdown.slice(start, end).trim());
