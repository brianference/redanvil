/** POST /api/auth/register { email, password } — create a password account and sign in. */
import type { FnCtx } from '../../_lib/types'
import { json, sessionCookie } from '../../_lib/http'
import { createSession, SESSION_TTL_SECONDS } from '../../_lib/auth'
import { hashPassword } from '../../_lib/password'
import { parseBody, registerSchema } from '../../_lib/validate'
import { guard } from '../../_lib/ratelimit'
import { sendVerificationEmail } from '../../_lib/verification'

export async function onRequestPost({ request, env }: FnCtx) {
  const parsed = await parseBody(request, registerSchema)
  if (!parsed.ok) return parsed.response
  const { email, password } = parsed.data

  const limited = await guard(env, request, 'register', email)
  if (limited) return limited

  const now = Date.now()
  const existing = await env.DB.prepare('select id, password_hash as passwordHash from users where email = ?')
    .bind(email)
    .first<{ id: string; passwordHash: string | null }>()

  // An account already carrying a password is a genuine conflict. An account
  // created through the passwordless magic-link flow can adopt a password here,
  // which is how existing v4 users upgrade without being locked out.
  if (existing?.passwordHash) {
    return json({ error: 'An account with that email already exists. Sign in instead.', field: 'email' }, 409)
  }

  let hash: string
  let salt: string
  let iterations: number
  try {
    ;({ hash, salt, iterations } = await hashPassword(password))
  } catch (err) {
    // Web Crypto failures here are a server misconfiguration, not the caller's
    // fault. Log the detail and return something a person can act on, instead of
    // letting the runtime emit a bare 1101.
    console.error('password hashing failed', err)
    return json({ error: 'We could not create your account right now. Try again shortly.' }, 500)
  }

  let userId: string
  if (existing) {
    userId = existing.id
    await env.DB.prepare(
      'update users set password_hash = ?, password_salt = ?, password_iters = ?, updated_at = ? where id = ?',
    )
      .bind(hash, salt, iterations, now, userId)
      .run()
  } else {
    userId = crypto.randomUUID()
    await env.DB.prepare(
      `insert into users (id, email, created_at, updated_at, password_hash, password_salt, password_iters)
       values (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(userId, email, now, now, hash, salt, iterations)
      .run()
  }

  // Confirmation is sent but never gates the account: a mail outage must not stop
  // someone using a product that otherwise works. The failure is logged inside
  // sendVerificationEmail and deliberately not surfaced, because "we could not
  // email you" is a slower way of confirming the address exists.
  await sendVerificationEmail(env, userId, email)

  const sid = await createSession(env, userId)
  return json({ ok: true, email, emailVerified: false }, 201, {
    'Set-Cookie': sessionCookie(sid, SESSION_TTL_SECONDS),
  })
}
