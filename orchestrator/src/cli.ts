#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFile } from './commands/validate';
import { rubricSummary } from './commands/rubric';
import { scaffoldFromJobFile } from './commands/scaffold';
import { gateApp } from './commands/gate';
import type { Outcome } from './gate/score';
import { collectProvenance } from './gate/provenance';
import { parseVerdicts } from './schemas/verdicts';
import { indexOutcomes } from './gate/score';
import { runLoopCommand } from './commands/loop';

/** Shared CLI flags used by both `gate` and `loop`. */
interface SharedRunFlags {
  threshold: number;
  judge: Outcome[];
  notApplicable: string[];
  /** Raw verdicts file text, hashed into provenance. Null when none was supplied. */
  verdictsRaw: string | null;
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
 * @returns Threshold, judge outcomes, and not-applicable lanes.
 */
async function parseSharedRunFlags(
  values: Record<string, string | boolean | undefined>
): Promise<SharedRunFlags> {
  const threshold = typeof values.threshold === 'string' ? Number(values.threshold) : 90;
  // Keep the raw text: provenance hashes it, so a swapped or edited verdicts
  // file is detectable. Without that, the CI reproduction re-runs the gate
  // against whatever verdicts it is handed and can only confirm determinism.
  const verdictsRaw =
    typeof values.judge === 'string' ? await readFile(values.judge, 'utf8') : null;
  const judge: Outcome[] =
    typeof values.judge === 'string' && verdictsRaw !== null
      ? parseVerdicts(verdictsRaw, values.judge)
      : [];
  const notApplicable =
    typeof values.na === 'string'
      ? values.na
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  return { threshold, judge, notApplicable, verdictsRaw };
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
      notApplicable: args.notApplicable
    })
  };
  await writeFile(outPath, JSON.stringify(result, null, 2) + '\n');
  console.log(`wrote result to ${outPath}`);
}

/** Flags the CLI accepts. Anything else is a typo and must not be swallowed. */
const KNOWN_FLAGS = new Set([
  'threshold',
  'judge',
  'slug',
  'out',
  'deploy',
  'na',
  'spec',
  'max-iters',
  'no-isolate'
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
      slug: { type: 'string' },
      out: { type: 'string' },
      deploy: { type: 'string' },
      na: { type: 'string' },
      spec: { type: 'string' },
      'max-iters': { type: 'string' },
      'no-isolate': { type: 'boolean' }
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

  if (command === 'scaffold') {
    const jobPath = positionals[1];
    const outDir = positionals[2];
    if (!jobPath || !outDir) {
      console.error('usage: redanvil scaffold <job.json> <outDir>');
      return 2;
    }
    const corpusDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'rules');
    const r = await scaffoldFromJobFile(jobPath, outDir, corpusDir, new Date().toISOString());
    if (r.ok) {
      console.log(`scaffolded ${r.files} files into ${outDir}`);
      return 0;
    }
    console.error('scaffold failed:');
    for (const issue of r.issues) console.error(`  - ${issue}`);
    return 1;
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
    const { threshold, judge, notApplicable, verdictsRaw } = await parseSharedRunFlags(values);
    const report = await gateApp(dir, undefined, judge, notApplicable);
    const verdict = report.score >= threshold ? 'PASS' : 'FAIL';
    console.log(
      `gate: ${verdict} — score ${report.score}/100 (threshold ${threshold}), evaluated ${report.evaluated}/${report.total} rules`
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
        passed: report.score >= threshold,
        evaluated: report.evaluated,
        total: report.total,
        rules: [...indexOutcomes(report.outcomes)].map(([ruleId, passed]) => ({ ruleId, passed })),
        iterations: [{ index: 1, score: report.score, blockers: report.blockersFailed }],
        deployUrl: typeof values.deploy === 'string' ? values.deploy : null,
        verdictsRaw,
        notApplicable
      });
    }
    return report.score >= threshold ? 0 : 1;
  }

  if (command === 'loop') {
    const dir = positionals[1];
    if (!dir || typeof values.spec !== 'string') {
      console.error(
        'usage: npm run loop -- <appDir> --spec <spec.md> [--threshold N] [--max-iters N] [--no-isolate] [--judge f.json] [--na lanes] [--slug s --out r.json --deploy url]'
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
    const { threshold, judge, notApplicable, verdictsRaw } = await parseSharedRunFlags(values);
    const maxIters = typeof values['max-iters'] === 'string' ? Number(values['max-iters']) : 5;

    const { loop: result, final } = await runLoopCommand({
      dir,
      specPath: values.spec,
      threshold,
      maxIters,
      judge,
      notApplicable,
      // Isolated by default; --no-isolate runs the coder in the working tree,
      // which is what a human debugging the loop usually wants.
      isolate: values['no-isolate'] !== true
    });

    console.log(
      `loop: ${result.passed ? 'PASS' : 'FAIL'} — ${result.finalScore}/100 after ${result.iterations} iteration(s)`
    );
    for (const r of result.records) {
      const blockers = r.blockers.length > 0 ? ` blockers: ${r.blockers.join(', ')}` : '';
      console.log(`  iteration ${r.index}: ${r.score}/100${blockers}`);
    }
    if (result.promise !== null) console.log(result.promise);

    if (typeof values.out === 'string' && typeof values.slug === 'string') {
      // `records` is the loop's own measurement of every pass, which is what
      // makes a multi-iteration history real rather than asserted.
      await writeResultFile(values.out, {
        slug: values.slug,
        finalScore: result.finalScore,
        threshold,
        passed: result.passed,
        evaluated: final.evaluated,
        total: final.total,
        rules: [...indexOutcomes(final.outcomes)].map(([ruleId, passed]) => ({ ruleId, passed })),
        iterations: result.records,
        deployUrl: typeof values.deploy === 'string' ? values.deploy : null,
        verdictsRaw,
        notApplicable
      });
    }
    return result.passed ? 0 : 1;
  }

  console.error('usage: redanvil <validate|rubric|scaffold|gate|loop> [args]');
  return 2;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
