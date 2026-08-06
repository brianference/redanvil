/** Cloudflare Pages Function bindings for Pet Sitter Finder. */
export interface Env {
  /** D1 database binding named DB in wrangler.toml. */
  DB: D1Database;
  /**
   * Workers AI binding (`[ai] binding = "AI"`).
   * Optional at the type level so unit tests can omit it; handlers fail closed when missing.
   */
  AI?: Ai;
  /** HMAC secret for session tokens (Cloudflare secret). Falls back in local dev only. */
  SESSION_SECRET?: string;
}

/** Pages Function event context with our Env. */
export type AppContext = EventContext<Env, string, Record<string, unknown>>;
