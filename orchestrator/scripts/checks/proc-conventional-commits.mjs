#!/usr/bin/env node
/**
 * proc-conventional-commits — recent commit subjects must follow Conventional Commits.
 *
 * Usage (CLI): node proc-conventional-commits.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = not applicable (no git context).
 *
 * Prefer importing {@link runProcConventionalCommits} and wiring it from check.mjs.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** How many recent commits to inspect. */
const RECENT_COMMIT_WINDOW = 20;

/** NUL field separator for git log records (code point so no transform mangles it). */
const NUL = String.fromCharCode(0);

/** Line feed (code point so no heredoc or transform mangles it). */
const EOL = String.fromCharCode(10);

/**
 * Conventional Commits subject: type(scope)?: description
 * Types: feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert
 * Subject after `: ` must be non-empty.
 */
const CONVENTIONAL_SUBJECT_RE =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?!?: .+/;

/**
 * True when this file was invoked directly as the Node entrypoint.
 * @returns {boolean}
 */
function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

/**
 * Read recent commit subjects and parent hashes from a git repo at `appDir`.
 * Returns null when git is unavailable, the directory is not a repo, or there
 * are no commits — that is "no git context", not a rule violation.
 *
 * @param {string} appDir Directory to run git in (the app/repo under check).
 * @returns {{ hash: string, subject: string, parentCount: number }[] | null}
 */
function readRecentCommits(appDir) {
  let out;
  try {
    // %H hash, %s subject (first line only), %P parent hashes (space-separated).
    // %x00 is git's hex escape for NUL so multi-field records stay parseable.
    out = execFileSync(
      'git',
      [
        'log',
        '-n',
        String(RECENT_COMMIT_WINDOW),
        `--format=%H%x00%s%x00%P`
      ],
      {
        cwd: appDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }
    );
  } catch {
    return null;
  }

  const trimmed = out.trim();
  if (!trimmed) return null;

  /** @type {{ hash: string, subject: string, parentCount: number }[]} */
  const commits = [];
  for (const line of trimmed.split(EOL)) {
    if (!line) continue;
    const parts = line.split(NUL);
    if (parts.length < 3) continue;
    const hash = parts[0];
    const subject = parts[1];
    const parents = parts[2];
    const parentCount = parents
      .split(' ')
      .map((p) => p.trim())
      .filter(Boolean).length;
    commits.push({ hash, subject, parentCount });
  }

  if (commits.length === 0) return null;
  return commits;
}

/**
 * Whether a commit is a merge (exempt from conventional-subject rules).
 * @param {{ subject: string, parentCount: number }} commit
 * @returns {boolean}
 */
function isMergeCommit(commit) {
  if (commit.parentCount > 1) return true;
  if (commit.subject.startsWith('Merge ')) return true;
  return false;
}

/**
 * Run the proc-conventional-commits check.
 * @param {string} appDir
 * @param {{ pass: () => never, fail: (msg?: string) => never, notApplicable: (why?: string) => never, EOL: string }} io
 */
export function runProcConventionalCommits(appDir, io) {
  const commits = readRecentCommits(appDir);
  if (commits === null) {
    io.notApplicable('no git context');
  }

  for (const commit of commits) {
    if (isMergeCommit(commit)) continue;
    if (!CONVENTIONAL_SUBJECT_RE.test(commit.subject)) {
      io.fail(`non-conventional commit subject: "${commit.subject}"`);
    }
  }

  io.pass();
}

if (isMainModule()) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node proc-conventional-commits.mjs <appDir>');
    process.exit(2);
  }
  runProcConventionalCommits(dir, {
    pass: () => process.exit(0),
    fail: (m) => {
      if (m) console.error(m);
      process.exit(1);
    },
    notApplicable: (w) => {
      if (w) console.error(`n/a: ${w}`);
      process.exit(3);
    },
    EOL
  });
}
