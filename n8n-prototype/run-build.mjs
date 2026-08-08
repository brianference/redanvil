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
import { BINDINGS, fillBinding, unboundRoles } from './bindings.mjs';

// Bindings live in bindings.mjs so the generator and this walker cannot drift.

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    // Bare flags must parse. `--continue` was silently DROPPED by a parser that
    // only matched --key=value, so survey mode looked like it ran and the build
    // halted at the first failure instead.
    const kv = /^--([^=]+)=([\s\S]*)$/.exec(a);
    if (kv) return [[kv[1], kv[2]]];
    const bare = /^--([^=]+)$/.exec(a);
    return bare ? [[bare[1], true]] : [];
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
  return fillBinding(tpl, { slug, root, prompt: args.prompt });
}

const allSteps = orderedSteps();
const unbound = unboundRoles(allSteps.map((x) => x.id));
console.log(`build: ${slug}`);
console.log(`${unbound.length} role(s) unbound: ${unbound.join(', ') || 'none'}
`);

/**
 * How many times each step has been re-entered by a rework loop. An unbounded
 * loop is how a build runs forever without anyone deciding to stop, so every
 * cycle is counted against the step's maxCycles.
 * @type {Map<string, number>}
 */
const cycles = new Map();

/** Failures carried past under --continue, reprinted at the end so none is hidden. */
const failures = [];

/**
 * Steps a rework loop has invalidated. A step listed here re-runs even if its
 * contract is currently satisfied, because "satisfied by an earlier attempt" is
 * precisely the state a downstream rejection is disputing.
 * @type {Set<string>}
 */
const forceRerun = new Set();
let stopped = null;
let cursor = 0;

while (cursor < allSteps.length) {
  const step = allSteps[cursor];
  if (args.only && args.only !== step.id) {
    cursor += 1;
    continue;
  }

  const before = evaluateProcess(appDir).find((r) => r.step === step.id);
  if (before?.status === 'DONE' && !forceRerun.has(step.id)) {
    console.log(`SKIP  ${step.id.padEnd(11)} already satisfied`);
    cursor += 1;
    continue;
  }
  if (forceRerun.has(step.id)) {
    console.log(`RETRY ${step.id.padEnd(11)} invalidated by a downstream rework`);
    forceRerun.delete(step.id);
  }

  const tpl = BINDINGS[step.id];
  if (!tpl) {
    console.log(`STOP  ${step.id.padEnd(11)} no runner bound -- an unbound role is a step that never started`);
    stopped = step.id;
    break;
  }

  const cmd = fill(tpl);
  console.log(`RUN   ${step.id.padEnd(11)} ${cmd.slice(0, 80)}`);
  const proc = spawnSync(cmd, { cwd: root, shell: true, encoding: 'utf8', timeout: 25 * 60 * 1000 });
  if (proc.stdout?.trim()) console.log(`      ${proc.stdout.trim().split('\n').slice(-1)[0]}`);

  const after = evaluateProcess(appDir).find((r) => r.step === step.id);
  if (after?.status === 'DONE') {
    console.log(`OK    ${step.id.padEnd(11)} contract satisfied`);
    cursor += 1;
    continue;
  }

  console.log(`FAIL  ${step.id.padEnd(11)} exit ${proc.status}`);
  for (const reason of after?.reasons ?? []) console.log(`        - ${reason}`);

  // FORCE THE REDO. A step that declares reworkTo routes BACK to an earlier step
  // and the build re-runs from there, rather than halting. Verification without
  // a redo path just stops the line; the point is to make the work happen again.
  // --continue: record the failure and carry on to the next step instead of
  // halting. Useful for a full survey of what a build would hit; NOT the default,
  // because a build that walks past a failed contract and still reports progress
  // is how "done" stops meaning anything. Failures are collected and reprinted
  // at the end so continuing never hides them.
  if (args.continue) {
    failures.push({ step: step.id, reasons: after?.reasons ?? [] });
    cursor += 1;
    continue;
  }

  if (!step.reworkTo) {
    stopped = step.id;
    break;
  }
  const used = (cycles.get(step.id) ?? 0) + 1;
  cycles.set(step.id, used);
  if (used > (step.maxCycles ?? 3)) {
    console.log(`ABORT ${step.id.padEnd(11)} reworked ${used - 1}x without satisfying its contract`);
    stopped = step.id;
    break;
  }
  const target = allSteps.findIndex((x) => x.id === step.reworkTo);
  console.log(`REDO  ${step.id.padEnd(11)} cycle ${used}/${step.maxCycles ?? 3} -> re-entering at ${step.reworkTo}`);

  // INVALIDATE the rework target, or the redo is theatre. The first run of this
  // loop routed visual back to build three times; build was "already satisfied"
  // each time, so it SKIPPED, control returned to visual, and it failed
  // identically. Three cycles that changed nothing, then an abort -- a loop that
  // executes perfectly and cannot possibly fix anything.
  //
  // Re-entering a step means re-RUNNING it. Contract satisfaction from a previous
  // attempt is exactly what must be set aside when a downstream step has rejected
  // the result.
  for (let i = target; i >= 0 && i < allSteps.length && i <= cursor; i += 1) {
    forceRerun.add(allSteps[i].id);
  }
  cursor = target >= 0 ? target : cursor + 1;
}

const results = evaluateProcess(appDir);
const done = results.filter((r) => r.status === 'DONE').length;
console.log(`\n${done}/${results.length} steps DONE${stopped ? `, stopped at ${stopped}` : ''}`);
if (failures.length) {
  console.log(`\n${failures.length} step(s) failed and were carried past with --continue:`);
  for (const f of failures) console.log(`  ${f.step}: ${(f.reasons[0] ?? '').slice(0, 110)}`);
}
process.exit(stopped ? 1 : 0);
