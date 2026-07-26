/**
 * Print the features derived for a prompt, to see what the app will actually be.
 *
 * Usage: npx tsx scripts/show-features.mts "<prompt>" "<entities>"
 */
import { buildFeatureSuggestions } from '../src/lib/prd/sections/features';

const prompt = process.argv[2] ?? '';
const entities = (process.argv[3] ?? '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);
for (const s of buildFeatureSuggestions(entities, false, prompt)) {
  console.log(`${s.id} ${s.mvp ? '[MVP]' : '     '} ${s.title}`);
}
