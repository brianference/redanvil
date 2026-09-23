#!/usr/bin/env node
/**
 * Turn a queued RedAnvil job into an n8n build, one cycle at a time.
 *
 *   node n8n-prototype/poller/job-poller.mjs --once
 *   node n8n-prototype/poller/job-poller.mjs [--interval-min 5]
 *
 * A cycle claims at most one queued job, writes a job-approval the owner has
 * to answer (never auto-approved), and only then POSTs the build webhook.
 * The idempotency record under `.redanvil/dispatch/jobs/` is what stops a
 * second cycle, or a restart, from firing that webhook again.
 *
 * The site being unreachable is a retry, not a failure. A job is marked
 * failed only when n8n itself reports the execution errored or crashed.
 *
 * REDANVIL_RUNNER_TOKEN is read from the environment and is never printed.
 */
import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createDispatchStore } from './dispatch-store.mjs';
import {
  createSqliteExecutionReader,
  FULL_BUILD_WORKFLOW_ID,
  resolveN8nDatabasePath
} from './execution-reader.mjs';

/** Site the jobs API lives on when REDANVIL_SITE_URL is unset. */
const DEFAULT_SITE_URL = 'https://redanvil.pages.dev';

/** Loopback n8n when REDANVIL_N8N_URL is unset. */
const DEFAULT_N8N_URL = 'http://127.0.0.1:5678';

/** Minutes between cycles when --interval-min is omitted. */
const DEFAULT_INTERVAL_MIN = 5;

/** Milliseconds in one minute. The scheduler flag is in minutes. */
const MS_PER_MINUTE = 60_000;

/** Status detail cap from the job API contract. */
const DETAIL_MAX_CHARS = 500;

/** Step field cap from the job API contract. */
const STEP_MAX_CHARS = 64;

/** How long one HTTP call may take before it counts as the site being down. */
const REQUEST_TIMEOUT_MS = 20_000;

/** Prompt text kept in the pending summary. The full prompt stays on the job record. */
const SUMMARY_MAX_CHARS = 2000;

/** Highest numeric suffix tried when the requested slug is already a directory. */
const MAX_SLUG_SUFFIX = 999;

/** Slug the webhook accepts, and that we will put on disk as a directory name. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Step values the status API accepts. */
const STEP_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Pending and job filenames. */
const DISPATCH_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}$/;

/** Exact detail the site shows while the owner has not answered. */
const AWAITING_OWNER_DETAIL = 'waiting for the owner to approve this build';

/** Name sent in the claim body. Not a path. */
const DEFAULT_RUNNER_NAME = 'b2-poller';

/** Webhook path of the full-build workflow (build-workflow.mjs). */
const BUILD_WEBHOOK_PATH = '/webhook/redanvil-build';

/** HTTP statuses that mean the runner is misconfigured, not that the network blipped. */
const CONFIG_HTTP_STATUSES = new Set([401, 503]);

/**
 * Thrown when the token is missing or the site rejects it. The process exits
 * non-zero. This is not used for a down site.
 */
export class PollerConfigError extends Error {
  /**
   * @param {string} message text that must not contain the token
   */
  constructor(message) {
    super(message);
    this.name = 'PollerConfigError';
  }
}

/**
 * Parse `--flag value` and bare `--flag` pairs.
 * @param {string[]} argv arguments after the script name
 * @returns {Record<string, string|boolean>}
 */
export function parseArgs(argv) {
  /** @type {Record<string, string|boolean>} */
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

/**
 * True when this file is the process entry point.
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
 * Remove the runner token from anything that might be logged.
 * @param {string} text message
 * @param {string|undefined} token runner token
 * @returns {string}
 */
function scrub(text, token) {
  if (!token) return text;
  return text.split(token).join('[redacted]');
}

/**
 * @param {string} path filesystem path
 * @returns {boolean} true only for a directory
 */
function directoryExists(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Pick a slug that is not already a directory. Collision appends -2, -3, ...
 * @param {string} repoRoot repository root
 * @param {string} requested slug from the job
 * @returns {{ok: true, slug: string, collided: boolean, original: string}|{ok: false, reason: string}}
 */
export function resolveSlug(repoRoot, requested) {
  if (typeof requested !== 'string' || !SLUG_PATTERN.test(requested)) {
    return { ok: false, reason: 'slug must match /^[a-z0-9][a-z0-9-]{0,63}$/' };
  }
  if (!directoryExists(join(repoRoot, requested))) {
    return { ok: true, slug: requested, collided: false, original: requested };
  }
  for (let suffixNumber = 2; suffixNumber <= MAX_SLUG_SUFFIX; suffixNumber += 1) {
    const suffix = `-${suffixNumber}`;
    let base = requested.slice(0, 64 - suffix.length).replace(/-+$/g, '');
    if (!base) base = 'a';
    const candidate = `${base}${suffix}`;
    if (!SLUG_PATTERN.test(candidate)) continue;
    if (!directoryExists(join(repoRoot, candidate))) {
      return { ok: true, slug: candidate, collided: true, original: requested };
    }
  }
  return { ok: false, reason: 'no free slug suffix' };
}

/**
 * Filename stem for a job id. UUIDs pass through lowercased. Anything else is
 * flattened and suffixed with a hash so two different ids cannot share a file.
 * @param {string} jobId remote job id
 * @returns {string}
 */
export function toDispatchId(jobId) {
  const lower = String(jobId).toLowerCase();
  if (DISPATCH_ID_PATTERN.test(lower)) return lower;
  const cleaned = lower
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const hash = createHash('sha256').update(String(jobId)).digest('hex').slice(0, 8);
  const id = `${cleaned || 'job'}-${hash}`.replace(/^-+/, '');
  return DISPATCH_ID_PATTERN.test(id) ? id : `job-${hash}`;
}

/**
 * The webhook only accepts entities as a string.
 * @param {unknown} value job.entities
 * @returns {string}
 */
function entitiesToString(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return JSON.stringify(value);
}

/**
 * @param {string} text source
 * @param {number} max maximum length
 * @returns {string}
 */
function clip(text, max) {
  return text.length <= max ? text : text.slice(0, max);
}

/**
 * Detail posted with awaiting_owner. The required sentence stays intact unless
 * a collision note would blow the 500-character cap, in which case the note is
 * what gets cut.
 * @param {{collided: boolean, original: string, slug: string}} resolution slug choice
 * @returns {string}
 */
function awaitingDetail(resolution) {
  if (!resolution.collided) return AWAITING_OWNER_DETAIL;
  const note = `; directory ${resolution.original} exists, using ${resolution.slug}`;
  return clip(`${AWAITING_OWNER_DETAIL}${note}`, DETAIL_MAX_CHARS);
}

/**
 * @param {object} job local job record
 * @param {string} createdAt ISO timestamp
 * @returns {object} pending contract record
 */
function buildPending(job, createdAt) {
  return {
    id: job.pendingId,
    kind: 'job-approval',
    createdAt,
    expiresAt: null,
    slug: job.slug,
    title: `Approve build ${job.slug}`,
    summary: clip(job.prompt, SUMMARY_MAX_CHARS),
    options: [],
    resume: { type: 'job', jobId: job.jobId },
    onTimeout: null
  };
}

/**
 * POST JSON. A thrown fetch is a network error, not an HTTP status.
 * @param {typeof fetch} fetchImpl fetch implementation
 * @param {string} url absolute URL
 * @param {{token?: string, body?: object, timeoutMs?: number}} options
 */
async function postJson(fetchImpl, url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    /** @type {Record<string, string>} */
    const headers = { accept: 'application/json' };
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal
    });
    const text = await response.text();
    /** @type {unknown} */
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }
    return {
      ok: response.ok,
      networkError: false,
      status: response.status,
      body: parsed,
      headers: response.headers,
      errorMessage: null
    };
  } catch (err) {
    return {
      ok: false,
      networkError: true,
      status: null,
      body: null,
      headers: null,
      errorMessage: err instanceof Error ? err.message : String(err)
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{status: number|null, networkError: boolean, errorMessage: string|null}} result HTTP result
 * @param {string} what short label, no secrets
 */
function throwIfConfig(result, what) {
  if (result.status != null && CONFIG_HTTP_STATUSES.has(result.status)) {
    throw new PollerConfigError(`${what} rejected with HTTP ${result.status}`);
  }
}

/**
 * Execution id if the webhook response actually carried one. n8n 2.22.6's
 * onReceived body does not, so this is usually null and the sqlite reader
 * finds the row by slug.
 * @param {{headers: {get?: (name: string) => string|null}|null, body: unknown}} result
 * @returns {string|null}
 */
function executionIdFromWebhook(result) {
  const header = result.headers?.get?.('x-n8n-execution-id');
  if (typeof header === 'string' && header.length > 0 && header.length <= 64) return header;
  const body = result.body;
  if (!body || typeof body !== 'object') return null;
  const candidate = body.executionId ?? body.execution_id;
  if (typeof candidate === 'string' && candidate.length > 0 && candidate.length <= 64) {
    return candidate;
  }
  return null;
}

/**
 * Map an n8n execution onto the job status API.
 * `success` is done. `error` and `crashed` are failed, with the message in
 * detail. `canceled` is failed too: the execution will not resume.
 * Anything still in progress stays `building`.
 * @param {{status: string, step: string|null, errorMessage: string|null, executionId: string}} snap
 * @returns {{status: string, step: string|null, detail: string|null, executionId: string}}
 */
export function mapExecution(snap) {
  if (snap.status === 'success') {
    return { status: 'done', step: snap.step, detail: null, executionId: snap.executionId };
  }
  if (snap.status === 'error' || snap.status === 'crashed' || snap.status === 'canceled') {
    return {
      status: 'failed',
      step: snap.step,
      detail: clip(snap.errorMessage || `execution ${snap.status}`, DETAIL_MAX_CHARS),
      executionId: snap.executionId
    };
  }
  return { status: 'building', step: snap.step, detail: null, executionId: snap.executionId };
}

/**
 * One poll cycle. Exported so tests can drive it against a fake site.
 * @param {object} [opts]
 * @param {string} [opts.token]
 * @param {string} [opts.siteUrl]
 * @param {string} [opts.n8nUrl]
 * @param {string} [opts.repoRoot]
 * @param {string} [opts.runnerName]
 * @param {string} [opts.workflowId]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {{lookup: Function}} [opts.executionReader]
 * @param {(line: string) => void} [opts.log]
 * @param {() => Date} [opts.now]
 * @param {ReturnType<typeof createDispatchStore>} [opts.store]
 * @returns {Promise<{claimed: boolean}>}
 */
export async function runCycle(opts = {}) {
  const token = opts.token ?? process.env.REDANVIL_RUNNER_TOKEN;
  if (!token) {
    throw new PollerConfigError(
      'REDANVIL_RUNNER_TOKEN is not set. The poller cannot claim jobs without it.'
    );
  }
  const siteUrl = (opts.siteUrl ?? process.env.REDANVIL_SITE_URL ?? DEFAULT_SITE_URL).replace(
    /\/$/,
    ''
  );
  const n8nUrl = (opts.n8nUrl ?? process.env.REDANVIL_N8N_URL ?? DEFAULT_N8N_URL).replace(
    /\/$/,
    ''
  );
  const repoRoot = opts.repoRoot ?? process.env.REDANVIL_REPO ?? process.cwd();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const runnerName = opts.runnerName ?? process.env.REDANVIL_RUNNER_NAME ?? DEFAULT_RUNNER_NAME;
  const now = opts.now ?? (() => new Date());
  const store = opts.store ?? createDispatchStore(repoRoot);
  const sink = opts.log ?? ((line) => process.stdout.write(`${line}\n`));
  const log = (line) => sink(scrub(String(line), token));
  const reader =
    opts.executionReader ??
    createSqliteExecutionReader({
      databasePath: resolveN8nDatabasePath(process.env, repoRoot),
      workflowId: opts.workflowId ?? process.env.REDANVIL_N8N_WORKFLOW_ID ?? FULL_BUILD_WORKFLOW_ID
    });

  /**
   * Push a status. Returns false when the site did not accept it. Never throws
   * for a network error. 401 and 503 are configuration failures.
   * @param {string} jobId remote id
   * @param {{status: string, step?: string|null, detail?: string|null, executionId?: string|null}} fields
   * @returns {Promise<boolean>}
   */
  async function postStatus(jobId, fields) {
    /** @type {Record<string, string>} */
    const body = { status: fields.status };
    if (fields.step && STEP_PATTERN.test(fields.step) && fields.step.length <= STEP_MAX_CHARS) {
      body.step = fields.step;
    }
    if (typeof fields.detail === 'string') body.detail = clip(fields.detail, DETAIL_MAX_CHARS);
    if (fields.executionId && String(fields.executionId).length <= 64) {
      body.executionId = String(fields.executionId);
    }
    const result = await postJson(
      fetchImpl,
      `${siteUrl}/api/jobs/${encodeURIComponent(jobId)}/status`,
      {
        token,
        body
      }
    );
    throwIfConfig(result, 'status');
    if (result.networkError || !result.ok) {
      log(
        `poller: status ${fields.status} for ${jobId} not delivered` +
          ` (${result.networkError ? result.errorMessage : `HTTP ${result.status}`}); local state kept`
      );
      return false;
    }
    return true;
  }

  /**
   * Retry a status the previous cycle could not deliver. Does not change the
   * decision and does not call the webhook.
   */
  async function flushUnsynced() {
    for (const job of store.listJobs()) {
      if (job.remoteSynced !== false) continue;
      if (typeof job.lastStatus !== 'string' || !job.lastStatus) continue;
      const ok = await postStatus(job.jobId, {
        status: job.lastStatus,
        step: job.lastStep,
        detail: job.detail,
        executionId: job.executionId
      });
      if (!ok) continue;
      job.remoteSynced = true;
      store.writeJob(job);
    }
  }

  /**
   * Claim the oldest queued job, or do nothing when the queue is empty or the
   * site cannot be reached.
   * @returns {Promise<boolean>} true when a new job was recorded
   */
  async function claimOne() {
    const result = await postJson(fetchImpl, `${siteUrl}/api/jobs/claim`, {
      token,
      body: { runner: runnerName }
    });
    throwIfConfig(result, 'claim');
    if (result.networkError) {
      log(`poller: claim failed (${result.errorMessage}); local state kept`);
      return false;
    }
    if (result.status === 204) {
      log('poller: no queued job');
      return false;
    }
    if (!result.ok) {
      log(`poller: claim failed (HTTP ${result.status}); local state kept`);
      return false;
    }
    const remote = result.body?.job;
    if (!remote || typeof remote.id !== 'string' || typeof remote.slug !== 'string') {
      log('poller: claim response had no job; local state kept');
      return false;
    }
    const fileId = toDispatchId(remote.id);
    if (store.readJob(fileId)) {
      log(`poller: job ${remote.id} is already tracked`);
      return false;
    }
    const createdAt = now().toISOString();
    const prompt = typeof remote.prompt === 'string' ? remote.prompt : '';
    const entities = entitiesToString(remote.entities);
    const resolution = resolveSlug(repoRoot, remote.slug);
    if (!resolution.ok || !prompt.trim()) {
      const detail = !resolution.ok ? resolution.reason : 'job has no prompt';
      const failed = {
        fileId,
        jobId: remote.id,
        slug: remote.slug,
        requestedSlug: remote.slug,
        prompt,
        entities,
        executionId: null,
        lastStep: null,
        lastStatus: 'failed',
        pendingId: fileId,
        webhookPosted: false,
        webhookPostedAt: null,
        remoteSynced: false,
        actedDecision: null,
        detail: clip(detail, DETAIL_MAX_CHARS)
      };
      store.writeJob(failed);
      failed.remoteSynced = await postStatus(remote.id, {
        status: 'failed',
        detail: failed.detail
      });
      store.writeJob(failed);
      log(`poller: job ${remote.id} rejected locally (${failed.detail})`);
      return true;
    }
    const detail = awaitingDetail(resolution);
    const record = {
      fileId,
      jobId: remote.id,
      slug: resolution.slug,
      requestedSlug: resolution.original,
      prompt,
      entities,
      executionId: null,
      lastStep: null,
      lastStatus: 'awaiting_owner',
      pendingId: fileId,
      webhookPosted: false,
      webhookPostedAt: null,
      remoteSynced: false,
      actedDecision: null,
      detail
    };
    store.writeJob(record);
    store.writePending(buildPending(record, createdAt));
    record.remoteSynced = await postStatus(remote.id, {
      status: 'awaiting_owner',
      detail
    });
    store.writeJob(record);
    log(
      `poller: claimed ${remote.id} as ${resolution.slug}` +
        (resolution.collided ? ` (${resolution.original} was taken)` : '')
    );
    return true;
  }

  /**
   * Apply owner decisions that this process has not acted on yet.
   * The webhook is posted only after we have a durable `webhookPosted` flag
   * to write, and only when that flag is still false.
   */
  async function applyResolutions() {
    const jobs = store.listJobs();
    for (const resolved of store.listResolved()) {
      const job = jobs.find(
        (candidate) => candidate.pendingId === resolved.id || candidate.fileId === resolved.id
      );
      if (!job) continue;
      if (resolved.decision === 'reject') {
        if (job.actedDecision === 'reject') continue;
        job.actedDecision = 'reject';
        job.lastStatus = 'rejected';
        job.detail = clip(
          typeof resolved.notes === 'string' && resolved.notes.trim()
            ? resolved.notes.trim()
            : 'rejected by the owner',
          DETAIL_MAX_CHARS
        );
        job.remoteSynced = false;
        store.writeJob(job);
        job.remoteSynced = await postStatus(job.jobId, {
          status: 'rejected',
          detail: job.detail
        });
        store.writeJob(job);
        log(`poller: rejected ${job.jobId}`);
        continue;
      }
      if (resolved.decision !== 'approve') {
        if (job.actedDecision) continue;
        job.actedDecision = typeof resolved.decision === 'string' ? resolved.decision : 'unknown';
        store.writeJob(job);
        log(`poller: ignoring ${job.actedDecision} on ${job.jobId}; not an approval`);
        continue;
      }
      // webhookPosted is the idempotency record. A restart that already wrote
      // it must not POST the build again. Do not key this on actedDecision:
      // that flag can be set beside a forgotten webhookPosted and would hide
      // the double-fire.
      if (job.webhookPosted) continue;
      {
        const webhook = await postJson(fetchImpl, `${n8nUrl}${BUILD_WEBHOOK_PATH}`, {
          body: { slug: job.slug, prompt: job.prompt, entities: job.entities }
        });
        if (webhook.networkError || !webhook.ok) {
          log(
            `poller: webhook for ${job.jobId} not delivered` +
              ` (${webhook.networkError ? webhook.errorMessage : `HTTP ${webhook.status}`}); will retry`
          );
          continue;
        }
        job.webhookPosted = true;
        job.webhookPostedAt = now().toISOString();
        job.executionId = executionIdFromWebhook(webhook);
        job.lastStatus = 'building';
        job.actedDecision = 'approve';
        job.detail = 'n8n build started';
        job.remoteSynced = false;
        store.writeJob(job);
        log(`poller: webhook posted for ${job.jobId} slug ${job.slug}`);
      }
      job.remoteSynced = await postStatus(job.jobId, {
        status: 'building',
        executionId: job.executionId,
        detail: job.detail
      });
      store.writeJob(job);
    }
  }

  /**
   * For every build we started, copy the latest finished n8n step onto the site.
   * A read error or a down site leaves the local record where it was.
   */
  async function pushBuilding() {
    for (const job of store.listJobs()) {
      if (job.lastStatus !== 'building' || job.webhookPosted !== true) continue;
      /** @type {{executionId: string, status: string, step: string|null, errorMessage: string|null}|null} */
      let snap = null;
      try {
        snap = await reader.lookup({
          executionId: job.executionId,
          slug: job.slug,
          notBefore: job.webhookPostedAt
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`poller: execution read failed for ${job.jobId} (${message}); local state kept`);
        continue;
      }
      if (!snap) {
        log(`poller: execution not visible yet for ${job.jobId}`);
        continue;
      }
      const mapped = mapExecution(snap);
      const step = mapped.step ?? job.lastStep ?? null;
      const same =
        job.remoteSynced === true &&
        mapped.status === job.lastStatus &&
        step === job.lastStep &&
        (job.executionId ?? null) === mapped.executionId;
      if (same) continue;
      const delivered = await postStatus(job.jobId, {
        status: mapped.status,
        step,
        detail: mapped.detail,
        executionId: mapped.executionId
      });
      if (!delivered) continue;
      job.lastStatus = mapped.status;
      job.lastStep = step;
      job.executionId = mapped.executionId;
      if (mapped.detail) job.detail = mapped.detail;
      job.remoteSynced = true;
      store.writeJob(job);
      log(`poller: ${job.jobId} -> ${mapped.status}${step ? ` step ${step}` : ''}`);
    }
  }

  await flushUnsynced();
  const claimed = await claimOne();
  await applyResolutions();
  await pushBuilding();
  return { claimed };
}

/**
 * Process entry. `--once` runs a single cycle. Otherwise loops.
 * @param {string[]} [argv] arguments after the script name
 * @param {NodeJS.ProcessEnv} [env] environment
 * @returns {Promise<number>} exit code
 */
export async function main(argv = process.argv.slice(2), env = process.env) {
  // Task Scheduler starts with no shell environment, so the token lives in the
  // gitignored n8n-prototype/.env. Only the real process env is filled from it;
  // a variable already set wins, and nothing read here is printed.
  const envFile = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  if (env === process.env && !env.REDANVIL_RUNNER_TOKEN && existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
  const token = env.REDANVIL_RUNNER_TOKEN;
  if (!token) {
    process.stderr.write(
      'REDANVIL_RUNNER_TOKEN is not set. The poller cannot claim jobs without it.\n'
    );
    return 1;
  }
  const args = parseArgs(argv);
  const once = args.once === true;
  const intervalMin = Number(args['interval-min'] ?? DEFAULT_INTERVAL_MIN);
  if (!Number.isFinite(intervalMin) || intervalMin <= 0) {
    process.stderr.write('--interval-min must be a positive number of minutes\n');
    return 1;
  }
  for (;;) {
    try {
      await runCycle({
        token,
        siteUrl: env.REDANVIL_SITE_URL,
        n8nUrl: env.REDANVIL_N8N_URL,
        repoRoot: env.REDANVIL_REPO,
        runnerName: env.REDANVIL_RUNNER_NAME
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`${scrub(message, token)}\n`);
      return 1;
    }
    if (once) return 0;
    await delay(intervalMin * MS_PER_MINUTE);
  }
}

if (isMainModule()) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`${scrub(message, process.env.REDANVIL_RUNNER_TOKEN)}\n`);
      process.exit(1);
    });
}
