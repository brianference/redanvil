/**
 * Build and write a QA-visual report from real measured observations.
 *
 * A sibling of `lg-result-reproduces-score.mts` -- a file rather than an
 * inline `npx tsx -e` because Windows shell quoting mangles quotes and arrow
 * functions passed inline. This exists so `.github/scripts/qa_visual.mjs`
 * (a plain .mjs Playwright harness) calls the ONE report implementation in
 * `src/team/qaVisual.ts` instead of reimplementing buildQaVisualReport /
 * writeQaVisualReport in JS, which would let the two copies drift.
 *
 * Usage: npx tsx qa-visual-write.mts <payload.json> <rootDir>
 * payload: { slug: string, observations: QaVisualMetrics[], findings?: QaVisualFinding[] }
 * Prints one JSON line: { path: string, report: QaVisualReport }
 */
import { readFileSync } from 'node:fs';
import {
  buildQaVisualReport,
  writeQaVisualReport,
  type QaVisualMetrics,
  type QaVisualFinding
} from '../../src/team/qaVisual';

const payloadPath = process.argv[2];
const rootDir = process.argv[3];
if (!payloadPath || !rootDir) {
  console.error('usage: qa-visual-write.mts <payload.json> <rootDir>');
  process.exit(2);
}

const payload = JSON.parse(readFileSync(payloadPath, 'utf8')) as {
  slug: string;
  observations: QaVisualMetrics[];
  findings?: QaVisualFinding[];
};

const report = buildQaVisualReport({
  slug: payload.slug,
  observations: payload.observations,
  findings: payload.findings ?? []
});

const path = writeQaVisualReport(rootDir, report);

process.stdout.write(`${JSON.stringify({ path, report })}\n`);
