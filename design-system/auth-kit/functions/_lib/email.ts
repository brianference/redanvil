/**
 * Transactional email, through Brevo.
 *
 * MAIL_FROM must be an address on a domain AUTHENTICATED IN BREVO, currently
 * no-reply@txeas.com. It must NOT be a protonmail.com address.
 *
 * Sending as protonmail.com through Brevo fails DMARC by construction:
 * protonmail.com publishes `p=quarantine` with strict alignment (aspf=s,
 * adkim=s) and Brevo is not in its SPF record. Brevo logged "delivered" for two
 * messages that never reached an inbox, because the receiving server accepted
 * them and Proton then quarantined them. Verifying an individual address in
 * Brevo proves you control it; it does not authorise Brevo to send AS that
 * domain.
 *
 * Three further traps, recorded in
 * scholarship-one/docs/EMAIL-DELIVERABILITY-RUNBOOK.md:
 *   - Brevo's "Authorized IPs" must stay OFF; a serverless sender has no fixed IP.
 *   - A messageId means queued, not delivered. Confirm real delivery against
 *     /v3/smtp/statistics/events.
 *   - Domain authentication is dashboard-only on the free tier.
 */
import type { Env } from './types'
import { APP } from './appconfig'

export type SendResult = { sent: boolean; stubbed?: boolean; error?: string }

function parseSender(from: string): { name: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  // Under noUncheckedIndexedAccess a capture group is string | undefined, and a
  // sender with no address is not usable anyway, so fall through to the bare form.
  if (m && m[2]) return { name: m[1] || APP.name, email: m[2] }
  return { name: APP.name, email: from }
}

/**
 * Derive a plain-text alternative from the HTML body. An HTML-only message with
 * no text/plain part is a well-known spam-filter penalty, so every send ships both.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Send one message. Never throws: a mail outage must not turn a registration or
 * a reset into an error that tells the caller something went wrong, because the
 * generic response is what stops the endpoint enumerating accounts. Failures are
 * returned for the caller to log server-side instead.
 */
export async function sendEmail(env: Env, to: string, subject: string, html: string): Promise<SendResult> {
  const key = env.BREVO_API_KEY
  const from = env.MAIL_FROM || 'no-reply@txeas.com'
  if (!key) {
    // Local / unconfigured: never send, just log so dev flows work.
    console.log(`[email stub] to=${to} subject=${subject}`)
    return { sent: false, stubbed: true }
  }
  const sender = parseSender(from)
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: htmlToText(html),
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      const error = `brevo ${res.status}: ${text.slice(0, 200)}`
      // Callers deliberately return 200 regardless, so a failed send is otherwise
      // invisible. Surface it in `wrangler pages deployment tail`.
      console.error(`[email] send failed to=${to} subject=${subject} ${error}`)
      return { sent: false, error }
    }
    return { sent: true }
  } catch (err) {
    console.error(`[email] send threw to=${to} subject=${subject}`, err)
    return { sent: false, error: String(err) }
  }
}

const wrap = (inner: string) =>
  `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:${APP.textColor}">
     <h2 style="color:${APP.brandColor};margin:0 0 12px">${APP.name}</h2>${inner}
     <p style="color:${APP.mutedColor};font-size:12px;margin-top:24px">${APP.accountPurpose}</p>
   </div>`

const button = (href: string, label: string) =>
  `<p><a href="${href}" style="display:inline-block;background:${APP.brandColor};color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600">${label}</a></p>`

/** Sent immediately after registration. The account works before it is confirmed. */
export function verifyEmailHtml(link: string): string {
  return wrap(
    `<p>Confirm this address so you can recover your account if you forget your password:</p>
     ${button(link, 'Confirm my email')}
     <p style="color:${APP.mutedColor};font-size:13px">This link expires in 24 hours. If you didn't create an account, ignore this email and nothing further will happen.</p>`,
  )
}

export function magicLinkHtml(link: string): string {
  return wrap(
    `<p>Click to sign in:</p>
     ${button(link, `Sign in to ${APP.name}`)}
     <p style="color:${APP.mutedColor};font-size:13px">This link expires in 15 minutes. If you didn't request it, ignore this email.</p>`,
  )
}

export function passwordResetHtml(link: string): string {
  return wrap(
    `<p>Someone asked to reset the password on this account. Choose a new one:</p>
     ${button(link, 'Set a new password')}
     <p style="color:${APP.mutedColor};font-size:13px">This link expires in 60 minutes and can be used once. If you didn't request it, ignore this email — your password stays as it is.</p>`,
  )
}

/**
 * Operator notification for a Contact Us submission. The sender's address goes in
 * Reply-To semantics at the call site, never in `sender`: mailing AS a visitor's
 * domain is the same DMARC failure documented at the top of this file.
 */
export function contactNotificationHtml(m: {
  name: string
  email: string
  subject: string
  message: string
}): string {
  const escape = (v: string) =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return wrap(
    `<p><strong>${escape(m.name)}</strong> &lt;${escape(m.email)}&gt; wrote:</p>
     <p style="font-weight:600">${escape(m.subject)}</p>
     <div style="white-space:pre-wrap;border-left:3px solid ${APP.brandColor};padding-left:12px">${escape(m.message)}</div>`,
  )
}
