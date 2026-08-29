/** POST /api/auth/confirm { token } — redeem an email confirmation link. */
import type { FnCtx } from '../../_lib/types'
import { json } from '../../_lib/http'
import { confirmEmail } from '../../_lib/verification'
import { guard } from '../../_lib/ratelimit'

export async function onRequestPost({ request, env }: FnCtx) {
  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Send a valid JSON body.' }, 400)
  }
  const token = String(body?.token || '')
  if (!token) return json({ error: 'This confirmation link is missing its token.' }, 400)

  // IP-only: the token is the subject here, and rate-limiting by token would let
  // an attacker exhaust a real user's budget by replaying their link.
  const limited = await guard(env, request, 'confirm')
  if (limited) return limited

  const result = await confirmEmail(env, token)
  if (!result.ok) {
    return json({ error: 'This confirmation link is invalid or has expired. Request a new one from your profile.' }, 400)
  }
  return json({ ok: true, email: result.email })
}
