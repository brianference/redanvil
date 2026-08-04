/**
 * Thin CLI bridge so judge_diff.mjs can call the ONE independent-diff-review
 * implementation in src/loop/independentReview.ts without reimplementing it.
 *
 * Never hand-authors a passing report: runs the reviewer (or fixture mode for
 * tests) and records whatever came back, findings and all.
 *
 * Usage:
 *   npx tsx judge-diff-run.mts <appDir> [--out path] [--timeout ms] [--repo-root path]
 *
 * Prints one JSON line: the IndependentReviewReport. Exit 0 when the run
 * completed (ok or not), 1 when the judge could not finish, 2 on usage error.
 */
import { resolve, basename } from 'node:path';
import { runIndependentDiffReview } from '../../src/loop/independentReview';

const args = process.argv.slice(2);
const appDir = args[0];
if (appDir === undefined || appDir.startsWith('--')) {
  process.stderr.write(
    'usage: npx tsx judge-diff-run.mts <appDir> [--out path] [--timeout ms] [--repo-root path]\n'
  );
  process.exit(2);
}

/**
 * Read a `--name value` flag.
 *
 * @param name - Flag name without dashes.
 * @param fallback - Default when absent.
 * @returns Flag value.
 */
function flag(name: string, fallback: string | undefined): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
}

const outPath = flag('out', undefined);
const repoRoot = flag('repo-root', undefined);
const timeoutRaw = flag('timeout', undefined);
const timeoutMs =
  timeoutRaw !== undefined && Number.isFinite(Number(timeoutRaw))
    ? Number(timeoutRaw)
    : undefined;

const dir = resolve(appDir);
const report = runIndependentDiffReview({
  dir,
  repoRoot: repoRoot !== undefined ? resolve(repoRoot) : undefined,
  outPath: outPath !== undefined ? resolve(outPath) : undefined,
  timeoutMs
});

process.stdout.write(`${JSON.stringify(report)}\n`);

// Completed runs exit 0 even when ok is false — the report is the product.
// Incomplete / unavailable is infrastructure failure.
if (!report.completed) {
  process.stderr.write(
    `judge-diff-run: review incomplete for ${basename(dir)} (${report.mode})\n`
  );
  process.exit(1);
}
process.exit(0);
