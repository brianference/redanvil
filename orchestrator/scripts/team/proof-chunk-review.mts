/**
 * One-shot proof that multi-chunk independent review covers the full release
 * diff and fails closed on an unparseable chunk. Uses reviewChunk (no live judge CLI).
 *
 * Usage: npx tsx orchestrator/scripts/team/proof-chunk-review.mts
 */
import { resolve, join } from 'node:path';
import { runIndependentDiffReview } from '../../src/loop/independentReview';

const repoRoot = resolve('.');

/**
 * Run one proof case and print a compact JSON summary.
 *
 * @param label - Case name.
 * @param report - Review report.
 */
function show(
  label: string,
  report: {
    completed: boolean;
    ok: boolean;
    chunkCount?: number;
    coverageChars?: number;
    diffChars?: number;
    coverageComplete?: boolean;
    findings: Array<{ title: string; detail: string; passed: boolean }>;
  }
): void {
  const truncationish = report.findings.filter((f) =>
    /diff truncated|cannot verify full change set|incomplete review scope/i.test(
      `${f.title} ${f.detail}`
    )
  );
  process.stdout.write(
    `${label}: ${JSON.stringify(
      {
        completed: report.completed,
        ok: report.ok,
        chunkCount: report.chunkCount,
        coverageChars: report.coverageChars,
        diffChars: report.diffChars,
        coverageComplete: report.coverageComplete,
        findingTitles: report.findings.map((f) => f.title),
        truncationish: truncationish.map((f) => f.title)
      },
      null,
      2
    )}\n`
  );
}

// a) Full app-builder release range (the largest in-repo app, so it spans
// several chunks) — every chunk clean → full coverage, no truncation finding.
const bigClean = await runIndependentDiffReview({
  dir: resolve(repoRoot, 'app-builder'),
  repoRoot,
  outPath: join(repoRoot, 'evidence', 'judge-diff-app-builder-chunk-proof.json'),
  diffRange: 'origin/master..HEAD',
  diffPaths: [':(top)app-builder'],
  reviewChunk: ({ index, total }) => {
    process.stdout.write(`app-builder clean: chunk ${index + 1}/${total}\n`);
    return {
      stdout: JSON.stringify({ foundNothingExplicit: true, findings: [] })
    };
  }
});
show('a-app-builder-clean', bigClean);

// c) One unparseable chunk → aggregate completed false / ok false.
const bigBlind = await runIndependentDiffReview({
  dir: resolve(repoRoot, 'app-builder'),
  repoRoot,
  outPath: join(repoRoot, 'evidence', 'judge-diff-app-builder-unparseable-proof.json'),
  diffRange: 'origin/master..HEAD',
  diffPaths: [':(top)app-builder'],
  reviewChunk: ({ index }) => {
    if (index === 2) return { stdout: 'NOT JSON — blind chunk' };
    return {
      stdout: JSON.stringify({ foundNothingExplicit: true, findings: [] })
    };
  }
});
show('c-app-builder-unparseable', bigBlind);

// b) dashboard fits one chunk.
const dash = await runIndependentDiffReview({
  dir: resolve(repoRoot, 'dashboard'),
  repoRoot,
  outPath: join(repoRoot, 'evidence', 'judge-diff-dashboard-chunk-proof.json'),
  diffRange: 'origin/master..HEAD',
  diffPaths: [':(top)dashboard'],
  reviewChunk: () => ({
    stdout: JSON.stringify({ foundNothingExplicit: true, findings: [] })
  })
});
show('b-dashboard', dash);

const pass =
  bigClean.completed === true &&
  bigClean.ok === true &&
  bigClean.coverageComplete === true &&
  bigClean.coverageChars === bigClean.diffChars &&
  (bigClean.chunkCount ?? 0) > 1 &&
  bigClean.findings.every((f) => !/diff truncated/i.test(f.title)) &&
  bigBlind.completed === false &&
  bigBlind.ok === false &&
  bigBlind.findings.some((f) => f.title === 'unparseable judge output') &&
  dash.completed === true &&
  dash.chunkCount === 1 &&
  dash.coverageChars === dash.diffChars;

process.stdout.write(pass ? 'PROOF PASS\n' : 'PROOF FAIL\n');
process.exit(pass ? 0 : 1);
