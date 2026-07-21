/** Minimal typed surface of the Cloudflare D1 binding used by the functions. */
export interface D1Result {
  results: unknown[];
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
  all(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

/** Pages Functions environment bindings. */
export interface Env {
  DB: D1Database;
}
