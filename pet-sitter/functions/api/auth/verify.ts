/** POST /api/auth/verify { token } — redeem a magic link, set a session cookie. */
import type { FnCtx } from '../../_lib/types'
import { json, sessionCookie } from '../../_lib/http'
import { randomToken, sha256hex } from '../../_lib/auth'

const SESSION_TTL_SECONDS = 60 * 24 * 60 * 60 // 60 days

export async function onRequestPost({ request, env }: FnCtx) {
  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  const token = String(body?.token || '')
  if (!token) return json({ error: 'token required' }, 400)

  const now = Date.now()
  const hash = await sha256hex(token)
  const row = await env.DB.prepare(
    'select user_id as userId, expires_at as expiresAt, used_at as usedAt from auth_tokens where token_hash = ?',
  )
    .bind(hash)
    .first<{ userId: string; expiresAt: number; usedAt: number | null }>()

  if (!row || row.usedAt || row.expiresAt < now) {
    return json({ error: 'invalid or expired link' }, 400)
  }

  await env.DB.prepare('update auth_tokens set used_at = ? where token_hash = ?').bind(now, hash).run()

  const sid = randomToken(24)
  await env.DB.prepare('insert into sessions (id, user_id, created_at, expires_at) values (?, ?, ?, ?)')
    .bind(sid, row.userId, now, now + SESSION_TTL_SECONDS * 1000)
    .run()

  const user = await env.DB.prepare('select email from users where id = ?').bind(row.userId).first<{ email: string }>()
  return json({ ok: true, email: user?.email || null }, 200, { 'Set-Cookie': sessionCookie(sid, SESSION_TTL_SECONDS) })
}
