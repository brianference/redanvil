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
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Resolve the gate against THIS script's location, not the working directory.
// Verifying an app that lives in its own repository runs with cwd set to that
// app, where `orchestrator/src/cli.ts` does not exist -- the reproduction died
// with ERR_MODULE_NOT_FOUND before it compared anything. The gate is always a
// sibling of this file; the app under review is not.
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const gateCli = join(repoRoot, 'orchestrator', 'src', 'cli.ts');

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
  gateCli,
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

let gateError = null;
try {
  execFileSync('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });
} catch (err) {
  // A non-zero exit USUALLY means the gate scored below threshold, and we still
  // want to compare. But a crash exits non-zero too, and then it never writes
  // --out, so swallowing this reported `ENOENT ...verify.json` from the readFile
  // below -- an error naming a missing file instead of the reason it is missing.
  // Drift run 31776824410 failed exactly that way while this same command
  // succeeds locally, so the one piece of evidence that would explain the
  // difference was the piece being discarded. Keep it, and only surface it when
  // the gate genuinely produced nothing.
  gateError = err;
}

let fresh;
try {
  fresh = JSON.parse(await readFile(tmp, 'utf8'));
} catch (err) {
  if (gateError !== null) {
    const status = gateError.status ?? 'unknown';
    fail(
      `the gate exited ${status} without writing ${tmp}, so there is nothing to ` +
        `compare. This is a gate failure, not a reproduction mismatch — the ` +
        `error below is the gate's, not this script's:\n${String(gateError.message ?? gateError)}`
    );
  }
  fail(`could not read the freshly gated result at ${tmp}: ${String(err)}`);
}

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
  // NAME THE RULES, do not just print the counts.
  //
  // "committed 83/83, reproduced 61/83" has been the whole of this failure for
  // days, and it is unactionable: it says 22 rules went missing without saying
  // which 22, so every reading of it has been a guess. The project's own
  // hardest-won lesson is that the fix for a stuck diagnosis is usually to
  // print the evidence the code already has rather than to reason harder --
  // `--prompt=A` ended three sessions of hypotheses the moment it was printed.
  // Both rule lists are in memory right here; withholding them costs nothing
  // and buys nothing.
  const committedIds = new Set(committed.rules.map((r) => r.ruleId));
  const freshIds = new Set(fresh.rules.map((r) => r.ruleId));
  const onlyCommitted = [...committedIds].filter((id) => !freshIds.has(id)).sort();
  const onlyFresh = [...freshIds].filter((id) => !committedIds.has(id)).sort();
  const detail = [
    `coverage mismatch: committed ${committed.evaluated}/${committed.total}, ` +
      `reproduced ${fresh.evaluated}/${fresh.total}.`,
    onlyCommitted.length
      ? `measured when the result was committed but NOT reproduced here (${onlyCommitted.length}): ${onlyCommitted.join(', ')}`
      : 'no rule measured at commit time is missing from the reproduction.',
    onlyFresh.length
      ? `reproduced here but absent from the committed result (${onlyFresh.length}): ${onlyFresh.join(', ')}`
      : 'the reproduction introduced no rule the committed result lacks.'
  ].join('\n  ');
  fail(detail);
}

/**
 * Rules whose value is ABOUT the reproduction, so comparing them INSIDE a
 * reproduction is circular.
 *
 * `lg-result-reproduces` records whether the committed result reproduced. The
 * committed copy therefore reflects a completed reproduction, while this run
 * recomputes it from scratch — the two disagree by construction, and no number
 * of re-gates converges them. Locally two cycles appeared to settle it and CI
 * then reported the mismatch again, which is the tell: it is not staleness, it
 * is self-reference.
 *
 * Narrow on purpose. The rule is still scored by the gate, still counted in the
 * `passed === false` set that blocks isDone, and still shown in the result. The
 * ONLY thing relaxed is requiring a reproduction to agree with a recorded value
 * that describes reproduction itself. Every other rule is still compared exactly.
 */
const SELF_REFERENTIAL_RULES = new Set(['lg-result-reproduces']);

const freshById = new Map(fresh.rules.map((r) => [r.ruleId, r.passed]));
const mismatched = committed.rules.filter(
  (r) => !SELF_REFERENTIAL_RULES.has(r.ruleId) && freshById.get(r.ruleId) !== r.passed
);
if (mismatched.length > 0) {
  fail(`per-rule mismatch on: ${mismatched.map((r) => r.ruleId).join(', ')}`);
}

const skipped = committed.rules.filter(
  (r) => SELF_REFERENTIAL_RULES.has(r.ruleId) && freshById.get(r.ruleId) !== r.passed
);
for (const r of skipped) {
  // Say it out loud. A comparison quietly dropped is indistinguishable from one
  // that passed, which is the failure mode this repo keeps finding elsewhere.
  console.log(
    `  NOT COMPARED  ${r.ruleId}: committed ${r.passed}, reproduced ` +
      `${freshById.get(r.ruleId)} — self-referential, see SELF_REFERENTIAL_RULES`
  );
}

console.log(
  `results verified: ${committed.slug} reproduced at ${fresh.finalScore}/100, ` +
    `${fresh.evaluated}/${fresh.total} rules, ${committed.rules.length} outcomes matched.`
);
