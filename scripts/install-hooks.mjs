#!/usr/bin/env node
/**
 * Point git at `.githooks` so pre-push (and any future hooks) run without a
 * manual `git config` step. Wired as the root package.json `prepare` script so
 * a plain `npm install` arms the finish-line refusal.
 *
 * Idempotent: re-running is safe.
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const hooksPath = '.githooks';
const prePush = join(repoRoot, hooksPath, 'pre-push');

/**
 * Install core.hooksPath for this repository.
 * @returns {void}
 */
function install() {
  if (!existsSync(join(repoRoot, hooksPath))) {
    console.error(`install-hooks: ${hooksPath}/ is missing — cannot arm pre-push`);
    process.exit(1);
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

  // POSIX executable bit so Git Bash / Linux / macOS will run the hook.
  if (existsSync(prePush) && process.platform !== 'win32') {
    try {
      chmodSync(prePush, 0o755);
    } catch {
      // Non-fatal on exotic filesystems.
    }
  }

  console.log(`install-hooks: core.hooksPath=${hooksPath}`);
}

install();
