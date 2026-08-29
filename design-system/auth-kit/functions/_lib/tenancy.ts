/**
 * Multi-tenant scoping for apps that share one D1 database.
 *
 * Cloudflare's free tier caps D1 at 10 databases per account, so some apps share
 * one. In a shared database `users` is unique on (app, email) rather than on
 * email, and every lookup by email MUST also filter by app -- otherwise
 * registering on one app hands you an account on its neighbours.
 *
 * These helpers are no-ops when APP.scope is undefined, which is the case for
 * every app that owns its database. Those apps keep the exact SQL they had
 * before this file existed.
 *
 * The fragments below are built from a compile-time constant, never from request
 * input, so there is no injection surface. Values are still bound, never inlined.
 */
import { APP } from './appconfig'

/** True when this app shares its database with others. */
export const IS_SHARED = typeof APP.scope === 'string' && APP.scope.length > 0

/** ` and app = ?` when shared, otherwise an empty string. */
export const APP_FILTER = IS_SHARED ? ' and app = ?' : ''

/**
 * Bind arguments for a query using APP_FILTER, appended after the caller's own.
 * Spread this so a dedicated-database app binds nothing extra.
 */
export const APP_BIND: string[] = IS_SHARED ? [APP.scope as string] : []

/** Column list fragment for inserts: `app, ` when shared, else empty. */
export const APP_INSERT_COL = IS_SHARED ? 'app, ' : ''

/** Matching placeholder for APP_INSERT_COL. */
export const APP_INSERT_VAL = IS_SHARED ? '?, ' : ''
