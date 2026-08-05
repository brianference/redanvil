/**
 * Record an independent diff review produced by a reviewer this process cannot
 * spawn, when the default reviewer is unreachable.
 *
 * WHY THIS EXISTS: Grok Build's weekly balance ran out mid-release, so
 * judge_diff reported 'judge could not run' and F5 failed closed — correct, and
 * also unshippable. The honest options are to wait, or to have a DIFFERENT
 * reviewer judge the diff and say so in the record. This is the second one, and
 * it is not a bypass:
 *
 *   - Findings must come from a real reviewer reading the real diff.
 *   - `ok` is DERIVED from those findings by the one decision implementation in
 *     independentReview.ts. This supplies findings, never a verdict.
 *   - The report records mode 'external' plus reviewerId, so a reader can always
 *     see WHO judged. It never claims to be the default reviewer.
 *   - The TEST fixture path is untouched; production does not borrow it.
 *
 * Usage:
 *   npx tsx judge-diff-external.mts <appDir> --reviewer <id> --findings <f.json>
 *                                   [--diff-range r] [--diff-paths a,b]
 *
 * Findings file: JSON array of { title, citation, detail, passed }.
 * Exit 0 when a report was written, 2 on usage error.
 */
import { readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import {
  runIndependentDiffReview,
  type IndependentFinding
} from '../../src/loop/independentReview';

const args = process.argv.slice(2);
const appDir = args[0];
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

if (appDir === undefined || appDir.startsWith('--')) {
  process.stderr.write(
    'usage: npx tsx judge-diff-external.mts <appDir> --reviewer <id> --findings <f.json>\n'
  );
  process.exit(2);
}

const reviewerId = flag('reviewer');
const findingsPath = flag('findings');
if (reviewerId === undefined || findingsPath === undefined) {
  process.stderr.write('judge-diff-external: --reviewer and --findings are both required\n');
  process.exit(2);
}

let parsed: unknown;
try {
  parsed = JSON.parse(readFileSync(findingsPath, 'utf8'));
} catch (err) {
  process.stderr.write(`judge-diff-external: cannot read findings: ${String(err).slice(0, 200)}\n`);
  process.exit(2);
}
if (!Array.isArray(parsed)) {
  process.stderr.write('judge-diff-external: findings file must be a JSON array\n');
  process.exit(2);
}

// Fail loudly on a malformed finding rather than dropping it. A dropped finding
// is a finding that never blocked anything.
const findings: IndependentFinding[] = [];
for (const f of parsed) {
  const row = f as Record<string, unknown>;
  if (
    f === null ||
    typeof f !== 'object' ||
    typeof row.title !== 'string' ||
    typeof row.citation !== 'string' ||
    typeof row.passed !== 'boolean'
  ) {
    process.stderr.write(
      `judge-diff-external: malformed finding (need title, citation, passed): ${JSON.stringify(f).slice(0, 160)}\n`
    );
    process.exit(2);
  }
  findings.push({
    title: row.title,
    citation: row.citation,
    detail: typeof row.detail === 'string' ? row.detail : '',
    passed: row.passed
  });
}

const dir = resolve(appDir);
const diffPaths = flag('diff-paths');
const report = runIndependentDiffReview({
  dir,
  externalReview: { reviewerId, findings },
  diffRange: flag('diff-range'),
  diffPaths: diffPaths === undefined ? undefined : diffPaths.split(',')
});

const failing = report.findings.filter((f) => f.passed !== true);
process.stdout.write(
  `judge-diff-external: ${basename(dir)} reviewer=${reviewerId} completed=${report.completed} ` +
    `ok=${report.ok} findings=${report.findings.length} failing=${failing.length} ` +
    `coverage=${report.coverageChars}/${report.diffChars} commit=${String(report.commit).slice(0, 12)}\n`
);
for (const f of failing) {
  process.stdout.write(`  FAIL  ${f.title} (${f.citation})\n`);
}
