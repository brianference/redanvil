#!/usr/bin/env node
/**
 * Run one RedAnvil role as a compartmentalised task and emit a machine-readable
 * verdict on stdout.
 *
 * The whole point of this file: n8n can tell you a step exited 0, and it can
 * retry it, but it cannot tell you the step did any work. "The artifact exists"
 * is not "the role produced it" -- a file already on disk from a previous run
 * satisfies an existence check forever. So the verdict here is the same
 * `countedAsRun` rule the orchestrator already uses:
 *
 *     countedAsRun = exit 0 AND the declared artifacts actually changed
 *
 * plus a substance floor, because a role that writes a zero-byte placeholder
 * changes the artifact without producing anything.
 *
 * Exit code is 0 only when countedAsRun is true, so an n8n node goes red on a
 * no-op role instead of green.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

/** Minimum bytes for an artifact to count as substance rather than a placeholder. */
const SUBSTANCE_FLOOR_BYTES = 512;

/**
 * Parse `--key=value` arguments into a plain object.
 * @param {string[]} argv raw process arguments
 * @returns {Record<string, string>} parsed flags
 */
function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const a of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/**
 * List every file under a directory, recursively, as absolute paths.
 * @param {string} dir directory to walk
 * @returns {Promise<string[]>} absolute file paths, empty when dir is absent
 */
async function walk(dir) {
  if (!existsSync(dir)) return [];
  /** @type {string[]} */
  const found = [];
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  for (const e of entries) {
    if (e.isFile()) found.push(join(e.parentPath ?? e.path, e.name));
  }
  return found;
}

/**
 * Fingerprint a directory: path -> sha256 of contents.
 *
 * Content hashing rather than mtime: a role that rewrites a file with identical
 * bytes has not produced anything new, and mtime would call that a change.
 * @param {string} dir directory to fingerprint
 * @returns {Promise<Map<string, string>>} relative path to content digest
 */
async function fingerprint(dir) {
  const files = await walk(dir);
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const f of files) {
    const digest = createHash('sha256').update(readFileSync(f)).digest('hex');
    map.set(relative(dir, f).split('\\').join('/'), digest);
  }
  return map;
}

/**
 * Compare two fingerprints and describe what the role actually produced.
 * @param {Map<string, string>} before pre-run fingerprint
 * @param {Map<string, string>} after post-run fingerprint
 * @returns {{added: string[], modified: string[], changedCount: number}} diff summary
 */
function diffFingerprints(before, after) {
  /** @type {string[]} */
  const added = [];
  /** @type {string[]} */
  const modified = [];
  for (const [path, digest] of after) {
    if (!before.has(path)) added.push(path);
    else if (before.get(path) !== digest) modified.push(path);
  }
  return { added, modified, changedCount: added.length + modified.length };
}

/**
 * Check that changed artifacts carry real content, not a placeholder byte count.
 * @param {string} dir artifact root
 * @param {string[]} paths relative paths that changed
 * @returns {string[]} paths that fell under the substance floor
 */
function thinArtifacts(dir, paths) {
  return paths.filter((p) => {
    const full = join(dir, p);
    return existsSync(full) && statSync(full).size < SUBSTANCE_FLOOR_BYTES;
  });
}

/**
 * Resolve the current git commit, used to bind the verdict to a source state.
 * @param {string} repoRoot repository root
 * @returns {string|null} commit sha, or null outside a repo
 */
function headCommit(repoRoot) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/**
 * Execute one role and return a verdict object.
 * @param {{role: string, cmd: string, artifacts: string, repoRoot: string}} opts role config
 * @returns {Promise<object>} the verdict, shaped for n8n to branch on
 */
async function runRole(opts) {
  const artifactDir = resolve(opts.repoRoot, opts.artifacts);
  const before = await fingerprint(artifactDir);
  const startedAt = new Date().toISOString();

  const proc = spawnSync(opts.cmd, {
    cwd: opts.repoRoot,
    shell: true,
    encoding: 'utf8',
    timeout: 20 * 60 * 1000
  });

  const after = await fingerprint(artifactDir);
  const delta = diffFingerprints(before, after);
  const thin = thinArtifacts(artifactDir, [...delta.added, ...delta.modified]);

  const exitOk = proc.status === 0;
  const producedWork = delta.changedCount > 0;
  const substantive = thin.length === 0;
  const countedAsRun = exitOk && producedWork && substantive;

  /** Reasons are the evidence trail; an empty list means nothing objected. */
  const reasons = [];
  if (!exitOk) reasons.push(`role command exited ${proc.status ?? 'null'}`);
  if (!producedWork) reasons.push(`no artifact under ${opts.artifacts} changed -- role did nothing`);
  if (!substantive) reasons.push(`placeholder artifacts under ${SUBSTANCE_FLOOR_BYTES}B: ${thin.join(', ')}`);

  return {
    role: opts.role,
    countedAsRun,
    startedAt,
    finishedAt: new Date().toISOString(),
    commit: headCommit(opts.repoRoot),
    exitCode: proc.status,
    artifactDir: opts.artifacts,
    added: delta.added,
    modified: delta.modified,
    changedCount: delta.changedCount,
    reasons,
    stderrTail: (proc.stderr ?? '').split('\n').slice(-5).join('\n').trim()
  };
}

const args = parseArgs(process.argv.slice(2));
if (!args.role || !args.cmd || !args.artifacts) {
  process.stderr.write(
    'usage: role-run.mjs --role=X --cmd="..." --artifacts=dir [--repoRoot=.] [--exitZero=1]\n'
  );
  process.exit(2);
}

const verdict = await runRole({
  role: args.role,
  cmd: args.cmd,
  artifacts: args.artifacts,
  repoRoot: resolve(args.repoRoot ?? process.cwd())
});

process.stdout.write(JSON.stringify(verdict, null, 2) + '\n');

// --exitZero exists for n8n specifically. Its Execute Command node discards
// stdout entirely when the command exits non-zero -- ExecuteCommand.node.js
// returns `json: { error: error.message }` on the failure path instead of
// `json: { exitCode, stderr, stdout }`. A refused role would therefore reach
// the workflow as a bare "command failed" with its whole evidence trail
// dropped, which is the opposite of what this runner is for.
//
// So under n8n the process exits 0 and the refusal travels in the verdict,
// where the If node reads `countedAsRun`. The branch is driven by the evidence
// rather than by a process exit code, which is the more honest signal anyway.
// Outside n8n the exit code still carries the verdict, so CI and the shell
// keep working unchanged.
process.exit(args.exitZero ? 0 : verdict.countedAsRun ? 0 : 1);
