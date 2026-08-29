/**
 * Fixed-window rate limiting backed by D1.
 *
 * Identifiers (IP, email) are salted and hashed before storage, so the table
 * never holds a raw address or an address-to-email mapping.
 */
import type { Env } from './types'
import { sha256hex } from './auth'
import { json } from './http'

export const WINDOW_MS = 15 * 60 * 1000

/**
 * Per-account limit. This is the real credential-stuffing control: an attacker
 * guessing one account's password is stopped after five tries.
 */
export const MAX_PER_SUBJECT = 5

/**
 * Per-IP limit, deliberately much looser. Students share NAT on school, campus,
 * and library networks, so a tight per-IP cap would let one person fumbling
 * their password lock out everyone else behind the same address. This is a
 * bulk-abuse backstop, not the primary control.
 */
export const MAX_PER_IP = 60

/** Caller IP as seen by Cloudflare. Falls back to a constant so the limit still applies. */
export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown'
}

async function bucketKey(env: Env, endpoint: string, identifier: string): Promise<string> {
  return sha256hex(`${endpoint}|${env.RATE_LIMIT_SALT || 'so-dev-salt'}|${identifier}`)
}

/**
 * Count one attempt against `identifier` for `endpoint`.
 * Returns whether the caller is still allowed and how many tries remain.
 */
export async function consume(
  env: Env,
  endpoint: string,
  identifier: string,
  max = MAX_PER_SUBJECT,
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const key = await bucketKey(env, endpoint, identifier)
  const now = Date.now()
  const row = await env.DB.prepare('select window_start as windowStart, count from rate_limits where bucket = ?')
    .bind(key)
    .first<{ windowStart: number; count: number }>()

  // No row, or the previous window has fully elapsed: start a fresh window.
  if (!row || now - row.windowStart >= WINDOW_MS) {
    await env.DB.prepare(
      `insert into rate_limits (bucket, window_start, count) values (?, ?, 1)
       on conflict(bucket) do update set window_start = excluded.window_start, count = 1`,
    )
      .bind(key, now)
      .run()
    return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 }
  }

  const count = row.count + 1
  await env.DB.prepare('update rate_limits set count = ? where bucket = ?').bind(count, key).run()
  const retryAfterSeconds = Math.max(1, Math.ceil((row.windowStart + WINDOW_MS - now) / 1000))
  return { allowed: count <= max, remaining: Math.max(0, max - count), retryAfterSeconds }
}

/**
 * Apply the limit to both the caller IP and a subject (usually the email).
 * Returns a 429 Response when either bucket is exhausted, otherwise null.
 */
export async function guard(
  env: Env,
  request: Request,
  endpoint: string,
  subject?: string,
): Promise<Response | null> {
  const checks = [await consume(env, `${endpoint}:ip`, clientIp(request), MAX_PER_IP)]
  if (subject) checks.push(await consume(env, `${endpoint}:subject`, subject, MAX_PER_SUBJECT))
  const blocked = checks.find((c) => !c.allowed)
  if (!blocked) return null
  return json(
    { error: 'Too many attempts. Wait a few minutes and try again.' },
    429,
    { 'Retry-After': String(blocked.retryAfterSeconds) },
  )
}

/**
 * Clear a subject's window after a successful authentication.
 *
 * Without this, signing in legitimately eats the same budget as guessing: a
 * student signing in on a phone, a laptop, and a library machine would spend
 * three of five attempts and could lock themselves out. The limit exists to
 * stop repeated *failures*, so success resets it.
 */
export async function clearSubject(env: Env, endpoint: string, subject: string): Promise<void> {
  const key = await bucketKey(env, `${endpoint}:subject`, subject)
  await env.DB.prepare('delete from rate_limits where bucket = ?').bind(key).run()
}

/** Drop windows that have long since expired. Called opportunistically. */
export async function sweep(env: Env): Promise<void> {
  await env.DB.prepare('delete from rate_limits where window_start < ?')
    .bind(Date.now() - WINDOW_MS * 4)
    .run()
}
