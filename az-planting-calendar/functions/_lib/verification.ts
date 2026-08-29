/**
 * Email confirmation: issue a token, mail the link, redeem it.
 *
 * Confirmation is deliberately NOT a gate on using the account. Blocking sign-in
 * until an email arrives means a Brevo outage locks every new user out of a
 * product that otherwise works. What confirmation buys is a recoverable address:
 * password reset only mails a confirmed address, so an unconfirmed typo cannot
 * be used to send a reset link to a stranger.
 */
import type { Env } from './types'
import { randomToken, sha256hex } from './auth'
import { sendEmail, verifyEmailHtml } from './email'
import { APP } from './appconfig'

export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Create a confirmation token and email it. Returns the send result so the
 * caller can log a failure; callers must not surface it, because a registration
 * that reports "we could not email you" is a slower way of saying the address
 * exists.
 */
export async function sendVerificationEmail(env: Env, userId: string, email: string) {
  const token = randomToken(32)
  const hash = await sha256hex(token)
  const now = Date.now()

  // One live token per account: re-registering or asking again invalidates the
  // previous link rather than leaving a widening set of valid tokens in inboxes.
  await env.DB.prepare('delete from email_verifications where user_id = ?').bind(userId).run()
  await env.DB.prepare(
    'insert into email_verifications (token_hash, user_id, expires_at) values (?, ?, ?)',
  )
    .bind(hash, userId, now + VERIFY_TTL_MS)
    .run()

  const base = (env.SITE_URL || '').replace(/\/+$/, '')
  const link = `${base}/confirm?token=${token}`
  return sendEmail(env, email, `Confirm your email for ${APP.name}`, verifyEmailHtml(link))
}

export type ConfirmResult = { ok: true; email: string } | { ok: false; reason: 'invalid' }

/** Redeem a confirmation token. One-time: the row is marked used, not deleted. */
export async function confirmEmail(env: Env, token: string): Promise<ConfirmResult> {
  const hash = await sha256hex(token)
  const now = Date.now()
  const row = await env.DB.prepare(
    'select user_id as userId, expires_at as expiresAt, used_at as usedAt from email_verifications where token_hash = ?',
  )
    .bind(hash)
    .first<{ userId: string; expiresAt: number; usedAt: number | null }>()

  if (!row || row.usedAt || row.expiresAt < now) return { ok: false, reason: 'invalid' }

  await env.DB.prepare('update email_verifications set used_at = ? where token_hash = ?').bind(now, hash).run()
  await env.DB.prepare('update users set email_verified = 1, updated_at = ? where id = ?')
    .bind(now, row.userId)
    .run()

  const user = await env.DB.prepare('select email from users where id = ?')
    .bind(row.userId)
    .first<{ email: string }>()
  return { ok: true, email: user?.email || '' }
}
