/**
 * Newest commit that touches app source (not gate-output / evidence paths).
 *
 * Shared by meets_the_bar (results freshness), reverify-style visual stamps,
 * and independent judge-diff (F5) so every path uses ONE notion of "source moved".
 *
 * Evidence-only commits after a review must not age the review out; a real
 * source edit under the app must.
 */
import { execFileSync } from 'node:child_process';
import { relative, resolve } from 'node:path';

/**
 * Run git; return trimmed stdout or null on failure.
 *
 * @param {string} cwd Working directory.
 * @param {string[]} args Git args after `git`.
 * @returns {string | null}
 */
function gitOut(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Git toplevel for a path inside a work tree, or null.
 *
 * @param {string} dir Directory inside a repo.
 * @returns {string | null}
 */
export function gitRoot(dir) {
  return gitOut(dir, ['rev-parse', '--show-toplevel']);
}

/**
 * Newest commit that touches app source (not gate-output paths under the app).
 *
 * @param {string} repoRoot Repository root.
 * @param {string} appDir App directory relative to repo root (posix or native).
 * @returns {string | null}
 */
export function newestSourceCommit(repoRoot, appDir) {
  // Gate outputs under the app (coverage-state, local evidence) must not count
  // as "source moved" or every re-measure would look like a source edit.
  const out = gitOut(repoRoot, [
    'log',
    '-1',
    '--format=%H',
    '--',
    appDir,
    `:(exclude)${appDir}/.redanvil/coverage-state.json`,
    `:(exclude)${appDir}/evidence`,
    `:(exclude)${appDir}/results`,
    `:(exclude)${appDir}/dist`,
    `:(exclude)${appDir}/coverage`,
    `:(exclude)${appDir}/test-results`,
    `:(exclude)${appDir}/node_modules`
  ]);
  return out && out.length > 0 ? out : null;
}

/**
 * Newest source commit for an absolute app directory, or null.
 *
 * @param {string} appDirAbs Absolute path to the app root.
 * @returns {string | null}
 */
export function newestSourceCommitForAppDir(appDirAbs) {
  const root = gitRoot(appDirAbs);
  if (root === null) return null;
  const rel = relative(root, resolve(appDirAbs)).replace(/\\/g, '/');
  if (rel.length === 0 || rel === '.') {
    // App is the repo root — still apply evidence/results excludes via '.' paths.
    return newestSourceCommit(root, '.');
  }
  if (rel.startsWith('..')) return null;
  return newestSourceCommit(root, rel);
}

/**
 * Commit a judge-diff / F5 report should be pinned to for this app.
 *
 * Prefers the newest source commit; falls back to HEAD when the app has no
 * committed source history yet (so brand-new fixtures still pin to something).
 *
 * @param {string} appDirAbs Absolute app directory.
 * @returns {string | null}
 */
export function reviewPinCommit(appDirAbs) {
  const source = newestSourceCommitForAppDir(appDirAbs);
  if (source !== null && source.length > 0) return source;
  return gitOut(appDirAbs, ['rev-parse', 'HEAD']);
}
