#!/usr/bin/env node
/**
 * List (and, with --apply, stop) orphaned executions of the build workflow.
 *
 * An orphan is:
 * - status `waiting` and no pending gate record's resume URL names that
 *   execution id, or
 * - status `running` or `new` and startedAt is older than 24 hours.
 *
 * Default is dry-run: print the orphans, change nothing.
 *
 * How a stop is done on n8n 2.22.6 (tag n8n@2.22.6), read from source:
 * - Public API `POST /api/v1/executions/{id}/stop`
 *   (packages/cli/src/public-api/v1/openapi.yml path /executions/{id}/stop,
 *   operationId stopExecution).
 * - Handler executions.handler.ts `stopExecution` calls ExecutionService.stop.
 * - Auth is header `X-N8N-API-KEY` (openapi securitySchemes.ApiKeyAuth).
 *   This script reads that key from the env var N8N_API_KEY and never prints it.
 * - Listing is `GET /api/v1/executions?status=&workflowId=`
 *   (executions.yml). The status enum includes waiting, running, and new.
 *   Running rows are omitted unless status=running is set, so each status
 *   is queried on its own.
 * - The editor's `POST /rest/executions/:id/stop` (executions.controller.ts)
 *   is the same stop, but it needs a logged-in session. The public API is
 *   what a CLI can call.
 *
 * Host default: start-server.sh sets N8N_LISTEN_ADDRESS=127.0.0.1.
 * Set N8N_BASE_URL or --baseUrl if the instance is not on port 5678.
 *
 * Usage: node sweep-orphans.mjs [--apply] [--baseUrl=http://127.0.0.1:5678] [--repoRoot=path]
 */
import { pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_WORKFLOW_ID, STALE_EXECUTION_MS } from './constants.mjs';
import { readBucket } from './registry.mjs';

/** Statuses that are orphans once they are older than STALE_EXECUTION_MS. */
const STALE_STATUSES = new Set(['running', 'new']);

/**
 * Last path segment of a resume URL. form-waiting URLs are
 * `{base}/form-waiting/{executionId}?signature=...`.
 * @param {string} resumeUrl resume URL from a pending record
 * @returns {string | null}
 */
export function executionIdFromResumeUrl(resumeUrl) {
  try {
    const parsed = new URL(resumeUrl);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : null;
  } catch {
    return null;
  }
}

/**
 * Execution ids that already have a pending gate record.
 * @param {unknown[]} pending pending records
 * @returns {Set<string>}
 */
export function coveredExecutionIds(pending) {
  /** @type {Set<string>} */
  const covered = new Set();
  for (const record of pending) {
    if (!record || typeof record !== 'object') continue;
    const row = /** @type {Record<string, unknown>} */ (record);
    if (row.kind !== 'gate') continue;
    const resume = row.resume;
    if (!resume || typeof resume !== 'object' || !('url' in resume)) continue;
    if (typeof resume.url !== 'string') continue;
    const id = executionIdFromResumeUrl(resume.url);
    if (id) covered.add(id);
  }
  return covered;
}

/**
 * Pick orphan executions. `now` is injected so tests do not depend on the clock.
 * @param {Array<{ id: string | number, status: string, startedAt?: string, workflowId?: string | number }>} executions rows from the public API
 * @param {unknown[]} pending pending registry records
 * @param {number} now epoch ms
 * @returns {Array<{ id: string, status: string, reason: string }>}
 */
export function findOrphans(executions, pending, now) {
  const covered = coveredExecutionIds(pending);
  /** @type {Array<{ id: string, status: string, reason: string }>} */
  const orphans = [];
  for (const execution of executions) {
    const id = String(execution.id);
    if (execution.workflowId !== undefined && String(execution.workflowId) !== BUILD_WORKFLOW_ID) {
      continue;
    }
    if (execution.status === 'waiting' && !covered.has(id)) {
      orphans.push({ id, status: 'waiting', reason: 'waiting with no pending record' });
      continue;
    }
    if (!STALE_STATUSES.has(execution.status)) continue;
    const started = Date.parse(execution.startedAt ?? '');
    if (!Number.isFinite(started)) continue;
    if (now - started > STALE_EXECUTION_MS) {
      orphans.push({
        id,
        status: execution.status,
        reason: `${execution.status} older than 24h`
      });
    }
  }
  return orphans;
}

/**
 * Page through GET /api/v1/executions for one status.
 * @param {string} baseUrl n8n origin
 * @param {string} apiKey public API key, sent as a header and not logged
 * @param {string} status execution status filter
 * @param {typeof fetch} fetchImpl fetch implementation
 * @returns {Promise<object[]>}
 */
async function listStatus(baseUrl, apiKey, status, fetchImpl) {
  /** @type {object[]} */
  const rows = [];
  /** @type {string | undefined} */
  let cursor;
  for (;;) {
    const url = new URL('/api/v1/executions', baseUrl);
    url.searchParams.set('status', status);
    url.searchParams.set('workflowId', BUILD_WORKFLOW_ID);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await fetchImpl(url, {
      headers: { 'X-N8N-API-KEY': apiKey, accept: 'application/json' }
    });
    if (!response.ok) {
      throw new Error(`GET executions status=${status} failed: HTTP ${response.status}`);
    }
    const body = await response.json();
    if (Array.isArray(body.data)) rows.push(...body.data);
    if (!body.nextCursor) break;
    cursor = String(body.nextCursor);
  }
  return rows;
}

/**
 * POST /api/v1/executions/{id}/stop.
 * @param {string} baseUrl n8n origin
 * @param {string} apiKey public API key
 * @param {string} id execution id
 * @param {typeof fetch} fetchImpl fetch implementation
 * @returns {Promise<void>}
 */
async function stopExecution(baseUrl, apiKey, id, fetchImpl) {
  const url = new URL(`/api/v1/executions/${encodeURIComponent(id)}/stop`, baseUrl);
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': apiKey, accept: 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`stop execution ${id} failed: HTTP ${response.status}`);
  }
}

/**
 * Dry-run or apply. Returns the orphans it considered.
 * @param {object} options
 * @param {string} options.repoRoot repository root
 * @param {string} options.baseUrl n8n origin
 * @param {string} options.apiKey public API key
 * @param {boolean} options.apply when false, do not call stop
 * @param {typeof fetch} [options.fetchImpl] fetch implementation
 * @param {number} [options.now] epoch ms
 * @returns {Promise<Array<{ id: string, status: string, reason: string }>>}
 */
export async function sweepOrphans(options) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now();
  const batches = await Promise.all(
    ['waiting', 'running', 'new'].map((status) =>
      listStatus(options.baseUrl, options.apiKey, status, fetchImpl)
    )
  );
  const executions = batches.flat();
  const orphans = findOrphans(executions, readBucket(options.repoRoot, 'pending'), now);
  if (options.apply) {
    for (const orphan of orphans) {
      await stopExecution(options.baseUrl, options.apiKey, orphan.id, fetchImpl);
    }
  }
  return orphans;
}

/**
 * Repo root from --repoRoot, REDANVIL_REPO, or this repository.
 * @param {string[]} argv command argv
 * @returns {string}
 */
function resolveRepoRoot(argv) {
  const flag = argv.find((arg) => arg.startsWith('--repoRoot='));
  if (flag) return resolve(flag.slice('--repoRoot='.length));
  if (process.env.REDANVIL_REPO) return resolve(process.env.REDANVIL_REPO);
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

/**
 * CLI entry. Prints orphans. With --apply, stops them.
 * @param {string[]} argv command argv
 * @returns {Promise<number>}
 */
export async function runSweep(argv) {
  const repoRoot = resolveRepoRoot(argv);
  const baseFlag = argv.find((arg) => arg.startsWith('--baseUrl='));
  const baseUrl = baseFlag
    ? baseFlag.slice('--baseUrl='.length)
    : process.env.N8N_BASE_URL || 'http://127.0.0.1:5678';
  const apiKey = process.env.N8N_API_KEY;
  if (!apiKey) {
    throw new Error('N8N_API_KEY is not set');
  }
  const apply = argv.includes('--apply');
  const orphans = await sweepOrphans({ repoRoot, baseUrl, apiKey, apply });
  if (!orphans.length) {
    process.stdout.write(apply ? 'apply: no orphans\n' : 'dry-run: no orphans\n');
    return 0;
  }
  const mode = apply ? 'stopped' : 'dry-run';
  for (const orphan of orphans) {
    process.stdout.write(`${mode} ${orphan.id} ${orphan.status} ${orphan.reason}\n`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSweep(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`sweep-orphans: ${message}\n`);
      process.exitCode = 1;
    });
}
