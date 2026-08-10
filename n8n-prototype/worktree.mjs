#!/usr/bin/env node
/**
 * Create and remove role worktrees safely, with node_modules available.
 *
 * Two real problems this solves.
 *
 * A fresh worktree has no node_modules, so every role that imports playwright
 * dies with ERR_MODULE_NOT_FOUND. The furniture simulation hit this immediately.
 *
 * And the obvious fix is a trap: `git worktree remove --force` FOLLOWS a
 * node_modules junction and deletes the real one in the main tree. That is
 * recorded in this project's memory and it has happened. So removal must unlink
 * the junction FIRST, and never use --force while it exists.
 *
 * Usage:
 *   node worktree.mjs add <branch> <path>
 *   node worktree.mjs remove <path>
 */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [cmd, a, b] = process.argv.slice(2);
const MAIN = resolve('C:/Users/brian/RedAnvil');

/**
 * Run a command, surfacing its output.
 * @param {string} bin executable
 * @param {string[]} argv arguments
 * @param {string} [cwd] working directory
 */
function run(bin, argv, cwd = MAIN) {
  execFileSync(bin, argv, { cwd, stdio: 'inherit' });
}

if (cmd === 'add') {
  if (!a || !b) {
    process.stderr.write('usage: worktree.mjs add <branch> <path>\n');
    process.exit(2);
  }
  run('git', ['worktree', 'add', '-b', a, b, 'HEAD']);

  // Junction rather than copy: node_modules is gigabytes and a copy per role
  // worktree is unusable. The junction is what makes removal dangerous, which
  // the remove path below handles.
  const link = join(b, 'node_modules');
  if (!existsSync(link)) {
    run('cmd', ['/c', 'mklink', '/J', link, join(MAIN, 'node_modules')], undefined);
  }
  console.log(`worktree ready: ${b}`);
  console.log('  node_modules is a JUNCTION to the main tree — remove with this script, never `git worktree remove --force`');
} else if (cmd === 'remove') {
  if (!a) {
    process.stderr.write('usage: worktree.mjs remove <path>\n');
    process.exit(2);
  }
  // Unlink the junction BEFORE git touches the directory. `git worktree remove
  // --force` walks into it and deletes the main tree's node_modules -- the exact
  // failure this ordering exists to prevent.
  const link = join(a, 'node_modules');
  if (existsSync(link)) {
    try {
      execFileSync('cmd', ['/c', 'rmdir', link], { stdio: 'ignore' });
      console.log('  unlinked the node_modules junction');
    } catch {
      rmSync(link, { recursive: false, force: true });
    }
  }
  if (existsSync(join(a, 'node_modules'))) {
    process.stderr.write('REFUSING to remove: the node_modules junction is still present. Removing now would delete the main tree copy.\n');
    process.exit(1);
  }
  run('git', ['worktree', 'remove', a]);
  console.log(`worktree removed: ${a}`);
} else {
  process.stderr.write('usage: worktree.mjs <add|remove> ...\n');
  process.exit(2);
}
