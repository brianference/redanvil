/** Cloudflare Pages Function bindings for this app. */
export interface Env {
  /** D1 database binding named DB in wrangler.toml. */
  DB: D1Database;
}

/** Pages Function event context with our Env. */
export type AppContext = EventContext<Env, string, Record<string, unknown>>;
