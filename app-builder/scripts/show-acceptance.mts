/** Print acceptance criteria for the derived features. */
import { buildFeatures } from '../src/lib/prd/sections/features';
const prompt = process.argv[2] ?? '';
const entities = (process.argv[3] ?? '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);
for (const f of buildFeatures(entities, false, prompt).slice(0, 2)) {
  console.log(`\n${f.id} — ${f.name}`);
  console.log(`   ${f.behavior}`);
  for (const a of f.acceptance) console.log(`   - ${a}`);
}
