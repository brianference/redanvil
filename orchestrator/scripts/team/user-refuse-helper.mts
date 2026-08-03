/**
 * Thin CLI bridge so user_refuse.mjs can call the ONE decision implementation
 * in src/team/userRefuse.ts (decideUserRefuse / buildRefusalReport /
 * writeRefusalReport) without reimplementing it in plain JS. Mirrors
 * lg-result-reproduces-score.mts's pattern: a Playwright driver cannot import
 * TypeScript directly, so it shells out to this file through `npx tsx`.
 *
 * Usage:
 *   npx tsx user-refuse-helper.mts validate
 *     -> prints { badVerdict, goodVerdict } from the two named fixtures.
 *        The harness is broken unless this is exactly
 *        { badVerdict: 'refuse', goodVerdict: 'accept' }.
 *
 *   npx tsx user-refuse-helper.mts report <payload.json>
 *     -> payload: { slug: string, rootDir: string, view: StrangerView }
 *        builds the refusal report, writes evidence/refusal-<slug>.json
 *        under rootDir, and prints { path, report } as one JSON line.
 */
import { readFileSync } from 'node:fs';
import {
  buildRefusalReport,
  decideUserRefuse,
  knownBadBelowFoldStrangerView,
  knownGoodInViewStrangerView,
  writeRefusalReport,
  type StrangerView
} from '../../src/team/userRefuse';

/**
 * Print the fixture verdicts used to validate this measurer before it is
 * trusted against a real site.
 */
function runValidate(): void {
  const bad = decideUserRefuse(knownBadBelowFoldStrangerView());
  const good = decideUserRefuse(knownGoodInViewStrangerView());
  process.stdout.write(
    `${JSON.stringify({ badVerdict: bad.verdict, goodVerdict: good.verdict })}\n`
  );
}

/**
 * Build and write the real refusal report from a payload written by the
 * Playwright driver.
 *
 * @param payloadPath - Path to a JSON file with `{ slug, rootDir, view }`.
 */
function runReport(payloadPath: string): void {
  const payload = JSON.parse(readFileSync(payloadPath, 'utf8')) as {
    slug: string;
    rootDir: string;
    view: StrangerView;
  };
  const report = buildRefusalReport({ slug: payload.slug, view: payload.view });
  const path = writeRefusalReport(payload.rootDir, report);
  process.stdout.write(`${JSON.stringify({ path, report })}\n`);
}

const mode = process.argv[2];

if (mode === 'validate') {
  runValidate();
} else if (mode === 'report') {
  const payloadPath = process.argv[3];
  if (!payloadPath) {
    console.error('usage: user-refuse-helper.mts report <payload.json>');
    process.exit(2);
  }
  runReport(payloadPath);
} else {
  console.error('usage: user-refuse-helper.mts <validate|report [payload.json]>');
  process.exit(2);
}
