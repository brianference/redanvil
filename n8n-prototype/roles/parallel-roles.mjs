#!/usr/bin/env node
/**
 * Run several role-run.mjs processes at once and wait for every one.
 *
 * n8n 2.22.6 with executionOrder v1 runs one branch to the end before it
 * starts the next (workflow-execute.js: the loop `shift`s a single stack
 * entry, and v1 `unshift`s children so the walk is depth-first). A Merge
 * fan-out therefore does not overlap the design roles. This process does.
 *
 * Each child is role-run.mjs, so the contract check is the same one the
 * sub-workflow uses. shell is false here; role-run keeps its own shell for
 * the bound command, which is one argv element and is not re-split.
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BINDINGS, fillBinding } from '../bindings.mjs';
import { PROCESS, countedArtifactPath } from '../process-map.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROLE_RUN = join(HERE, '..', 'role-run.mjs');

/**
 * @param {string[]} argv
 * @returns {Record<string, string>}
 */
function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const arg of argv) {
    const match = /^--([^=]+)=([\s\S]*)$/.exec(arg);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

/**
 * Spawn one child and capture its exit. shell is false.
 * @param {string} bin
 * @param {string[]} args
 * @param {string} cwd
 * @returns {Promise<{status: number|null, stdout: string, stderr: string}>}
 */
function spawnCaptured(bin, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    /** @type {Buffer[]} */
    const out = [];
    /** @type {Buffer[]} */
    const err = [];
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.on('error', reject);
    child.on('close', (status) => {
      resolve({
        status,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8')
      });
    });
  });
}

/**
 * Steps this runner is allowed to launch together.
 * @param {string[]} roleIds step ids, in the order the caller asked
 * @param {{slug: string, root: string, prompt?: string, entities?: string}} ctx binding values
 * @returns {{id: string, cmd: string, artifacts: string}[]}
 */
export function jobsFor(roleIds, ctx) {
  const byId = new Map(PROCESS.map((step) => [step.id, step]));
  return roleIds.map((id) => {
    const step = byId.get(id);
    const bound = BINDINGS[id];
    if (!step || !bound) {
      throw new Error(`no bound step ${id}`);
    }
    return {
      id,
      cmd: fillBinding(bound, ctx),
      artifacts: `${ctx.slug}/${countedArtifactPath(step)}`
    };
  });
}

/**
 * Await every job. One failure does not cancel the others: a role ten
 * minutes in should still write its artifact. The returned status is 0
 * only when every child exited 0.
 *
 * @param {{id: string, cmd: string, artifacts: string}[]} jobs
 * @param {string} repoRoot
 * @param {{spawnJob?: typeof spawnCaptured}} [opts]
 * @returns {Promise<{status: number, roles: {id: string, startedAt: string, endedAt: string, status: number|null}[]}>}
 */
export async function runTogether(jobs, repoRoot, opts = {}) {
  const spawnJob = opts.spawnJob ?? spawnCaptured;
  const roles = await Promise.all(
    jobs.map(async (job) => {
      const startedAt = new Date().toISOString();
      const proc = await spawnJob(
        process.execPath,
        [
          ROLE_RUN,
          `--role=${job.id}`,
          `--cmd=${job.cmd}`,
          `--artifacts=${job.artifacts}`,
          `--repoRoot=${repoRoot}`
        ],
        repoRoot
      );
      return {
        id: job.id,
        startedAt,
        endedAt: new Date().toISOString(),
        status: proc.status
      };
    })
  );
  const status = roles.every((role) => role.status === 0) ? 0 : 1;
  return { status, roles };
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const args = parseArgs(process.argv.slice(2));
  const roleIds = (args.roles ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (!roleIds.length || !args.slug || !args.repoRoot) {
    process.stderr.write('usage: parallel-roles.mjs --roles=a,b --slug=X --repoRoot=Y\n');
    process.exit(2);
  }
  try {
    const jobs = jobsFor(roleIds, {
      slug: args.slug,
      root: args.repoRoot,
      prompt: '',
      entities: ''
    });
    const result = await runTogether(jobs, args.repoRoot);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exit(result.status);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  }
}
