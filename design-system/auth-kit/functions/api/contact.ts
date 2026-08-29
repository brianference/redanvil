/** POST /api/contact — store a Contact Us message and notify the operator. */
import type { FnCtx } from '../_lib/types'
import { json } from '../_lib/http'
import { getSession } from '../_lib/auth'
import { contactNotificationHtml, sendEmail } from '../_lib/email'
import { contactSchema, parseBody } from '../_lib/validate'
import { guard } from '../_lib/ratelimit'
import { APP } from '../_lib/appconfig'
import { APP_INSERT_COL, APP_INSERT_VAL } from '../_lib/tenancy'

/** Where submissions are delivered. Overridable per app without touching code. */
const DEFAULT_OPERATOR_EMAIL = 'brianference@protonmail.com'

export async function onRequestPost({ request, env }: FnCtx) {
  const parsed = await parseBody(request, contactSchema)
  if (!parsed.ok) return parsed.response
  const { name, email, subject, message, website } = parsed.data

  // Honeypot tripped: answer exactly like success so the bot learns nothing.
  if (website) return json({ ok: true })

  const limited = await guard(env, request, 'contact', email)
  if (limited) return limited

  const session = await getSession(env, request)
  const id = crypto.randomUUID()

  // Persist first. If Brevo is down or unconfigured the message is still kept,
  // which is why `delivered` is tracked separately.
  await env.DB.prepare(
    `insert into contact_messages (${APP_INSERT_COL}id, name, email, subject, message, user_id, created_at, delivered)
     values (${APP_INSERT_VAL}?, ?, ?, ?, ?, ?, ?, 0)`,
  )
    .bind(...(APP.scope ? [APP.scope] : []), id, name, email, subject, message, session?.userId ?? null, Date.now())
    .run()

  const result = await sendEmail(
    env,
    env.CONTACT_TO || DEFAULT_OPERATOR_EMAIL,
    `[${APP.name}] ${subject}`,
    contactNotificationHtml({ name, email, subject, message }),
  )
  if (result.sent) {
    await env.DB.prepare('update contact_messages set delivered = 1 where id = ?').bind(id).run()
  }

  // The message is safely stored either way, so the sender always sees success.
  return json({ ok: true })
}
