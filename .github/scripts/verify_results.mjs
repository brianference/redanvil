#!/usr/bin/env node
/**
 * Verify that a committed results file was really produced by the gate, not
 * hand-authored. Re-runs the gate against the same app with the same recorded
 * verdicts and compares the outcome, rule-by-rule.
 *
 * This exists because a correctly-shaped JSON score is indistinguishable from a
 * real one by inspection. The only durable defence is reproducing it.
 *
 * Usage: node .github/scripts/verify_results.mjs <appDir> <resultFile> <verdictFile> <naLanes>
 */
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const [appDir, resultFile, verdictFile, naLanes = ''] = process.argv.slice(2);

if (!appDir || !resultFile || !verdictFile) {
  console.error('usage: verify_results.mjs <appDir> <resultFile> <verdictFile> [naLanes]');
  process.exit(2);
}

/** Fail with a clear message and a non-zero exit. */
function fail(message) {
  console.error(`RESULTS VERIFICATION FAILED: ${message}`);
  process.exit(1);
}

const committed = JSON.parse(await readFile(resultFile, 'utf8'));

if (!committed.provenance) {
  fail(`${resultFile} has no provenance block — it cannot be traced to a real gate run.`);
}

// Re-run the gate to a temp file and compare against what is committed.
const tmp = `${resultFile}.verify.json`;
const args = [
  'tsx',
  'orchestrator/src/cli.ts',
  'gate',
  appDir,
  '--threshold',
  String(committed.threshold),
  '--judge',
  verdictFile,
  '--slug',
  committed.slug,
  '--out',
  tmp
];
if (naLanes) args.push('--na', naLanes);

try {
  execFileSync('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });
} catch {
  // A non-zero exit means the gate scored below threshold; we still compare.
}

const fresh = JSON.parse(await readFile(tmp, 'utf8'));

// The verdicts file supplies the rules no static check can decide — the majority
// of the score. Re-running the gate against a DIFFERENT verdicts file than the
// one that produced the committed result would reproduce happily and prove
// nothing, so the hashes must match too.
if (fresh.provenance.verdictsHash !== committed.provenance.verdictsHash) {
  fail(
    `verdicts mismatch: the committed result was produced with verdicts ` +
      `${String(committed.provenance.verdictsHash).slice(0, 12)}, but ${verdictFile} hashes to ` +
      `${String(fresh.provenance.verdictsHash).slice(0, 12)}. Re-run the gate and commit the new result.`
  );
}

// `--na` decides the denominator, so a result produced with a wider waiver than
// CI reproduces with is not the same run.
const committedNa = (committed.provenance.notApplicable ?? []).join(',');
const freshNa = (fresh.provenance.notApplicable ?? []).join(',');
if (committedNa !== freshNa) {
  fail(
    `notApplicable mismatch: committed waived [${committedNa}], reproduction waived [${freshNa}].`
  );
}

if (fresh.provenance.rubricHash !== committed.provenance.rubricHash) {
  fail(
    `rubric changed since the result was written (committed ${committed.provenance.rubricHash.slice(0, 12)}, ` +
      `now ${fresh.provenance.rubricHash.slice(0, 12)}). Re-run the gate and commit the new result.`
  );
}

if (fresh.finalScore !== committed.finalScore) {
  fail(`score mismatch: committed ${committed.finalScore}, reproduced ${fresh.finalScore}.`);
}

if (fresh.evaluated !== committed.evaluated || fresh.total !== committed.total) {
  fail(
    `coverage mismatch: committed ${committed.evaluated}/${committed.total}, ` +
      `reproduced ${fresh.evaluated}/${fresh.total}.`
  );
}

const freshById = new Map(fresh.rules.map((r) => [r.ruleId, r.passed]));
const mismatched = committed.rules.filter((r) => freshById.get(r.ruleId) !== r.passed);
if (mismatched.length > 0) {
  fail(`per-rule mismatch on: ${mismatched.map((r) => r.ruleId).join(', ')}`);
}

console.log(
  `results verified: ${committed.slug} reproduced at ${fresh.finalScore}/100, ` +
    `${fresh.evaluated}/${fresh.total} rules, ${committed.rules.length} outcomes matched.`
);
