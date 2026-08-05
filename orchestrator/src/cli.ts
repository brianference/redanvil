#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateFile } from './commands/validate';
import { rubricSummary } from './commands/rubric';
import { scaffoldFromJobFile } from './commands/scaffold';
import { gateApp } from './commands/gate';
import type { GateReport } from './commands/gate';
import type { Outcome } from './gate/score';
import { collectProvenance } from './gate/provenance';
import { parseVerdicts } from './schemas/verdicts';
import { gitChangeProbe } from './gate/freshness';
import type { StaleVerdict } from './gate/freshness';
import { indexOutcomes } from './gate/score';
import { runLoopCommand } from './commands/loop';
import { runPmCommand } from './commands/pm';
import { isDone } from './gate/done';
import { loadProductJudgementOpts } from './team/finishOpts';

/** Shared CLI flags used by both `gate` and `loop`. */
interface SharedRunFlags {
  threshold: number;
  judge: Outcome[];
  notApplicable: string[];
  /** Raw verdicts file text, hashed into provenance. Null when none was supplied. */
  verdictsRaw: string | null;
  /** Verdicts dropped because their subject changed since they were recorded. */
  staleVerdicts: StaleVerdict[];
}

/** One measured iteration record written into a results payload. */
interface IterationRecord {
  index: number;
  score: number;
  blockers: string[];
}

/**
 * Parse threshold / judge / na flags shared by the gate and loop commands.
 * Behaviour matches the prior inline branches (defaults, empty judge, split na).
 *
 * @param values - Parsed CLI option bag from parseArgs.
 * @param appDir - The directory being gated, used to scope verdict freshness.
 * @returns Threshold, judge outcomes, not-applicable lanes, and stale verdicts.
 */
async function parseSharedRunFlags(
  values: Record<string, string | boolean | undefined>,
  appDir: string
): Promise<SharedRunFlags> {
  const threshold = typeof values.threshold === 'string' ? Number(values.threshold) : 90;
  // Keep the raw text: provenance hashes it, so a swapped or edited verdicts
  // file is detectable. Without that, the CI reproduction re-runs the gate
  // against whatever verdicts it is handed and can only confirm determinism.
  const verdictsRaw =
    typeof values.judge === 'string' ? await readFile(values.judge, 'utf8') : null;
  const repoRoot = process.cwd();
  const parsedVerdicts =
    typeof values.judge === 'string' && verdictsRaw !== null
      ? parseVerdicts(verdictsRaw, values.judge, repoRoot, {
          appDirRel: relative(repoRoot, resolve(appDir)).split(sep).join('/') || '.',
          probe: gitChangeProbe(repoRoot)
        })
      : { outcomes: [] as Outcome[], stale: [] as StaleVerdict[] };
  const judge = parsedVerdicts.outcomes;
  const notApplicable =
    typeof values.na === 'string'
      ? values.na
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  return { threshold, judge, notApplicable, verdictsRaw, staleVerdicts: parsedVerdicts.stale };
}

/**
 * Print every dropped verdict so a failing blocker is traceable to an expired
 * review rather than looking like an unexplained regression.
 *
 * @param stale - Verdicts dropped for staleness.
 */
function reportStaleVerdicts(stale: StaleVerdict[]): void {
  if (stale.length === 0) return;
  console.error(
    `\ngate: ${stale.length} verdict(s) dropped as stale — their subject changed since review.\n` +
      `These rules are now unrecorded and fail closed. Re-review and update the verdicts file.`
  );
  for (const s of stale) {
    const files = s.changedFiles.length > 0 ? ` (${s.changedFiles.join(', ')})` : '';
    console.error(`  ${s.ruleId}: ${s.reason}${files}`);
  }
  console.error('');
}

/**
 * Rule ids excluded from scoring for a `gate` result file: every rule a check
 * itself reported as not-applicable, plus any `--na` waiver. This is
 * `report.notApplicable`, never the raw `--na` flag value alone.
 *
 * Extracted as its own function because the two are easy to confuse and once
 * were: `report.notApplicable` is what the gate actually decided (and what the
 * console `n/a: ...` line already prints), while the CLI-arg-only list is only
 * what the caller asked to waive before any check ran. A det check that
 * reports its own subject absent (e.g. proc-pr-title-ticket with no
 * GITHUB_TOKEN) is not in the caller's list, so writing that list here
 * silently dropped every such rule from provenance.notApplicable — present in
 * neither `rules[]` (it never produced an outcome) nor `notApplicable` (this
 * bug) — which read to `lg-result-reproduces` as an invented gap in the
 * result rather than the legitimate n/a it was.
 *
 * @param report - The gate report whose notApplicable set decides this.
 * @returns The rule ids to write to `provenance.notApplicable`.
 */
export function resultNotApplicable(report: Pick<GateReport, 'notApplicable'>): string[] {
  return report.notApplicable;
}

/**
 * Write a results JSON file for a gate or loop run.
 * Callers supply the measured iteration history; there is no way to hand-author it.
 *
 * @param outPath - Destination path from `--out`.
 * @param args - Slug, scores, rules, iterations, and optional deploy URL.
 */
async function writeResultFile(
  outPath: string,
  args: {
    slug: string;
    finalScore: number;
    threshold: number;
    passed: boolean;
    evaluated: number;
    total: number;
    rules: Array<{ ruleId: string; passed: boolean }>;
    iterations: IterationRecord[];
    deployUrl: string | null;
    verdictsRaw: string | null;
    notApplicable: string[];
    staleVerdicts: string[];
  }
): Promise<void> {
  const result = {
    kind: 'results' as const,
    slug: args.slug,
    finalScore: args.finalScore,
    threshold: args.threshold,
    passed: args.passed,
    evaluated: args.evaluated,
    total: args.total,
    // Per-rule proof: exactly what the gate scored, generated (never hand-authored).
    rules: args.rules,
    iterations: args.iterations,
    deployUrl: args.deployUrl,
    finishedAt: new Date().toISOString(),
    // Machine-generated: which commit and which rubric actually produced this
    // score. Re-checkable by CI, so a hand-authored result file is detectable.
    provenance: collectProvenance(process.cwd(), {
      verdictsRaw: args.verdictsRaw,
      notApplicable: args.notApplicable,
      staleVerdicts: args.staleVerdicts
    })
  };
  await writeFile(outPath, JSON.stringify(result, null, 2) + '\n');
  console.log(`wrote result to ${outPath}`);
}

/** Flags the CLI accepts. Anything else is a typo and must not be swallowed. */
const KNOWN_FLAGS = new Set([
  'threshold',
  'judge',
  'prd',
  'slug',
  'out',
  'deploy',
  'na',
  'spec',
  'max-iters',
  'no-isolate',
  'promote',
  'min-coverage',
  'claims',
  'result',
  'execute',
  'budget',
  'clean'
]);

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    // Kept permissive so an unknown flag produces our own message below rather
    // than a raw TypeError, but it is NOT ignored: `--verdicts` (the wrong name
    // for `--judge`) was silently dropped and the gate scored 23/45 instead of
    // 45/45 while still exiting 0. A misspelt flag must fail loudly.
    strict: false,
    options: {
      threshold: { type: 'string' },
      judge: { type: 'string' },
      prd: { type: 'string' },
      slug: { type: 'string' },
      out: { type: 'string' },
      deploy: { type: 'string' },
      na: { type: 'string' },
      spec: { type: 'string' },
      'max-iters': { type: 'string' },
      'no-isolate': { type: 'boolean' },
      promote: { type: 'boolean' },
      'min-coverage': { type: 'string' },
      claims: { type: 'string' },
      execute: { type: 'boolean' },
      budget: { type: 'string' },
      clean: { type: 'boolean' }
    }
  });

  const unknown = Object.keys(values).filter((k) => !KNOWN_FLAGS.has(k));
  if (unknown.length > 0) {
    console.error(
      `unknown flag(s): ${unknown.map((u) => `--${u}`).join(', ')}\n` +
        `known flags: ${[...KNOWN_FLAGS].map((k) => `--${k}`).join(', ')}`
    );
    return 2;
  }

  // Both write sites (gate, loop) require --slug to emit a result. Asking for
  // output and silently not producing it is the worst outcome: the caller
  // believes the committed result was refreshed when it still holds the previous
  // run's rubric hash, and the gate still exits 0.
  if (typeof values.out === 'string' && typeof values.slug !== 'string') {
    console.error('--out requires --slug (the result file records which app was gated)');
    return 2;
  }
  const [command, arg] = positionals;

  if (command === 'validate') {
    if (!arg) {
      console.error('usage: redanvil validate <file.json>');
      return 2;
    }
    const r = await validateFile(arg);
    if (r.ok) {
      console.log(`ok: valid ${r.kind} payload`);
      return 0;
    }
    console.error('invalid payload:');
    for (const issue of r.issues) console.error(`  - ${issue}`);
    return 1;
  }

  if (command === 'rubric') {
    console.log(rubricSummary());
    return 0;
  }

  if (command === 'pm') {
    // The PM role, reachable at last. team/pm.ts and team/assign.ts had real
    // logic and passing tests with zero callers; this is the entry point that
    // makes them run against a real gate result instead of only against fixtures.
    // Default is dry-run (plan only). --execute opts into real role runs via
    // pmRuntime (worktrees, promote/discard, artifact contract).
    const slug = positionals[1];
    if (!slug) {
      console.error(
        'usage: redanvil pm <slug> [--result results/<slug>.json] [--execute] [--clean] [--max-iters N] [--budget N]'
      );
      return 2;
    }
    const resultPath =
      typeof values.result === 'string' && values.result.length > 0
        ? values.result
        : `results/${slug}.json`;
    if (!resultPath) {
      console.error(
        'usage: redanvil pm <slug> [--result results/<slug>.json] [--execute] [--clean] [--max-iters N] [--budget N]'
      );
      return 2;
    }
    const maxIters =
      typeof values['max-iters'] === 'string' ? Number(values['max-iters']) : undefined;
    const budgetCeiling =
      typeof values.budget === 'string' ? Number(values.budget) : undefined;
    try {
      return await runPmCommand({
        resultPath,
        slug,
        execute: values.execute === true,
        clean: values.clean === true,
        maxIters: Number.isFinite(maxIters) ? maxIters : undefined,
        budgetCeiling: Number.isFinite(budgetCeiling) ? budgetCeiling : undefined,
        threshold:
          typeof values.threshold === 'string' ? Number(values.threshold) : undefined,
        deployUrl: typeof values.deploy === 'string' ? values.deploy : undefined
      });
    } catch (err) {
      console.error(`pm failed: ${err instanceof Error ? err.message : String(err)}`);
      return 2;
    }
  }

  if (command === 'scaffold') {
    const jobPath = positionals[1];
    const outDir = positionals[2];
    if (!jobPath || !outDir) {
      console.error('usage: redanvil scaffold <job.json> <outDir> [--prd <PRD.md>]');
      return 2;
    }
    const corpusDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'rules');
    // The PRD is generated in the browser, so the job file cannot carry it.
    // Passing it in is what puts §7.3a — the layout archetype and visual
    // direction chosen for THIS app — in front of whoever builds it.
    const prdPath = typeof values.prd === 'string' ? values.prd : undefined;
    let prdMarkdown: string | undefined;
    if (prdPath !== undefined) {
      try {
        prdMarkdown = await readFile(prdPath, 'utf8');
      } catch (err) {
        console.error(`could not read PRD at ${prdPath}: ${(err as Error).message}`);
        return 2;
      }
    }
    const r = await scaffoldFromJobFile(
      jobPath,
      outDir,
      corpusDir,
      new Date().toISOString(),
      prdMarkdown
    );
    if (r.ok) {
      console.log(`scaffolded ${r.files} files into ${outDir}`);
      if (!r.prdIncluded) {
        // Loud, not silent. Without it the app carries only the generic rule
        // pack, and the design direction picked for this product is lost.
        console.warn(
          'warning: no PRD included. Re-run with --prd <downloaded PRD.md> so the app ' +
            'ships the spec it was generated from (§7.3a design direction included).'
        );
      }
      return 0;
    }
    console.error('scaffold failed:');
    for (const issue of r.issues) console.error(`  - ${issue}`);
    return 1;
  }

  if (command === 'api-judge') {
    const dir = positionals[1];
    if (!dir) {
      console.error('usage: npm run api-judge -- <appDir>');
      return 2;
    }
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      console.error(`api-judge: ${dir} is not a directory`);
      return 2;
    }
    const { runApiJudge } = await import('./commands/apiJudge');
    const result = await runApiJudge(dir);
    console.log(result.message);
    return result.exitCode;
  }

  if (command === 'gate') {
    const dir = positionals[1];
    if (!dir) {
      console.error(
        'usage: npm run gate -- <appDir> [--threshold N] [--judge f.json] [--na lanes] [--slug s --out r.json --deploy url]'
      );
      return 2;
    }
    // A missing target directory used to score 0/100 with every check "failing",
    // which reads as "your app is broken" when the real problem is a wrong path.
    // An unusable input is a usage error, not a rule violation.
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      console.error(
        `gate: no such app directory: ${dir}\n` +
          `  (resolved from ${process.cwd()})\n` +
          `  Run from the repo root with: npm run gate -- <appDir>`
      );
      return 2;
    }
    const { threshold, judge, notApplicable, verdictsRaw, staleVerdicts } =
      await parseSharedRunFlags(values, dir);
    reportStaleVerdicts(staleVerdicts);
    const report = await gateApp(dir, undefined, judge, notApplicable);
    // Coverage was disclosed but never enforced: a run could waive its way down
    // to a handful of rules and still print 100/100 beside it. --min-coverage
    // makes the denominator a gate too, not just a disclosure.
    const minCoverage =
      typeof values['min-coverage'] === 'string' ? Number(values['min-coverage']) : 0;
    const coverageShort = report.coverage < minCoverage;
    if (coverageShort) {
      console.error(
        `gate: coverage ${report.coverage}% is below the required ${minCoverage}% — ` +
          `the score is measured against too little of the rubric to mean anything`
      );
    }
    const rules = [...indexOutcomes(report.outcomes)].map(([ruleId, passed]) => ({
      ruleId,
      passed
    }));
    // One definition of done — score alone is not finished.
    const gateSlug =
      typeof values.slug === 'string' && values.slug !== ''
        ? values.slug
        : basename(resolve(dir));
    const done = isDone(
      { finalScore: report.score, threshold, rules },
      {
        evidenceStale: staleVerdicts.length > 0,
        ...loadProductJudgementOpts(dir, gateSlug)
      }
    );
    const scoreOk = report.score >= threshold && !coverageShort;
    const finishOk = done.done && !coverageShort;
    const verdict = finishOk ? 'PASS' : 'FAIL';
    // Surface isDone separately so a green score with a missing ship proof is obvious.
    console.log(
      `gate: ${verdict} — score ${report.score}/100 (threshold ${threshold}), ` +
        `evaluated ${report.evaluated}/${report.total} rules, ` +
        `coverage ${report.coverage}% of the full rubric` +
        (report.notApplicable.length > 0 ? ` (n/a: ${report.notApplicable.join(', ')})` : '') +
        (scoreOk && !done.done ? ' [score cleared but isDone did not]' : '')
    );
    console.log(
      done.done
        ? 'gate: isDone = true (score, zero failures, tests, coverage, lg-shipped)'
        : `gate: isDone = false — ${done.reasons.join('; ')}`
    );
    for (const o of report.outcomes) console.log(`  ${o.passed ? 'PASS' : 'FAIL'}  ${o.ruleId}`);
    if (report.blockersFailed.length > 0) {
      console.log(`  blockers failed: ${report.blockersFailed.join(', ')}`);
    }
    if (typeof values.out === 'string' && typeof values.slug === 'string') {
      // A single gate run measured exactly one iteration, so that is what it
      // reports. There is deliberately no flag to supply a longer history here:
      // a hand-passed iteration array is indistinguishable from a fabricated
      // one. Multi-iteration history comes from `redanvil loop`, which measures
      // each pass and returns the records itself.
      await writeResultFile(values.out, {
        slug: values.slug,
        finalScore: report.score,
        threshold,
        // Result `passed` stays score-based for schema compatibility; isDone is
        // the finish line and is printed above / enforced by meets_the_bar.
        passed: report.score >= threshold,
        evaluated: report.evaluated,
        total: report.total,
        rules,
        iterations: [{ index: 1, score: report.score, blockers: report.blockersFailed }],
        deployUrl: typeof values.deploy === 'string' ? values.deploy : null,
        verdictsRaw,
        staleVerdicts: staleVerdicts.map((s) => s.ruleId),
        notApplicable: resultNotApplicable(report)
      });
    }
    // Exit non-zero when score fails OR when the finish line (isDone) fails.
    if (coverageShort) return 1;
    if (report.score < threshold) return 1;
    if (!done.done) return 1;
    return 0;
  }

  if (command === 'loop') {
    const dir = positionals[1];
    if (!dir || typeof values.spec !== 'string') {
      console.error(
        'usage: npm run loop -- <appDir> --spec <spec.md> [--threshold N] [--max-iters N] [--no-isolate] [--promote] [--judge f.json] [--na lanes] [--slug s --out r.json --deploy url]'
      );
      return 2;
    }
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      console.error(`loop: no such app directory: ${dir} (resolved from ${process.cwd()})`);
      return 2;
    }
    if (!existsSync(values.spec)) {
      console.error(`loop: no such spec file: ${values.spec}`);
      return 2;
    }
    const { threshold, judge, notApplicable, verdictsRaw, staleVerdicts } =
      await parseSharedRunFlags(values, dir);
    reportStaleVerdicts(staleVerdicts);
    const maxIters = typeof values['max-iters'] === 'string' ? Number(values['max-iters']) : 5;

    const run = await runLoopCommand({
      dir,
      specPath: values.spec,
      threshold,
      maxIters,
      judge,
      notApplicable,
      // Isolated by default; --no-isolate runs the coder in the working tree,
      // which is what a human debugging the loop usually wants.
      isolate: values['no-isolate'] !== true,
      // Off unless asked for. The run is merged only when the gate is green,
      // and only after the COMMIT (not the tree) builds in isolation.
      promote: values.promote === true
    });
    const { loop: result, final } = run;

    const loopRules = [...indexOutcomes(final.outcomes)].map(([ruleId, passed]) => ({
      ruleId,
      passed
    }));
    const loopSlug = basename(resolve(dir));
    const loopDone = isDone(
      { finalScore: result.finalScore, threshold, rules: loopRules },
      {
        evidenceStale: staleVerdicts.length > 0,
        // Disk first (same as GATE); live review overwrites so a just-run
        // judge is not clobbered by a missing/stale evidence write.
        ...loadProductJudgementOpts(dir, loopSlug),
        independentReviewOk: run.independentReviewOk
      }
    );
    console.log(
      `loop: ${result.passed && loopDone.done ? 'PASS' : 'FAIL'} — ${result.finalScore}/100 after ${result.iterations} iteration(s)`
    );
    console.log(
      loopDone.done
        ? 'loop: isDone = true'
        : `loop: isDone = false — ${loopDone.reasons.join('; ')}`
    );
    for (const r of result.records) {
      const blockers = r.blockers.length > 0 ? ` blockers: ${r.blockers.join(', ')}` : '';
      console.log(`  iteration ${r.index}: ${r.score}/100${blockers}`);
    }
    if (result.promise !== null) console.log(result.promise);
    console.log(`loop: independent review — ${run.independentReviewSummary}`);

    if (typeof values.out === 'string' && typeof values.slug === 'string') {
      // `records` is the loop's own measurement of every pass, which is what
      // makes a multi-iteration history real rather than asserted.
      await writeResultFile(values.out, {
        slug: values.slug,
        finalScore: result.finalScore,
        threshold,
        passed: result.passed && loopDone.done,
        evaluated: final.evaluated,
        total: final.total,
        rules: loopRules,
        iterations: result.records,
        deployUrl: typeof values.deploy === 'string' ? values.deploy : null,
        verdictsRaw,
        staleVerdicts: staleVerdicts.map((s) => s.ruleId),
        // Same fix as the `gate` command above: `final` is the last gate
        // pass's own GateReport, so its notApplicable is the full set.
        notApplicable: resultNotApplicable(final)
      });
    }
    return result.passed && loopDone.done ? 0 : 1;
  }

  console.error('usage: redanvil <validate|rubric|scaffold|gate|loop|pm> [args]');
  return 2;
}

// Only run when invoked as the entrypoint (`node cli.ts ...` / `npx tsx cli.ts
// ...`), never on import. Without this guard, importing this module for its
// exported pure helpers (e.g. in a unit test) parsed process.argv as if it
// were a real CLI invocation and called process.exit(), killing the test
// runner -- the same class of defect the check scripts already guard against.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
