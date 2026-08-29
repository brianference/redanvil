/** GET /api/auth/session — current signed-in user, or null. */
import type { FnCtx } from '../../_lib/types'
import { json } from '../../_lib/http'
import { getSession } from '../../_lib/auth'

export async function onRequestGet({ request, env }: FnCtx) {
  const session = await getSession(env, request)
  // Account features are usable only when email delivery is configured, because
  // password reset has no other channel.
  const enabled = Boolean(env.BREVO_API_KEY && env.BREVO_API_KEY.length > 8)
  if (!session) return json({ email: null, emailVerified: false, enabled })

  const row = await env.DB.prepare('select email_verified as verified from users where id = ?')
    .bind(session.userId)
    .first<{ verified: number }>()
  return json({ email: session.email, emailVerified: row?.verified === 1, enabled })
}
