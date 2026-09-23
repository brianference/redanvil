/** Rows from `D1PreparedStatement.all`. */
export interface D1Result {
  results: unknown[];
}

/**
 * `meta.changes` is the SQLite change count on `D1PreparedStatement.run`.
 * See https://developers.cloudflare.com/d1/worker-api/return-object/
 */
export interface D1RunMeta {
  changes?: number;
}

/** Result of `D1PreparedStatement.run`, including optional RETURNING rows. */
export interface D1RunResult {
  results?: unknown[];
  success?: boolean;
  meta?: D1RunMeta;
}

/** Prepared statement surface the handlers actually call. */
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1RunResult>;
  all(): Promise<D1Result>;
}

/** Minimal typed surface of the Cloudflare D1 binding used by the functions. */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

/** Pages Functions environment bindings. */
export interface Env {
  DB: D1Database;
  /**
   * Pages secret for the build runner. Unset or empty means claim, status
   * updates, and the job list fail closed (503). Never log this value.
   */
  RUNNER_TOKEN?: string;
}
