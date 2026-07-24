#!/usr/bin/env node
/**
 * Structural GitHub Actions workflow lint (ci-actionlint).
 *
 * Does NOT shell out to the real `actionlint` binary — missing tools must not
 * silently pass. Implements the same static checks as the CI-lane blockers
 * (SHA pin, least-privilege permissions, no run-script injection) plus a
 * minimal workflow structure gate.
 *
 * Usage: node ci-actionlint.mjs <appDir>
 * Exit 0 = pass, 1 = violation, 2 = usage/infra, 3 = not applicable.
 *
 * @module
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** NUL separator for `git ls-files -z`. */
const NUL = String.fromCharCode(0);
/** Line-feed, built from a code point so no text transform can mangle it. */
const EOL = String.fromCharCode(10);

/** Repo-relative workflow path under `.github/workflows/`. */
const WORKFLOW_PATH_RE = /\.github[\/]workflows[\/].+\.ya?ml$/;
/** 40-character lowercase hex SHA (GitHub Actions pin form). */
const SHA40_RE = /^[0-9a-f]{40}$/;
/** `uses: owner/name@ref` on a single line. */
const USES_RE = /uses:\s*([^@\s]+)@(\S+)/;
/** Top-level or indented `on:` / `jobs:` key (valid-enough workflow shape). */
const WORKFLOW_KEY_RE = /^\s*(on|jobs)\s*:/m;
/** Top-level `permissions:` block (must appear at column 0). */
const TOP_LEVEL_PERMISSIONS_RE = /^permissions:/m;
/** Forbidden broad write grant. */
const WRITE_ALL_RE = /permissions:\s*write-all/;
/** Checkout action reference (any pin form). */
const CHECKOUT_USES_RE = /uses:\s*actions\/checkout/;
/** Required on checkout to avoid credential leakage into later steps. */
const PERSIST_CREDS_FALSE_RE = /persist-credentials:\s*false/;
/** Dangerous PR-target + checkout pairing. */
const PULL_REQUEST_TARGET_RE = /pull_request_target/;
/** Hex length required for a full-commit pin. */
const SHA_HEX_LENGTH = 40;

/**
 * Files tracked by git under `dir` (repo-relative paths).
 * Empty when not a git repo or git fails — caller decides N/A vs disk fallback.
 * @param {string} dir
 * @returns {string[]}
 */
function trackedFiles(dir) {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return out.split(NUL).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Whether `dir` is inside a git work tree.
 * @param {string} dir
 * @returns {boolean}
 */
function isGitRepo(dir) {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Scan `.github/workflows` on disk for `*.yml` / `*.yaml` (non-git fixtures).
 * @param {string} appDir
 * @returns {string[]} Repo-relative paths.
 */
function scanWorkflowsOnDisk(appDir) {
  const wfDir = join(appDir, '.github', 'workflows');
  if (!existsSync(wfDir)) return [];
  let names;
  try {
    names = readdirSync(wfDir);
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    if (/\.ya?ml$/i.test(name)) {
      out.push(join('.github', 'workflows', name).replace(/\\/g, '/'));
    }
  }
  return out;
}

/**
 * List workflow files: prefer git-tracked; disk fallback only outside a git repo.
 * @param {string} appDir
 * @returns {string[]}
 */
function listWorkflowFiles(appDir) {
  if (isGitRepo(appDir)) {
    return trackedFiles(appDir).filter((f) => WORKFLOW_PATH_RE.test(f));
  }
  return scanWorkflowsOnDisk(appDir);
}

/**
 * Read a workflow file; empty string on I/O failure.
 * @param {string} appDir
 * @param {string} relPath
 * @returns {string}
 */
function readWorkflow(appDir, relPath) {
  try {
    return readFileSync(join(appDir, relPath), 'utf8');
  } catch {
    return '';
  }
}

/**
 * Build the untrusted-interpolation regex for a given EOL character.
 * Matches `run:` lines that embed attacker-controlled github context.
 * @param {string} eol
 * @returns {RegExp}
 */
function untrustedRunInjectRe(eol) {
  return new RegExp(
    'run:[^' +
      eol +
      ']*\\$\\{\\{\\s*(github\\.event\\.(issue|pull_request|comment)|github\\.head_ref)'
  );
}

/**
 * Collect structural / security violations for one workflow file.
 * @param {string} relPath
 * @param {string} content
 * @param {string} eol
 * @returns {string[]}
 */
function lintWorkflow(relPath, content, eol) {
  /** @type {string[]} */
  const issues = [];
  const trimmed = content.trim();

  if (!trimmed) {
    issues.push(`${relPath}: empty workflow file`);
    return issues;
  }

  if (!WORKFLOW_KEY_RE.test(content)) {
    issues.push(`${relPath}: missing workflow structure (need on: or jobs:)`);
  }

  // SHA-pin every uses: owner/name@ref (tags and branches are not pins).
  for (const line of content.split(eol)) {
    const m = USES_RE.exec(line);
    if (!m) continue;
    const action = m[1];
    const ref = m[2];
    // Local composite actions (./path) without @ never match USES_RE.
    // Require a full-commit SHA for every uses that names a ref.
    if (!SHA40_RE.test(ref)) {
      issues.push(
        `${relPath}: unpinned action (not a ${SHA_HEX_LENGTH}-hex SHA): ${action}@${ref}`
      );
    }
  }

  // Least-privilege permissions.
  if (!TOP_LEVEL_PERMISSIONS_RE.test(content)) {
    issues.push(`${relPath}: no top-level permissions block`);
  }
  if (WRITE_ALL_RE.test(content)) {
    issues.push(`${relPath}: permissions: write-all is not least-privilege`);
  }
  if (CHECKOUT_USES_RE.test(content) && !PERSIST_CREDS_FALSE_RE.test(content)) {
    issues.push(`${relPath}: checkout without persist-credentials: false`);
  }

  // Injection surfaces.
  if (PULL_REQUEST_TARGET_RE.test(content) && CHECKOUT_USES_RE.test(content)) {
    issues.push(`${relPath}: pull_request_target with a checkout is an injection surface`);
  }
  if (untrustedRunInjectRe(eol).test(content)) {
    issues.push(`${relPath}: untrusted \${{ }} interpolated into a run script`);
  }

  return issues;
}

/**
 * Run the ci-actionlint check against an app directory.
 *
 * @param {string} appDir Absolute or relative path to the app root.
 * @param {{
 *   pass: () => never,
 *   fail: (msg?: string) => never,
 *   notApplicable: (why?: string) => never,
 *   EOL?: string
 * }} io Outcome callbacks (and optional EOL override for tests).
 * @returns {never}
 */
export function runCiActionlint(appDir, io) {
  const lineEnd = io.EOL ?? EOL;
  const workflows = listWorkflowFiles(appDir);

  if (workflows.length === 0) {
    return io.notApplicable('no workflow files');
  }

  /** @type {string[]} */
  const violations = [];
  for (const rel of workflows) {
    const body = readWorkflow(appDir, rel);
    if (body === '' && !existsSync(join(appDir, rel))) {
      violations.push(`${rel}: cannot read workflow file`);
      continue;
    }
    violations.push(...lintWorkflow(rel, body, lineEnd));
  }

  if (violations.length > 0) {
    return io.fail(violations.join(lineEnd));
  }
  return io.pass();
}

/**
 * CLI entry when invoked as `node ci-actionlint.mjs <appDir>`.
 * @returns {void}
 */
function main() {
  const appDir = process.argv[2];
  if (!appDir) {
    console.error('usage: node ci-actionlint.mjs <appDir>');
    process.exit(2);
  }
  if (!existsSync(appDir)) {
    console.error(`infra: no such directory: ${appDir}`);
    process.exit(2);
  }

  runCiActionlint(appDir, {
    pass: () => process.exit(0),
    fail: (msg) => {
      if (msg) console.error(msg);
      process.exit(1);
    },
    notApplicable: (why) => {
      if (why) console.error(`n/a: ${why}`);
      process.exit(3);
    },
    EOL
  });
}

const thisFile = fileURLToPath(import.meta.url);
const invokedAs = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedAs && resolve(thisFile) === invokedAs) {
  main();
}
