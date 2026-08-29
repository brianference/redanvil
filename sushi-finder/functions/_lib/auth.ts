/** Token hashing, random ids, and session lookup for the magic-link flow. */
import type { Env } from './types'
import { readSessionId } from './http'

/** Hex sha-256 of a string (Web Crypto, available in the Workers runtime). */
export async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** URL-safe random hex token. */
export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Session lifetime, shared by the magic-link and password sign-in paths. */
export const SESSION_TTL_SECONDS = 60 * 24 * 60 * 60 // 60 days

/** Issue a session row and return its id, for the Set-Cookie header. */
export async function createSession(env: Env, userId: string): Promise<string> {
  const sid = randomToken(24)
  const now = Date.now()
  await env.DB.prepare('insert into sessions (id, user_id, created_at, expires_at) values (?, ?, ?, ?)')
    .bind(sid, userId, now, now + SESSION_TTL_SECONDS * 1000)
    .run()
  return sid
}

export type Session = { userId: string; email: string }

/** Resolve the current session from the cookie, or null. */
export async function getSession(env: Env, request: Request): Promise<Session | null> {
  const sid = readSessionId(request)
  if (!sid) return null
  const row = await env.DB.prepare(
    `select s.user_id as userId, u.email as email
       from sessions s join users u on u.id = s.user_id
      where s.id = ? and s.expires_at > ?`,
  )
    .bind(sid, Date.now())
    .first<{ userId: string; email: string }>()
  return row ? { userId: row.userId, email: row.email } : null
}
