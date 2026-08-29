/** POST /api/auth/login { email, password } — verify a password and open a session. */
import type { FnCtx } from '../../_lib/types'
import { json, sessionCookie } from '../../_lib/http'
import { createSession, SESSION_TTL_SECONDS } from '../../_lib/auth'
import { hashPassword, needsRehash, verifyPassword } from '../../_lib/password'
import { loginSchema, parseBody } from '../../_lib/validate'
import { clearSubject, guard } from '../../_lib/ratelimit'

/** One message for every failure mode, so the endpoint cannot enumerate accounts. */
const GENERIC_FAILURE = 'That email and password combination did not match.'

export async function onRequestPost({ request, env }: FnCtx) {
  const parsed = await parseBody(request, loginSchema)
  if (!parsed.ok) return parsed.response
  const { email, password } = parsed.data

  const limited = await guard(env, request, 'login', email)
  if (limited) return limited

  const user = await env.DB.prepare(
    `select id, password_hash as hash, password_salt as salt, password_iters as iterations
       from users where email = ?`,
  )
    .bind(email)
    .first<{ id: string; hash: string | null; salt: string | null; iterations: number | null }>()

  const ok = await verifyPassword(password, {
    hash: user?.hash ?? undefined,
    salt: user?.salt ?? undefined,
    iterations: user?.iterations ?? undefined,
  })

  // verifyPassword returns false for both "no such user" and "wrong password",
  // and for magic-link-only accounts, which all surface identically here.
  if (!user || !ok) return json({ error: GENERIC_FAILURE }, 401)

  // Transparently upgrade hashes made at a lower iteration count.
  if (needsRehash({ hash: user.hash!, salt: user.salt!, iterations: user.iterations! })) {
    const next = await hashPassword(password)
    await env.DB.prepare(
      'update users set password_hash = ?, password_salt = ?, password_iters = ?, updated_at = ? where id = ?',
    )
      .bind(next.hash, next.salt, next.iterations, Date.now(), user.id)
      .run()
  }

  // Correct credentials clear the failure counter, so signing in on several
  // devices never counts toward a lockout meant to stop password guessing.
  await clearSubject(env, 'login', email)

  const sid = await createSession(env, user.id)
  return json({ ok: true, email }, 200, { 'Set-Cookie': sessionCookie(sid, SESSION_TTL_SECONDS) })
}
