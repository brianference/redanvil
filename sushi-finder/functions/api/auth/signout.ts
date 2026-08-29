/** POST /api/auth/signout — clear the session. */
import type { FnCtx } from '../../_lib/types'
import { json, clearSessionCookie, readSessionId } from '../../_lib/http'

export async function onRequestPost({ request, env }: FnCtx) {
  const sid = readSessionId(request)
  if (sid) await env.DB.prepare('delete from sessions where id = ?').bind(sid).run()
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() })
}
