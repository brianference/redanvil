import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { D1Database, D1PreparedStatement, Env } from '../../functions/lib/env';

// Vite 5 strips the `node:` prefix and cannot resolve a bare `sqlite`, which
// only exists under that prefix, so load it through Node's own require.
const sqliteModule = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

/**
 * D1 is SQLite, so the queue tests run the handlers' real SQL against a real
 * SQLite database built from this app's own migrations. Only the binding's
 * async prepare/bind/run/all surface is adapted here; every WHERE clause,
 * compare-and-set and DELETE ... LIMIT is decided by the SQL engine, never by
 * test code.
 */
const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations/', import.meta.url));

/** One jobs row, as the migrated schema stores it. */
export interface StoredJob {
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
export interface RateBucket {
  bucket_key: string;
  hit_count: number;
  window_start: string;
}

/** Seed for a job row. Omitted columns take the schema defaults. */
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
export type RateBucketSeed = RateBucket;

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

/** Target type the submit route writes; seeds default to it. */
const DEFAULT_TARGET_TYPE = 'fullstack-web';

/** Gate threshold the submit route writes; seeds default to it. */
const DEFAULT_THRESHOLD = 90;

/** SQLite handle behind each env, so tests can read back what the handlers wrote. */
const databases = new WeakMap<D1Database, DatabaseSync>();

/**
 * A fresh in-memory database with every migration applied in filename order,
 * exactly as `wrangler d1 migrations apply` orders them.
 *
 * @returns Migrated database.
 */
function migratedDatabase(): DatabaseSync {
  const sqlite = new sqliteModule.DatabaseSync(':memory:');
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const file of files) {
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return sqlite;
}

/**
 * Adapt a SQLite handle to the D1 binding surface the handlers call.
 *
 * @param sqlite - Migrated database.
 * @param fail - When true, every statement rejects like an unreachable D1.
 * @returns D1-shaped binding.
 */
function asD1(sqlite: DatabaseSync, fail: boolean): D1Database {
  return {
    prepare(query: string): D1PreparedStatement {
      let bound: SQLInputValue[] = [];
      const stmt: D1PreparedStatement = {
        bind(...values: unknown[]): D1PreparedStatement {
          bound = values as SQLInputValue[];
          return stmt;
        },
        async run() {
          if (fail) throw new Error('D1 unavailable');
          const outcome = sqlite.prepare(query).run(...bound);
          return { success: true, meta: { changes: Number(outcome.changes) }, results: [] };
        },
        async all() {
          if (fail) throw new Error('D1 unavailable');
          return { results: sqlite.prepare(query).all(...bound) };
        }
      };
      return stmt;
    }
  };
}

/**
 * Env backed by a freshly migrated SQLite database holding the seeds.
 *
 * @param options - Seeds, runner token, and failure mode.
 * @returns Env whose DB is this database.
 */
export function createQueueEnv(options: QueueEnvOptions = {}): Env {
  const sqlite = migratedDatabase();
  const insertJob = sqlite.prepare(
    `INSERT INTO jobs (id, slug, prompt, entities, target_type, threshold, status, created_at,
       claimed_at, claimed_by, step, detail, execution_id, deploy_url, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const seed of options.jobs ?? []) {
    insertJob.run(
      seed.id,
      seed.slug,
      seed.prompt,
      seed.entities ?? '',
      seed.target_type ?? DEFAULT_TARGET_TYPE,
      seed.threshold ?? DEFAULT_THRESHOLD,
      seed.status ?? 'queued',
      seed.created_at,
      seed.claimed_at ?? null,
      seed.claimed_by ?? null,
      seed.step ?? null,
      seed.detail ?? null,
      seed.execution_id ?? null,
      seed.deploy_url ?? null,
      seed.updated_at ?? ''
    );
  }
  const insertBucket = sqlite.prepare(
    'INSERT INTO rate_limits (bucket_key, hit_count, window_start) VALUES (?, ?, ?)'
  );
  for (const bucket of options.rateBuckets ?? []) {
    insertBucket.run(bucket.bucket_key, bucket.hit_count, bucket.window_start);
  }

  const db = asD1(sqlite, options.fail === true);
  databases.set(db, sqlite);
  return {
    DB: db,
    RATE_LIMIT_KEY: 'test-rate-limit-key',
    ...(options.runnerToken !== undefined ? { RUNNER_TOKEN: options.runnerToken } : {})
  };
}

/**
 * The SQLite handle behind an env from {@link createQueueEnv}.
 *
 * @param env - Env returned by {@link createQueueEnv}.
 * @returns The database.
 * @throws Error when the env did not come from createQueueEnv.
 */
function databaseOf(env: Env): DatabaseSync {
  const sqlite = databases.get(env.DB);
  if (sqlite === undefined) {
    throw new Error('jobQueueDb: env was not created by createQueueEnv');
  }
  return sqlite;
}

/**
 * Jobs currently stored, oldest first.
 *
 * @param env - Env returned by {@link createQueueEnv}.
 * @returns The stored job rows.
 */
export function readQueueJobs(env: Env): readonly StoredJob[] {
  return databaseOf(env)
    .prepare('SELECT * FROM jobs ORDER BY created_at ASC')
    .all() as unknown as StoredJob[];
}

/**
 * Rate-limit buckets currently stored, with their window.
 *
 * @param env - Env returned by {@link createQueueEnv}.
 * @returns The stored buckets.
 */
export function readRateBuckets(env: Env): readonly RateBucket[] {
  return databaseOf(env)
    .prepare('SELECT bucket_key, hit_count, window_start FROM rate_limits')
    .all() as unknown as RateBucket[];
}

/**
 * Rate-limit keys currently stored. Tests assert these are digests, not IPs.
 *
 * @param env - Env returned by {@link createQueueEnv}.
 * @returns Bucket keys.
 */
export function readRateKeys(env: Env): readonly string[] {
  return readRateBuckets(env).map((bucket) => bucket.bucket_key);
}
