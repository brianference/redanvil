#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { validateFile } from './commands/validate';
import { rubricSummary } from './commands/rubric';

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

  console.error('usage: redanvil <validate|rubric> [args]');
  return 2;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
