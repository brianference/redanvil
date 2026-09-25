import type { D1Database, D1PreparedStatement, Env } from '../../functions/lib/env';

/** One jobs row the in-memory database can claim, update, and project. */
interface StoredJob {
  id: string;
  slug: string;
  prompt: string;
  entities: string;
  target_type: string;
  threshold: number;
  status: string;
  created_at: string;
  claimed_at: string | null;
  claimed_by: string | null;
  step: string | null;
  detail: string | null;
  execution_id: string | null;
  deploy_url: string | null;
  updated_at: string;
}

/** One rate-limit bucket. The key is a hash, never a raw IP. */
interface RateBucket {
  bucket_key: string;
  hit_count: number;
  window_start: string;
}

/** Result of executing one statement against the in-memory tables. */
interface Executed {
  changes: number;
  results: Record<string, unknown>[];
}

/** Seed for a job row. Omitted runner fields start empty. */
export interface QueueJobSeed {
  id: string;
  slug: string;
  prompt: string;
  created_at: string;
  entities?: string;
  target_type?: string;
  threshold?: number;
  status?: string;
  step?: string | null;
  detail?: string | null;
  execution_id?: string | null;
  deploy_url?: string | null;
  updated_at?: string;
  /** ISO time of the last claim. Only meaningful with status `claimed`. */
  claimed_at?: string | null;
  claimed_by?: string | null;
}

/** Seed for a rate-limit bucket, to prove expired buckets are pruned. */
export interface RateBucketSeed {
  bucket_key: string;
  hit_count: number;
  /** UTC hour, `YYYY-MM-DDTHH`, as the limiter writes it. */
  window_start: string;
}

/** Options for {@link createQueueEnv}. */
export interface QueueEnvOptions {
  /** When set, copied onto Env.RUNNER_TOKEN. */
  runnerToken?: string;
  /** Jobs present before the first request. */
  jobs?: readonly QueueJobSeed[];
  /** Rate-limit buckets present before the first request. */
  rateBuckets?: readonly RateBucketSeed[];
  /**
   * When true, every statement rejects. Used to prove storage failures
   * are not reported as an empty queue.
   */
  fail?: boolean;
}

/**
 * Collapse whitespace so a multiline statement matches the interpreter.
 *
 * @param sql - SQL text from `prepare`.
 * @returns Single-spaced SQL.
 */
function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

/**
 * Build a stored job from a seed, filling columns the seed does not set.
 *
 * @param seed - Caller-supplied fields.
 * @returns A complete row.
 */
function fromSeed(seed: QueueJobSeed): StoredJob {
  return {
    id: seed.id,
    slug: seed.slug,
    prompt: seed.prompt,
    entities: seed.entities ?? '',
    target_type: seed.target_type ?? 'fullstack-web',
    threshold: seed.threshold ?? 90,
    status: seed.status ?? 'queued',
    created_at: seed.created_at,
    claimed_at: seed.claimed_at ?? null,
    claimed_by: seed.claimed_by ?? null,
    step: seed.step ?? null,
    detail: seed.detail ?? null,
    execution_id: seed.execution_id ?? null,
    deploy_url: seed.deploy_url ?? null,
    updated_at: seed.updated_at ?? ''
  };
}

/**
 * Project a row to the columns named in a SELECT list.
 *
 * `*` returns every column, including prompt. A list that names `prompt`
 * includes it. A list that does not, does not. That is what the public
 * status test relies on: if the handler selects the prompt, the response
 * can leak it.
 *
 * @param row - Stored job.
 * @param selectList - Text between SELECT and FROM.
 * @returns One result object.
 */
function projectJob(row: StoredJob, selectList: string): Record<string, unknown> {
  const record = row as unknown as Record<string, unknown>;
  if (selectList.trim() === '*') {
    return { ...record };
  }
  const projected: Record<string, unknown> = {};
  for (const column of selectList.split(',')) {
    const name = column.trim();
    projected[name] = record[name];
  }
  return projected;
}

/**
 * Whether a claim may take this row: queued, or claimed with a lease that
 * started before `leaseCutoff`. A null cutoff means queued only, which is
 * what the claim SQL did before the lease existed.
 *
 * @param row - Stored job.
 * @param leaseCutoff - ISO time; claims older than this have expired.
 * @returns True when the row is claimable.
 */
function isClaimable(row: StoredJob, leaseCutoff: string | null): boolean {
  if (row.status === 'queued') return true;
  if (leaseCutoff === null) return false;
  return row.status === 'claimed' && row.claimed_at !== null && row.claimed_at < leaseCutoff;
}

/**
 * Apply one statement. Throws on SQL this helper does not implement so a
 * drifted query fails the test instead of silently succeeding.
 *
 * Mutations run synchronously inside `run` / `all` (no await before the
 * write). Callers that `await` between statements can interleave, which is
 * the race the claim guard has to survive.
 *
 * @param jobs - Mutable job table.
 * @param rates - Mutable rate-limit table.
 * @param sql - Statement text.
 * @param params - Bound parameters, in order.
 * @returns Changes and result rows.
 */
function execute(
  jobs: StoredJob[],
  rates: Map<string, RateBucket>,
  sql: string,
  params: readonly unknown[]
): Executed {
  const norm = normalizeSql(sql);

  if (
    norm.startsWith('INSERT INTO rate_limits') &&
    norm.includes('ON CONFLICT(bucket_key) DO UPDATE SET hit_count = hit_count + 1')
  ) {
    const bucketKey = String(params[0]);
    const windowStart = String(params[1]);
    const existing = rates.get(bucketKey);
    if (existing === undefined) {
      rates.set(bucketKey, { bucket_key: bucketKey, hit_count: 1, window_start: windowStart });
    } else {
      existing.hit_count += 1;
    }
    return { changes: 1, results: [] };
  }

  if (norm === 'SELECT hit_count FROM rate_limits WHERE bucket_key = ?') {
    const existing = rates.get(String(params[0]));
    if (existing === undefined) return { changes: 0, results: [] };
    return { changes: 0, results: [{ hit_count: existing.hit_count }] };
  }

  if (
    norm ===
    'DELETE FROM rate_limits WHERE bucket_key IN (SELECT bucket_key FROM rate_limits WHERE window_start < ? LIMIT ?)'
  ) {
    const cutoff = String(params[0]);
    const limit = Number(params[1]);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error(`jobQueueDb: bad prune limit ${String(params[1])}`);
    }
    const expired = [...rates.values()]
      .filter((bucket) => bucket.window_start < cutoff)
      .slice(0, limit);
    for (const bucket of expired) rates.delete(bucket.bucket_key);
    return { changes: expired.length, results: [] };
  }

  if (norm.startsWith('INSERT INTO prds ')) {
    return { changes: 1, results: [] };
  }

  const insertJobs = /^INSERT INTO jobs \((.+)\) VALUES \((.+)\)$/.exec(norm);
  if (insertJobs !== null) {
    const columns = insertJobs[1]?.split(',').map((column) => column.trim()) ?? [];
    const placeholders = insertJobs[2]?.split(',').map((part) => part.trim()) ?? [];
    if (placeholders.some((part) => part !== '?') || columns.length !== params.length) {
      throw new Error(`jobQueueDb: bad jobs insert: ${norm}`);
    }
    const row = fromSeed({
      id: '',
      slug: '',
      prompt: '',
      created_at: ''
    });
    const record = row as unknown as Record<string, unknown>;
    for (let index = 0; index < columns.length; index += 1) {
      const column = columns[index];
      if (column === undefined) continue;
      record[column] = params[index];
    }
    if (jobs.some((existing) => existing.id === row.id)) {
      throw new Error(`jobQueueDb: duplicate job id ${row.id}`);
    }
    jobs.push(row);
    return { changes: 1, results: [] };
  }

  const pickQueued =
    norm === "SELECT id FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1";
  const pickWithLease =
    norm ===
    "SELECT id FROM jobs WHERE status = 'queued' OR (status = 'claimed' AND claimed_at < ?) ORDER BY created_at ASC LIMIT 1";
  if (pickQueued || pickWithLease) {
    const leaseCutoff = pickWithLease ? String(params[0]) : null;
    const queued = jobs
      .filter((row) => isClaimable(row, leaseCutoff))
      .sort((left, right) => (left.created_at < right.created_at ? -1 : 1));
    const oldest = queued[0];
    if (oldest === undefined) return { changes: 0, results: [] };
    return { changes: 0, results: [{ id: oldest.id }] };
  }

  if (norm.startsWith("UPDATE jobs SET status = 'claimed'")) {
    const leased = norm.endsWith(
      "AND (status = 'queued' OR (status = 'claimed' AND claimed_at < ?))"
    );
    const guarded = leased || norm.includes("AND status = 'queued'");
    const id = String(params[3]);
    const row = jobs.find((candidate) => candidate.id === id);
    if (row === undefined) return { changes: 0, results: [] };
    if (guarded && !isClaimable(row, leased ? String(params[4]) : null)) {
      return { changes: 0, results: [] };
    }
    row.status = 'claimed';
    row.claimed_at = String(params[0]);
    row.claimed_by = String(params[1]);
    row.updated_at = String(params[2]);
    return { changes: 1, results: [] };
  }

  if (norm.startsWith('UPDATE jobs SET status = ?') && norm.includes('COALESCE(?, step)')) {
    const id = String(params[6]);
    const row = jobs.find((candidate) => candidate.id === id);
    if (row === undefined) return { changes: 0, results: [] };
    row.status = String(params[0]);
    if (params[1] !== null && params[1] !== undefined) row.step = String(params[1]);
    if (params[2] !== null && params[2] !== undefined) row.detail = String(params[2]);
    if (params[3] !== null && params[3] !== undefined) row.execution_id = String(params[3]);
    if (params[4] !== null && params[4] !== undefined) row.deploy_url = String(params[4]);
    row.updated_at = String(params[5]);
    return { changes: 1, results: [] };
  }

  const selectById = /^SELECT (.+) FROM jobs WHERE id = \?$/.exec(norm);
  if (selectById !== null) {
    const row = jobs.find((candidate) => candidate.id === String(params[0]));
    if (row === undefined) return { changes: 0, results: [] };
    return { changes: 0, results: [projectJob(row, selectById[1] ?? '*')] };
  }

  if (
    norm ===
    'SELECT id, slug, prompt, target_type, threshold, status, created_at FROM jobs ORDER BY created_at DESC LIMIT 50'
  ) {
    const sorted = [...jobs].sort((left, right) => (left.created_at < right.created_at ? 1 : -1));
    return {
      changes: 0,
      results: sorted.slice(0, 50).map((row) => ({
        id: row.id,
        slug: row.slug,
        prompt: row.prompt,
        target_type: row.target_type,
        threshold: row.threshold,
        status: row.status,
        created_at: row.created_at
      }))
    };
  }

  throw new Error(`jobQueueDb: unsupported SQL: ${norm}`);
}

/** Databases created by {@link createQueueEnv}, so tests can read them back. */
const tables = new WeakMap<D1Database, { jobs: StoredJob[]; rates: Map<string, RateBucket> }>();

/**
 * In-memory D1 that executes the job-queue and rate-limit statements.
 *
 * `run` and `all` apply the statement synchronously before they return a
 * promise, matching one SQLite statement. Awaiting between statements still
 * lets two claims interleave, so a claim UPDATE without `status = 'queued'`
 * can hand the same job to both callers.
 *
 * @param options - Token, seed rows, and failure mode.
 * @returns Env whose DB is this database.
 */
export function createQueueEnv(options: QueueEnvOptions = {}): Env {
  const jobs = (options.jobs ?? []).map(fromSeed);
  const rates = new Map<string, RateBucket>();
  for (const bucket of options.rateBuckets ?? []) {
    rates.set(bucket.bucket_key, { ...bucket });
  }
  const fail = options.fail === true;

  const db: D1Database = {
    prepare(query: string): D1PreparedStatement {
      let bound: unknown[] = [];
      const stmt: D1PreparedStatement = {
        bind(...values: unknown[]): D1PreparedStatement {
          bound = values;
          return stmt;
        },
        run() {
          if (fail) return Promise.reject(new Error('D1 unavailable'));
          const outcome = execute(jobs, rates, query, bound);
          return Promise.resolve({
            success: true,
            meta: { changes: outcome.changes },
            results: outcome.results
          });
        },
        all() {
          if (fail) return Promise.reject(new Error('D1 unavailable'));
          const outcome = execute(jobs, rates, query, bound);
          return Promise.resolve({ results: outcome.results });
        }
      };
      return stmt;
    }
  };

  tables.set(db, { jobs, rates });
  return {
    DB: db,
    RATE_LIMIT_KEY: 'test-rate-limit-key',
    ...(options.runnerToken !== undefined ? { RUNNER_TOKEN: options.runnerToken } : {})
  };
}

/**
 * Jobs currently stored for an env from {@link createQueueEnv}.
 *
 * @param env - Env returned by {@link createQueueEnv}.
 * @returns The live job rows.
 */
export function readQueueJobs(env: Env): readonly StoredJob[] {
  const table = tables.get(env.DB);
  if (table === undefined) {
    throw new Error('readQueueJobs: env was not created by createQueueEnv');
  }
  return table.jobs;
}

/**
 * Rate-limit buckets currently stored, with their window.
 *
 * @param env - Env returned by {@link createQueueEnv}.
 * @returns Copies of the stored buckets.
 */
export function readRateBuckets(env: Env): readonly RateBucket[] {
  const table = tables.get(env.DB);
  if (table === undefined) {
    throw new Error('readRateBuckets: env was not created by createQueueEnv');
  }
  return [...table.rates.values()].map((bucket) => ({ ...bucket }));
}

/**
 * Rate-limit keys currently stored. Tests assert these are digests, not IPs.
 *
 * @param env - Env returned by {@link createQueueEnv}.
 * @returns Bucket keys.
 */
export function readRateKeys(env: Env): readonly string[] {
  const table = tables.get(env.DB);
  if (table === undefined) {
    throw new Error('readRateKeys: env was not created by createQueueEnv');
  }
  return [...table.rates.keys()];
}
