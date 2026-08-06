#!/usr/bin/env node
/**
 * Point git at `.githooks` so pre-commit, commit-msg, and pre-push run without a
 * manual `git config` step. Wired as the root package.json `prepare` script so
 * a plain `npm install` arms team enforcement + the finish-line refusal.
 *
 * hooksPath is always `.githooks` (never silently redirected). The team logic
 * lives under orchestrator/scripts/team/hooks/; the shell wrappers in .githooks
 * invoke it.
 *
 * Idempotent: re-running is safe.
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const hooksPath = '.githooks';
const requiredHooks = ['pre-commit', 'commit-msg', 'pre-push'];

/**
 * Install core.hooksPath for this repository.
 * @returns {void}
 */
function install() {
  if (!existsSync(join(repoRoot, hooksPath))) {
    console.error(`install-hooks: ${hooksPath}/ is missing — cannot arm hooks`);
    process.exit(1);
  }

  for (const name of requiredHooks) {
    const p = join(repoRoot, hooksPath, name);
    if (!existsSync(p)) {
      console.error(`install-hooks: missing ${hooksPath}/${name}`);
      process.exit(1);
    }
  }

  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch {
    // Not a git checkout (e.g. npm pack consumer) — skip quietly.
    console.log('install-hooks: not a git work tree; skipped');
    return;
  }

  execFileSync('git', ['config', 'core.hooksPath', hooksPath], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // POSIX executable bit so Git Bash / Linux / macOS will run the hooks.
  if (process.platform !== 'win32') {
    for (const name of requiredHooks) {
      const p = join(repoRoot, hooksPath, name);
      try {
        chmodSync(p, 0o755);
      } catch {
        // Non-fatal on exotic filesystems.
      }
    }
  }

  console.log(
    `install-hooks: core.hooksPath=${hooksPath} (${requiredHooks.join(', ')})`
  );
}

install();
