/** POST /api/auth/password/reset-request { email } — email a one-time reset link. */
import type { FnCtx } from '../../../_lib/types'
import { json } from '../../../_lib/http'
import { randomToken, sha256hex } from '../../../_lib/auth'
import { passwordResetHtml, sendEmail } from '../../../_lib/email'
import { parseBody, resetRequestSchema } from '../../../_lib/validate'
import { guard } from '../../../_lib/ratelimit'
import { APP } from '../../../_lib/appconfig'

const RESET_TTL_MS = 60 * 60 * 1000

export async function onRequestPost({ request, env }: FnCtx) {
  const parsed = await parseBody(request, resetRequestSchema)
  if (!parsed.ok) return parsed.response
  const { email } = parsed.data

  const limited = await guard(env, request, 'reset-request', email)
  if (limited) return limited

  const user = await env.DB.prepare('select id from users where email = ?').bind(email).first<{ id: string }>()

  // Only send when the account exists, but always answer 200 with the same body,
  // so the endpoint cannot be used to discover which emails are registered.
  if (user) {
    const token = randomToken(32)
    await env.DB.prepare('insert into password_resets (token_hash, user_id, expires_at) values (?, ?, ?)')
      .bind(await sha256hex(token), user.id, Date.now() + RESET_TTL_MS)
      .run()
    const origin = env.SITE_URL || new URL(request.url).origin
    await sendEmail(env, email, `Reset your ${APP.name} password`, passwordResetHtml(`${origin}/reset?token=${token}`))
  }

  return json({ ok: true })
}
