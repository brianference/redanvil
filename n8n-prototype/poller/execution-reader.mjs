/**
 * Read-only view of one n8n 2.22.6 execution.
 *
 * HOW STATUS IS READ (established against the installed package, not the docs)
 *
 * The public REST API is not the reader. `GET /api/v1/executions/:id` is behind
 * `x-n8n-api-key` (`n8n/dist/services/api-key-auth.strategy.js`, header
 * `API_KEY_HEADER`). A missing key does not authenticate. The whole router is
 * omitted when `N8N_PUBLIC_API_DISABLED` is set or the license flag
 * `API_DISABLED` is on (`n8n/dist/public-api/index.js`:
 * `!publicApi.disabled && !license.isAPIDisabled()`). This poller must not
 * require a second secret that the local instance does not have.
 *
 * The reader opens n8n's SQLite file and never writes it.
 *
 * - Folder: `getN8nFolder()` in `@n8n/config/dist/utils/utils.js` is
 *   `path.join(N8N_USER_FOLDER ?? USERPROFILE, '.n8n')`. Verified by calling
 *   that function: `N8N_USER_FOLDER=C:/tmp/n8n-user-folder` resolves to
 *   `C:\tmp\n8n-user-folder\.n8n`. `start-server.sh` sets `N8N_USER_FOLDER` to
 *   `n8n-prototype/.n8n-home`, so the database is
 *   `n8n-prototype/.n8n-home/.n8n/database.sqlite`.
 * - Filename: `SqliteConfig.database` defaults to `database.sqlite`
 *   (`@n8n/config/dist/configs/database.config.js`), overridable with
 *   `DB_SQLITE_DATABASE`. The connection joins them with `path.resolve`
 *   (`@n8n/db/dist/connection/db-connection-options.js`).
 * - Rows: table `execution_entity` columns `id`, `status`, `workflowId`,
 *   `startedAt`, `deletedAt` (migrations `AddStatusToExecutions`,
 *   `ExecutionSoftDelete`; camelCase quoted identifiers). Run data is
 *   `execution_data.data`, written with `flatted.stringify`
 *   (`@n8n/db/dist/repositories/execution.repository.js`).
 * - The webhook answer is only `{ message: 'Workflow was started' }`
 *   (`n8n/dist/webhooks/webhook-on-received-response-extractor.js`). It does
 *   not carry an execution id, so a build that has not stored one yet is found
 *   by workflow id `redanvilFull001` plus the slug inside the flatted payload.
 *
 * Open mode is `node:sqlite` `{ readOnly: true }` plus `PRAGMA query_only = ON`.
 * A write throws. Tests inject their own reader and do not touch this file.
 *
 * Live check, 2026-09-23, this worktree: `node node_modules/n8n/bin/n8n start`
 * with `N8N_USER_FOLDER` pointed at `n8n-prototype/.n8n-home` and
 * `N8N_LISTEN_ADDRESS=127.0.0.1`. `GET /healthz` returned 200. After the log
 * line "Editor is now accessible", `GET /api/v1/executions` with no API key
 * returned 401. The sqlite file was
 * `n8n-prototype/.n8n-home/.n8n/database.sqlite` (the `.n8n` suffix is real;
 * the file is not directly inside `N8N_USER_FOLDER`). `PRAGMA table_info` on
 * that file:
 *   execution_entity: id, workflowId, finished, mode, retryOf, retrySuccessId,
 *     startedAt, stoppedAt, waitTill, status, deletedAt, createdAt, storedAt,
 *     tracingContext, deduplicationKey
 *   execution_data: executionId, workflowData, data, workflowVersionId
 * The server was stopped after the probe. This reader did not write a row.
 */
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join, resolve } from 'node:path';

/** How many recent executions to scan when the webhook did not return an id. */
const EXECUTION_SCAN_LIMIT = 40;

/**
 * Executions may be timestamped slightly before the poller records the POST,
 * because n8n writes `startedAt` as the workflow begins.
 */
const EXECUTION_CLOCK_SKEW_MS = 5000;

/** Step ids the status API accepts. */
const STEP_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Workflow id baked into build-workflow.mjs. */
export const FULL_BUILD_WORKFLOW_ID = 'redanvilFull001';

/** Default sqlite filename from SqliteConfig. */
const DEFAULT_SQLITE_FILENAME = 'database.sqlite';

/**
 * Absolute path of the sqlite file n8n 2.22.6 opens for this environment.
 * @param {NodeJS.ProcessEnv} env environment
 * @param {string} repoRoot repository root, used when N8N_USER_FOLDER is unset
 * @returns {string}
 */
export function resolveN8nDatabasePath(env, repoRoot) {
  const parent = env.N8N_USER_FOLDER ?? join(repoRoot, 'n8n-prototype', '.n8n-home');
  const folder = join(parent, '.n8n');
  const configured = env.DB_SQLITE_DATABASE?.trim() || DEFAULT_SQLITE_FILENAME;
  return resolve(folder, configured);
}

/**
 * Decode `execution_data.data`. n8n stores flatted JSON (an array whose string
 * values are indexes). A plain JSON object is returned as-is so a fixture that
 * is not flatted still reads.
 * @param {string} text raw column
 * @returns {unknown}
 */
export function parseExecutionData(text) {
  const probe = JSON.parse(text);
  if (!Array.isArray(probe)) return probe;

  const input = JSON.parse(text, (_key, value) =>
    typeof value === 'string' ? new String(value) : value
  ).map((value) => (value instanceof String ? String(value) : value));

  const ignore = Object.create(null);
  /** @type {{output: object, key: string, resolved: object}[]} */
  const lazy = [];
  const seen = new Set();

  /**
   * Replace flatted index strings with the values they point at.
   * Objects are queued so a cycle cannot recurse forever.
   * @param {object} output object or array from the flatted table
   * @returns {object}
   */
  function revive(output) {
    for (const key of Object.keys(output)) {
      const value = output[key];
      if (!(value instanceof String)) continue;
      const resolved = input[Number(value)];
      if (resolved && typeof resolved === 'object' && !seen.has(resolved)) {
        seen.add(resolved);
        output[key] = ignore;
        lazy.push({ output, key, resolved });
      } else {
        output[key] = resolved instanceof String ? String(resolved) : resolved;
      }
    }
    return output;
  }

  let root = input[0];
  if (root && typeof root === 'object') {
    root = revive(root);
    for (let index = 0; index < lazy.length; index += 1) {
      const item = lazy[index];
      item.output[item.key] = revive(item.resolved);
    }
  } else if (root instanceof String) {
    root = String(root);
  }
  return root;
}

/**
 * Step id carried by one finished node run, or null when the node is not a
 * process-map step (the webhook, the config node, a notify).
 * @param {string} nodeName n8n node name
 * @param {object|undefined} task one runData entry
 * @returns {string|null}
 */
function stepFromRun(nodeName, task) {
  const items = task?.data?.main?.[0];
  if (Array.isArray(items)) {
    for (const item of items) {
      const step = item?.json?.step;
      if (typeof step === 'string' && STEP_PATTERN.test(step)) return step;
    }
  }
  const role = /^Role: ([a-z0-9-]+)$/.exec(nodeName);
  if (role && STEP_PATTERN.test(role[1])) return role[1];
  const params = /^([a-z0-9-]+) params$/.exec(nodeName);
  if (params && STEP_PATTERN.test(params[1])) return params[1];
  if (STEP_PATTERN.test(nodeName)) return nodeName;
  return null;
}

/**
 * True when this task has finished. A node that is still inside `running`
 * is not a step we can report.
 * @param {object|undefined} task runData task
 * @returns {boolean}
 */
function taskFinished(task) {
  if (!task || typeof task !== 'object') return false;
  if (task.executionStatus === 'running' || task.executionStatus === 'waiting') return false;
  if (task.executionStatus === 'success' || task.executionStatus === 'error') return true;
  return typeof task.executionTime === 'number';
}

/**
 * Latest finished process step in one execution's runData.
 * @param {unknown} data parsed execution data
 * @returns {string|null}
 */
export function latestFinishedStep(data) {
  const runData = data && typeof data === 'object' ? data.resultData?.runData : null;
  if (!runData || typeof runData !== 'object') return null;
  /** @type {{step: string, ended: number}|null} */
  let best = null;
  for (const [nodeName, runs] of Object.entries(runData)) {
    if (!Array.isArray(runs)) continue;
    for (const task of runs) {
      if (!taskFinished(task)) continue;
      const step = stepFromRun(nodeName, task);
      if (!step) continue;
      const start = typeof task.startTime === 'number' ? task.startTime : 0;
      const elapsed = typeof task.executionTime === 'number' ? task.executionTime : 0;
      const ended = start + elapsed;
      if (!best || ended >= best.ended) best = { step, ended };
    }
  }
  return best ? best.step : null;
}

/**
 * Error string n8n recorded, if any.
 * @param {unknown} data parsed execution data
 * @returns {string|null}
 */
export function executionErrorMessage(data) {
  const message = data && typeof data === 'object' ? data.resultData?.error?.message : null;
  if (typeof message === 'string' && message.trim()) return message.trim();
  const runData = data && typeof data === 'object' ? data.resultData?.runData : null;
  if (!runData || typeof runData !== 'object') return null;
  /** @type {{ended: number, message: string}|null} */
  let best = null;
  for (const runs of Object.values(runData)) {
    if (!Array.isArray(runs)) continue;
    for (const task of runs) {
      const taskMessage = task?.error?.message;
      if (typeof taskMessage !== 'string' || !taskMessage.trim()) continue;
      const start = typeof task.startTime === 'number' ? task.startTime : 0;
      const elapsed = typeof task.executionTime === 'number' ? task.executionTime : 0;
      const ended = start + elapsed;
      if (!best || ended >= best.ended) best = { ended, message: taskMessage.trim() };
    }
  }
  return best ? best.message : null;
}

/**
 * Slugs mentioned in the webhook body or the slice-config output.
 * Walks a bounded number of nodes so a huge run cannot pin the cycle.
 * @param {unknown} data parsed execution data
 * @returns {Set<string>}
 */
function slugsInData(data) {
  /** @type {Set<string>} */
  const found = new Set();
  /** @type {unknown[]} */
  const stack = [data];
  let seen = 0;
  const maxNodes = 20000;
  while (stack.length > 0 && seen < maxNodes) {
    const current = stack.pop();
    seen += 1;
    if (!current || typeof current !== 'object') continue;
    if (typeof current.slug === 'string') found.add(current.slug);
    if (current.body && typeof current.body === 'object' && typeof current.body.slug === 'string') {
      found.add(current.body.slug);
    }
    if (Array.isArray(current)) {
      for (const entry of current) stack.push(entry);
    } else {
      for (const value of Object.values(current)) stack.push(value);
    }
  }
  return found;
}

/**
 * Parse n8n's sqlite datetime into epoch ms. Returns null when it cannot.
 * @param {unknown} value column value
 * @returns {number|null}
 */
function startedAtMs(value) {
  if (value == null || value === '') return null;
  const text = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
  const ms = Date.parse(text);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Open the database read-only. Callers must close it.
 * @param {string} databasePath sqlite file
 * @returns {import('node:sqlite').DatabaseSync}
 */
export function openReadOnlyDatabase(databasePath) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  db.exec('PRAGMA query_only = ON');
  return db;
}

/**
 * @param {object} row joined execution row
 * @returns {{executionId: string, status: string, step: string|null, errorMessage: string|null, slug: string|null, startedAtMs: number|null}}
 */
function snapshotFromRow(row) {
  let data = null;
  if (typeof row.data === 'string' && row.data) {
    try {
      data = parseExecutionData(row.data);
    } catch {
      data = null;
    }
  }
  const slugs = data ? [...slugsInData(data)] : [];
  return {
    executionId: String(row.id),
    status: String(row.status ?? ''),
    step: data ? latestFinishedStep(data) : null,
    errorMessage: data ? executionErrorMessage(data) : null,
    slug: slugs[0] ?? null,
    startedAtMs: startedAtMs(row.startedAt)
  };
}

/**
 * Sqlite reader. `lookup` returns null when the file or the row is absent.
 * It throws only when the file exists but cannot be read, so the poller can
 * tell "not finished yet" from "disk failed" — neither marks the job failed.
 * @param {{databasePath: string, workflowId?: string, scanLimit?: number}} options
 */
export function createSqliteExecutionReader(options) {
  const databasePath = options.databasePath;
  const workflowId = options.workflowId ?? FULL_BUILD_WORKFLOW_ID;
  const scanLimit = options.scanLimit ?? EXECUTION_SCAN_LIMIT;

  return {
    /**
     * @param {{executionId?: string|null, slug?: string|null, notBefore?: string|null}} query
     * @returns {Promise<{executionId: string, status: string, step: string|null, errorMessage: string|null, slug: string|null}|null>}
     */
    async lookup(query) {
      if (!existsSync(databasePath)) return null;
      const db = openReadOnlyDatabase(databasePath);
      try {
        if (query.executionId) {
          const row = db
            .prepare(
              `SELECT e.id AS id, e.status AS status, e.startedAt AS startedAt, d.data AS data
               FROM execution_entity e
               LEFT JOIN execution_data d ON d.executionId = e.id
               WHERE e.id = ? AND e.deletedAt IS NULL`
            )
            .get(query.executionId);
          if (row) return snapshotFromRow(row);
          if (!query.slug) return null;
        }
        if (!query.slug) return null;
        const rows = db
          .prepare(
            `SELECT e.id AS id, e.status AS status, e.startedAt AS startedAt, d.data AS data
             FROM execution_entity e
             LEFT JOIN execution_data d ON d.executionId = e.id
             WHERE e.workflowId = ? AND e.deletedAt IS NULL
             ORDER BY e.startedAt DESC, e.id DESC
             LIMIT ?`
          )
          .all(workflowId, scanLimit);
        const notBefore = startedAtMs(query.notBefore);
        /** @type {ReturnType<typeof snapshotFromRow>|null} */
        let best = null;
        for (const row of rows) {
          const parsed = parseMaybe(row.data);
          if (!slugsInData(parsed).has(query.slug)) continue;
          const snap = snapshotFromRow(row);
          if (
            notBefore != null &&
            snap.startedAtMs != null &&
            snap.startedAtMs + EXECUTION_CLOCK_SKEW_MS < notBefore
          ) {
            continue;
          }
          if (!best || (snap.startedAtMs ?? 0) >= (best.startedAtMs ?? 0)) best = snap;
        }
        return best;
      } finally {
        db.close();
      }
    }
  };
}

/**
 * Parse when possible, otherwise an empty object so the slug scan is a no-op.
 * @param {unknown} text column
 * @returns {unknown}
 */
function parseMaybe(text) {
  if (typeof text !== 'string' || !text) return {};
  try {
    return parseExecutionData(text);
  } catch {
    return {};
  }
}
