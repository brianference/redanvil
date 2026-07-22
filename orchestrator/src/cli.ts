#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFile } from './commands/validate';
import { rubricSummary } from './commands/rubric';
import { scaffoldFromJobFile } from './commands/scaffold';
import { gateApp } from './commands/gate';
import type { Outcome } from './gate/score';

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    strict: false,
    options: {
      threshold: { type: 'string' },
      judge: { type: 'string' },
      slug: { type: 'string' },
      out: { type: 'string' },
      deploy: { type: 'string' },
      na: { type: 'string' },
      iterations: { type: 'string' }
    }
  });
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
      console.error('usage: redanvil gate <appDir> [--threshold N] [--judge f.json] [--slug s --out r.json --deploy url]');
      return 2;
    }
    const threshold = typeof values.threshold === 'string' ? Number(values.threshold) : 90;
    const judge: Outcome[] =
      typeof values.judge === 'string'
        ? (JSON.parse(await readFile(values.judge, 'utf8')) as Outcome[])
        : [];
    const notApplicable =
      typeof values.na === 'string'
        ? values.na.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
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
      // Optional real iteration history: --iterations '[{"index":1,"score":0,"blockers":["fe-responsive-375"]}]'
      let iterations = [{ index: 1, score: report.score, blockers: report.blockersFailed }];
      if (typeof values.iterations === 'string') {
        iterations = JSON.parse(values.iterations) as typeof iterations;
      }
      const result = {
        kind: 'results',
        slug: values.slug,
        finalScore: report.score,
        threshold,
        passed: report.score >= threshold,
        evaluated: report.evaluated,
        total: report.total,
        // Per-rule proof: exactly what the gate scored, generated (never hand-authored).
        rules: report.outcomes.map((o) => ({ ruleId: o.ruleId, passed: o.passed })),
        iterations,
        deployUrl: typeof values.deploy === 'string' ? values.deploy : null,
        finishedAt: new Date().toISOString()
      };
      await writeFile(values.out, JSON.stringify(result, null, 2) + '\n');
      console.log(`wrote result to ${values.out}`);
    }
    return report.score >= threshold ? 0 : 1;
  }

  console.error('usage: redanvil <validate|rubric|scaffold|gate> [args]');
  return 2;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
