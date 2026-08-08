#!/usr/bin/env node
/**
 * Walk the whole process map for one app, running each role and stopping dead at
 * the first unmet contract.
 *
 * This is the same order and the same contracts the generated n8n workflow uses.
 * It exists so a build can be walked and debugged without the n8n server holding
 * the task-broker port, and so each role's binding is declared in ONE place that
 * both paths read.
 *
 * A role with no command bound is not skipped -- it fails. An unbound role is
 * the "step that was never started" failure, which is what the whole map exists
 * to prevent.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { evaluateProcess } from './contract-check.mjs';
import { orderedSteps } from './process-map.mjs';

/**
 * Command bound to each role, as a template. `{slug}` and `{root}` are
 * substituted. A role absent from this map has no runner and will fail.
 * @type {Record<string,string>}
 */
const BINDINGS = {
  prd: 'node n8n-prototype/roles/prd.mjs --slug={slug} --repoRoot={root} --prompt={prompt}',
  product: 'node n8n-prototype/roles/product.mjs --slug={slug} --repoRoot={root}',
  reuse: 'node n8n-prototype/roles/reuse.mjs --slug={slug} --repoRoot={root}'
};

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = /^--([^=]+)=([\s\S]*)$/.exec(a);
    return m ? [[m[1], m[2]]] : [];
  })
);
const slug = args.slug;
if (!slug) {
  process.stderr.write('usage: run-build.mjs --slug=X [--prompt="..."] [--only=step]\n');
  process.exit(2);
}
const root = resolve(args.repoRoot ?? process.cwd());
const appDir = resolve(root, slug);

/**
 * Substitute template placeholders in a bound command.
 * @param {string} tpl the template
 * @returns {string} the concrete command
 */
function fill(tpl) {
  return tpl
    .replaceAll('{slug}', slug)
    .replaceAll('{root}', JSON.stringify(root))
    .replaceAll('{prompt}', JSON.stringify(args.prompt ?? ''));
}

console.log(`build: ${slug}\n`);
let stopped = null;

for (const step of orderedSteps()) {
  if (args.only && args.only !== step.id) continue;

  const before = evaluateProcess(appDir).find((r) => r.step === step.id);
  if (before?.status === 'DONE') {
    console.log(`SKIP  ${step.id.padEnd(11)} already satisfied`);
    continue;
  }

  const tpl = BINDINGS[step.id];
  if (!tpl) {
    console.log(`STOP  ${step.id.padEnd(11)} no runner bound -- an unbound role is a step that never started`);
    stopped = step.id;
    break;
  }

  const cmd = fill(tpl);
  console.log(`RUN   ${step.id.padEnd(11)} ${cmd.slice(0, 90)}`);
  const proc = spawnSync(cmd, { cwd: root, shell: true, encoding: 'utf8', timeout: 25 * 60 * 1000 });
  if (proc.stdout?.trim()) console.log(`      ${proc.stdout.trim().split('\n').slice(-2).join(' | ')}`);

  const after = evaluateProcess(appDir).find((r) => r.step === step.id);
  if (after?.status === 'DONE') {
    console.log(`OK    ${step.id.padEnd(11)} contract satisfied`);
  } else {
    console.log(`FAIL  ${step.id.padEnd(11)} exit ${proc.status}`);
    for (const reason of after?.reasons ?? []) console.log(`        - ${reason}`);
    if (proc.stderr?.trim()) console.log(`        stderr: ${proc.stderr.trim().split('\n').slice(-1)[0]}`);
    stopped = step.id;
    break;
  }
}

const results = evaluateProcess(appDir);
const done = results.filter((r) => r.status === 'DONE').length;
console.log(`\n${done}/${results.length} steps DONE${stopped ? `, stopped at ${stopped}` : ''}`);
process.exit(stopped ? 1 : 0);
