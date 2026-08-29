/** POST /api/auth/password/reset { token, password } — redeem a reset link, set the new password. */
import type { FnCtx } from '../../../_lib/types'
import { json, sessionCookie } from '../../../_lib/http'
import { createSession, sha256hex, SESSION_TTL_SECONDS } from '../../../_lib/auth'
import { hashPassword } from '../../../_lib/password'
import { parseBody, resetSchema } from '../../../_lib/validate'
import { guard } from '../../../_lib/ratelimit'

export async function onRequestPost({ request, env }: FnCtx) {
  const parsed = await parseBody(request, resetSchema)
  if (!parsed.ok) return parsed.response
  const { token, password } = parsed.data

  const limited = await guard(env, request, 'reset')
  if (limited) return limited

  const now = Date.now()
  const hash = await sha256hex(token)
  const row = await env.DB.prepare(
    'select user_id as userId, expires_at as expiresAt, used_at as usedAt from password_resets where token_hash = ?',
  )
    .bind(hash)
    .first<{ userId: string; expiresAt: number; usedAt: number | null }>()

  if (!row || row.usedAt || row.expiresAt < now) {
    return json({ error: 'That reset link is invalid or has expired. Request a new one.' }, 400)
  }

  const next = await hashPassword(password)
  await env.DB.prepare('update password_resets set used_at = ? where token_hash = ?').bind(now, hash).run()
  await env.DB.prepare(
    'update users set password_hash = ?, password_salt = ?, password_iters = ?, updated_at = ? where id = ?',
  )
    .bind(next.hash, next.salt, next.iterations, now, row.userId)
    .run()

  // A password reset is the standard response to a suspected compromise, so every
  // other session for this user is dropped before the new one is issued.
  await env.DB.prepare('delete from sessions where user_id = ?').bind(row.userId).run()

  const sid = await createSession(env, row.userId)
  const user = await env.DB.prepare('select email from users where id = ?')
    .bind(row.userId)
    .first<{ email: string }>()
  return json({ ok: true, email: user?.email || null }, 200, {
    'Set-Cookie': sessionCookie(sid, SESSION_TTL_SECONDS),
  })
}
