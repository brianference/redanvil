/** Cloudflare Pages Function bindings for this app. */
export interface Env {
  /** D1 database binding named DB in wrangler.toml. */
  DB: D1Database;
  /**
   * Workers AI binding (wrangler `[ai] binding = "AI"`).
   * Optional at the type level so unit tests can omit it; handlers fail closed when missing.
   */
  AI?: Ai;
}

/** Pages Function event context with our Env. */
export type AppContext = EventContext<Env, string, Record<string, unknown>>;
