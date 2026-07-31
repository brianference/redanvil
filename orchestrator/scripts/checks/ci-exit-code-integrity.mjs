#!/usr/bin/env node
/**
 * ci-exit-code-integrity — a verification command must not end in a pipe.
 *
 * Usage: node ci-exit-code-integrity.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = not applicable (no workflows).
 *
 * `cmd | tail -5` exits with tail's status, not cmd's. tail almost always
 * succeeds, so the pipeline reports success no matter what happened upstream.
 *
 * This is not hypothetical and it is not rare. In one session it hid two
 * separate things: a full Playwright run that reported "exit 0" while one test
 * had failed, and a `git merge` that printed MERGE=0 while actually aborting on
 * untracked files. Both were read as green. The second was caught only because
 * the merge visibly had not happened; the first was caught only by reading the
 * output text rather than trusting the code.
 *
 * The danger is specific to VERIFICATION. Piping to `grep` to find something is
 * fine. Piping the command whose exit code decides whether CI passes is not,
 * because the pipeline silently substitutes a different program's opinion.
 *
 * Bash offers `set -o pipefail`, so a `run:` block that sets it is exempt --
 * that is the fix, not an evasion.
 */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Commands whose exit code is normally load-bearing in CI. */
const VERIFIERS =
  /\b(npm|npx|node|pnpm|yarn|tsc|eslint|vitest|jest|playwright|pytest|mypy|ruff|cargo|go|git)\b/;

/** Trailing pipe into a filter, which replaces the exit code with the filter's. */
const ENDS_IN_PIPE = /\|\s*(tail|head|grep|sed|awk|cut|sort|uniq|tee|jq|wc)\b[^|]*$/;

/**
 * Workflow files for an app, falling back to the enclosing repository.
 *
 * A generated app in a monorepo has no workflows of its own; the repo's are
 * what build and verify it.
 *
 * @param {string} appDir - App directory.
 * @returns {string[]} Absolute-ish workflow paths.
 */
function workflowFiles(appDir) {
  const tracked = (dir) => {
    try {
      return execFileSync('git', ['ls-files', '-z'], {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      })
        .split(String.fromCharCode(0))
        .filter(Boolean);
    } catch {
      return [];
    }
  };
  const isWorkflow = (f) => /\.github[/\\]workflows[/\\].+\.ya?ml$/.test(f);
  const own = tracked(appDir).filter(isWorkflow);
  if (own.length > 0) return own.map((f) => join(appDir, f));
  let root = '';
  try {
    root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: appDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return [];
  }
  if (root === '') return [];
  return tracked(root)
    .filter(isWorkflow)
    .map((f) => join(root, f));
}

/**
 * Find verification commands whose exit code is replaced by a filter's.
 *
 * @param {string} yaml - Workflow file contents.
 * @returns {{line: number, text: string}[]} Offending lines.
 */
export function pipedVerifiers(yaml) {
  const lines = yaml.split('\n');
  const offenders = [];
  // `set -o pipefail` anywhere in the file means the author has addressed this
  // deliberately; a pipeline then reports the first non-zero status.
  if (/set\s+-o\s+pipefail|shell:\s*bash/.test(yaml)) return offenders;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? '';
    const text = raw.trim();
    if (text.startsWith('#')) continue;
    if (!VERIFIERS.test(text)) continue;
    if (!ENDS_IN_PIPE.test(text)) continue;
    offenders.push({ line: i + 1, text: text.slice(0, 120) });
  }
  return offenders;
}

/**
 * Decide ci-exit-code-integrity for one app.
 *
 * @param {string} appDir - App directory.
 * @param {{pass: Function, fail: Function, notApplicable: Function}} io - Outcome callbacks.
 * @returns {void}
 */
export function runExitCodeIntegrity(appDir, io) {
  const { pass, fail, notApplicable } = io;
  const files = workflowFiles(appDir);
  if (files.length === 0) return notApplicable('no workflow files to inspect');

  const hits = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    let yaml = '';
    try {
      yaml = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const o of pipedVerifiers(yaml)) hits.push(`${file}:${o.line}: ${o.text}`);
  }

  if (hits.length > 0) {
    return fail(
      `${hits.length} verification command(s) whose exit code is replaced by a filter:\n` +
        hits.map((h) => `  ${h}`).join('\n') +
        '\n\n`cmd | tail` exits with tail’s status. tail almost always succeeds, ' +
        'so the step reports success whatever happened upstream. Add ' +
        '`set -o pipefail` (with `shell: bash`), redirect to a file and read it ' +
        'afterwards, or drop the pipe.'
    );
  }
  return pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node ci-exit-code-integrity.mjs <appDir>');
    process.exit(2);
  }
  runExitCodeIntegrity(dir, {
    pass: () => process.exit(0),
    fail: (m) => {
      if (m) console.error(m);
      process.exit(1);
    },
    notApplicable: (w) => {
      if (w) console.error(`n/a: ${w}`);
      process.exit(3);
    }
  });
}
