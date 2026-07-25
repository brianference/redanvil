/**
 * Regenerate the generatePrd characterization goldens from the REAL generator.
 *
 * Run this only when generatePrd's output is intentionally changed. The fixtures
 * and digests must never be hand-edited: they are the assertion, so authoring
 * them by hand turns the regression test into a tautology that agrees with
 * whatever the code currently does.
 *
 * Usage: npx tsx scripts/regen-characterization.mts
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES, prdPayload, prdDigest } from '../test-support/prdCharacterizationCases';
import { generatePrd } from '../src/lib/prd';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '..', 'src', 'lib', 'prd.characterization.fixtures');

const digests: Record<string, string> = {};
for (const c of CASES) {
  const prd = generatePrd(c.answers, c.cost);
  const payload = prdPayload(prd);
  writeFileSync(join(fixturesDir, `${c.id}.json`), payload);
  digests[c.id] = prdDigest(prd);
  console.log(`  ${c.id}: ${digests[c.id]}`);
}

console.log('\nPaste into EXPECTED_DIGESTS in src/lib/prd.characterization.test.ts:\n');
for (const [id, d] of Object.entries(digests)) {
  console.log(`  '${id}': '${d}',`);
}
