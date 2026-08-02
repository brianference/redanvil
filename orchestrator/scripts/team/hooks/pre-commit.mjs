#!/usr/bin/env node
/**
 * Worktree pre-commit: refuse when gate is red, artifacts missing, or
 * unimplementedRows is non-empty. Reads .redanvil/assignment.json -- not the agent.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const worktreeDir = process.cwd();

/**
 * Resolve the enforcement module (built as TS next to src, loaded via tsx path
 * or the compiled-adjacent evaluate entry).
 *
 * @returns Absolute path to evaluate-pre-commit entry.
 */
function entryPath() {
  // Prefer the small pure-mjs mirror so hooks run without tsx in the worktree.
  const local = join(dirname(fileURLToPath(import.meta.url)), 'lib-enforcement.mjs');
  return local;
}

const lib = entryPath();
if (!existsSync(lib)) {
  console.error('pre-commit: missing lib-enforcement.mjs');
  process.exit(1);
}

const { evaluatePreCommit } = await import(pathToFileURL(lib).href);

/** Best-effort unimplementedRows from the main repo when present. */
function loadUnimplemented() {
  try {
    // Walk up for orchestrator coverage; failure is fail-closed only when we
    // can load it -- absence of the binder is not a free pass if assignment is
    // the primary gate.
    const r = spawnSync(
      process.execPath,
      [
        '-e',
        `import('${pathToFileURL(join(worktreeDir, 'orchestrator/src/done/coverage.mjs')).href}')
          .then(m => { console.log(JSON.stringify(m.unimplementedRows())); })
          .catch(() => console.log('[]'))`
      ],
      { encoding: 'utf8', cwd: worktreeDir }
    );
    if (r.status === 0 && r.stdout.trim()) {
      return JSON.parse(r.stdout.trim());
    }
  } catch {
    // ignore
  }
  return [];
}

const result = evaluatePreCommit(worktreeDir, {
  unimplementedRows: () => loadUnimplemented()
});

if (!result.ok) {
  console.error('pre-commit: REFUSED');
  for (const r of result.reasons) console.error(`  - ${r}`);
  process.exit(1);
}

process.exit(0);
