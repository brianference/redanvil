#!/usr/bin/env node
/**
 * Prove the product's core promise: a freshly scaffolded app clears its own gate.
 *
 * Third-audit finding #5. The scaffold was covered by unit tests, a local probe
 * and the pipeline simulation's check.mjs sweep — but no CI job ever took a
 * generated app through the REAL gate. "Generated apps ship behind a quality
 * gate" was the one claim the gate itself never demonstrated.
 *
 * Scaffolds into a temp dir, installs, and runs every deterministic rule the
 * gate would run. Visual and judge rules need a rendered review and a human, so
 * they are waived here explicitly and the waiver is printed — the point is that
 * the machine-decidable floor is real, not that a scaffold is a finished app.
 *
 * Usage: node gate_scaffold.mjs [--keep]
 * Exit 0 when every applicable deterministic rule passes.
 */
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const KEEP = process.argv.includes('--keep');
const root = mkdtempSync(join(tmpdir(), 'redanvil-scaffold-gate-'));
const appDir = join(root, 'app');

/** Run a command, returning its exit code and combined output. */
function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

let failed = 0;
try {
  // 1. Scaffold a real job through the real command.
  const job = {
    kind: 'job',
    slug: 'scaffold-gate-probe',
    prompt: 'a probe app used by CI to prove a generated app clears its own gate',
    targetType: 'fullstack-web',
    threshold: 90,
    answers: {},
    createdAt: '2026-07-25T00:00:00.000Z',
    entities: [{ name: 'Item', fields: [{ name: 'title', type: 'text' }] }]
  };
  const jobPath = join(root, 'job.json');
  writeFileSync(jobPath, `${JSON.stringify(job, null, 2)}\n`);

  const scaffold = run(
    'npx',
    ['tsx', join(REPO, 'orchestrator/src/cli.ts'), 'scaffold', jobPath, appDir],
    REPO
  );
  if (scaffold.code !== 0 || !existsSync(join(appDir, 'package.json'))) {
    console.error('scaffold gate FAIL: scaffolding did not produce an app');
    console.error(scaffold.out.split('\n').slice(-8).join('\n'));
    process.exit(1);
  }
  console.log(`scaffolded into ${appDir}`);

  // 2. Install its declared dependencies — the gate runs tsc/eslint/vitest.
  const install = run('npm', ['install', '--no-audit', '--no-fund'], appDir);
  if (install.code !== 0) {
    console.error('scaffold gate FAIL: npm install failed in the generated app');
    console.error(install.out.split('\n').slice(-10).join('\n'));
    process.exit(1);
  }

  // 3. The tool-backed checks the gate runs, exactly as it runs them.
  const TOOLS = [
    ['u-typing-strict', 'npx', ['tsc', '--noEmit']],
    ['u-typing-no-any', 'npx', ['eslint', '.', '--max-warnings', '0']],
    ['u-test-presence', 'npx', ['vitest', 'run']],
    ['build', 'npm', ['run', 'build']]
  ];
  for (const [rule, cmd, args] of TOOLS) {
    const r = run(cmd, args, appDir);
    const ok = r.code === 0;
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${rule}`);
    if (!ok)
      console.log(
        r.out
          .split('\n')
          .slice(-8)
          .map((l) => `        ${l}`)
          .join('\n')
      );
  }

  // 4. Every static rule check.mjs implements.
  const CHECK = join(REPO, 'orchestrator/scripts/checks/check.mjs');
  const source = readFileSync(CHECK, 'utf8');
  const ruleIds = [...new Set([...source.matchAll(/case '([^']+)':/g)].map((m) => m[1]))];
  // A rule list that silently comes back empty would make this whole check
  // vacuous while still printing PASS. Refuse rather than pretend.
  if (ruleIds.length < 10) {
    console.error(
      `scaffold gate FAIL: only ${ruleIds.length} rule(s) found in check.mjs — extraction is broken`
    );
    process.exit(2);
  }
  let na = 0;
  /** Rules that reported "no subject here", named rather than only counted. */
  const naRules = [];
  for (const rule of ruleIds) {
    const r = run('node', [CHECK, rule, appDir], REPO);
    if (r.code === 3) {
      na += 1;
      naRules.push(rule);
      continue;
    }
    const ok = r.code === 0;
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${rule}`);
    if (!ok) console.log(`        ${r.out.trim().split('\n')[0]}`);
  }
  console.log(`\n${ruleIds.length} static rule(s) run, ${na} not applicable to a fresh scaffold`);
  if (naRules.length > 0) {
    // Named, not just counted. An n/a rule is invisible by construction -- it
    // leaves the denominator and prints nothing -- so a rule that quietly stops
    // applying looks identical to one that never could. Most n/a verdicts turn
    // out to be a too-narrow scope or a missing tool rather than an absent
    // subject, and you cannot re-check a list you cannot see.
    console.log(`not applicable: ${naRules.join(', ')}`);
  }
  console.log('visual and judge rules are NOT covered here: they need a rendered review.');
} finally {
  if (!KEEP) rmSync(root, { recursive: true, force: true });
}

if (failed > 0) {
  console.error(`\nscaffold gate FAIL: ${failed} check(s) failed on a freshly generated app`);
  process.exit(1);
}
console.log('\nscaffold gate PASS: a freshly generated app clears every deterministic rule');
