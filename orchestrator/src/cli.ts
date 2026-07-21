#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFile } from './commands/validate';
import { rubricSummary } from './commands/rubric';
import { scaffoldFromJobFile } from './commands/scaffold';

async function main(): Promise<number> {
  const { positionals } = parseArgs({ allowPositionals: true, strict: false });
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

  console.error('usage: redanvil <validate|rubric|scaffold> [args]');
  return 2;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
