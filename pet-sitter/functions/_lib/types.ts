// Minimal Cloudflare D1 + env typings for Pages Functions (functions/ is not in the
// app tsconfig, so these are for local clarity; wrangler's esbuild strips them).

export interface D1PreparedStatement {
  bind(...vals: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>
  run(): Promise<{ success: boolean }>
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }>
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>
}

export interface Env {
  DB: D1Database
  BREVO_API_KEY?: string
  /** Sender address. MUST be on a Brevo-authenticated domain: no-reply@txeas.com. */
  MAIL_FROM?: string
  SITE_URL?: string
  /** Destination for Contact Us submissions. Defaults to the operator address. */
  CONTACT_TO?: string
  RATE_LIMIT_SALT?: string
  /** When '1', /api/auth/request returns the magic link in the response (LOCAL DEV ONLY). */
  EXPOSE_DEV_MAGIC_LINK?: string
}

export type FnCtx = { request: Request; env: Env }
