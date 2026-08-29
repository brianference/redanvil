/** GET/POST/DELETE/PATCH /api/shortlist — profile + the session user's sitter shortlist. */
import { z } from 'zod'
import type { Session } from '../_lib/auth'
import { getSession } from '../_lib/auth'
import { json } from '../_lib/http'
import type { Env, FnCtx } from '../_lib/types'
import { parseBody } from '../_lib/validate'

const sitterIdSchema = z.string().trim().min(1).max(80)

const addSchema = z.object({
  sitter_id: sitterIdSchema,
  note: z.string().trim().max(500).optional(),
})

const removeSchema = z.object({
  sitter_id: sitterIdSchema,
})

const profileSchema = z
  .object({
    display_name: z.string().trim().min(1, 'Enter a display name.').max(80).optional(),
    role: z.enum(['owner', 'sitter']).optional(),
  })
  .refine((value) => value.display_name !== undefined || value.role !== undefined, {
    message: 'Set a display name or a role.',
  })

/** Joined shortlist + sitter row as returned to the client. */
type ShortlistRow = {
  sitter_id: string
  name: string
  neighbourhood: string
  rate_per_night: number
  added_at: number
  note: string | null
}

/** Account profile fields stored on users. */
type ProfileRow = {
  display_name: string | null
  role: string | null
}

const LIST_ITEMS = `select
    sl.sitter_id as sitter_id,
    s.name as name,
    s.neighbourhood as neighbourhood,
    s.rate_per_night as rate_per_night,
    sl.added_at as added_at,
    sl.note as note
  from shortlist sl
  join sitter s on s.id = sl.sitter_id
 where sl.user_id = ?
 order by sl.added_at desc`

const ONE_ITEM = `select
    sl.sitter_id as sitter_id,
    s.name as name,
    s.neighbourhood as neighbourhood,
    s.rate_per_night as rate_per_night,
    sl.added_at as added_at,
    sl.note as note
  from shortlist sl
  join sitter s on s.id = sl.sitter_id
 where sl.user_id = ? and sl.sitter_id = ?`

/**
 * Require a signed-in session, or a 401 JSON response.
 *
 * @param env - Worker bindings.
 * @param request - Incoming request (cookie).
 */
async function requireSession(env: Env, request: Request): Promise<Session | Response> {
  const session = await getSession(env, request)
  if (!session) return json({ error: 'Sign in to manage your shortlist.' }, 401)
  return session
}

/**
 * True when `value` is a Response, not a Session.
 *
 * @param value - Session or 401 response.
 */
function isResponse(value: Session | Response): value is Response {
  return value instanceof Response
}

/**
 * Load the session user's display name and marketplace role.
 *
 * @param env - Worker bindings.
 * @param userId - Session user id.
 */
async function loadProfile(env: Env, userId: string): Promise<{ display_name: string | null; role: 'owner' | 'sitter' | null }> {
  const row = await env.DB.prepare(
    'select display_name as display_name, role as role from users where id = ?',
  )
    .bind(userId)
    .first<ProfileRow>()
  const role = row?.role === 'owner' || row?.role === 'sitter' ? row.role : null
  return { display_name: row?.display_name ?? null, role }
}

/**
 * Load one shortlist row for a user, or null when it is not on their list.
 *
 * @param env - Worker bindings.
 * @param userId - Session user id.
 * @param sitterId - Catalog sitter id.
 */
async function loadItem(env: Env, userId: string, sitterId: string): Promise<ShortlistRow | null> {
  return env.DB.prepare(ONE_ITEM).bind(userId, sitterId).first<ShortlistRow>()
}

/**
 * GET /api/shortlist — profile plus shortlisted sitters for the session user.
 */
export async function onRequestGet({ request, env }: FnCtx) {
  const session = await requireSession(env, request)
  if (isResponse(session)) return session

  const profile = await loadProfile(env, session.userId)
  const result = await env.DB.prepare(LIST_ITEMS).bind(session.userId).all<ShortlistRow>()
  return json({ profile, items: result.results ?? [] })
}

/**
 * POST /api/shortlist `{ sitter_id, note? }` — add a sitter to the session user's list.
 */
export async function onRequestPost({ request, env }: FnCtx) {
  const session = await requireSession(env, request)
  if (isResponse(session)) return session

  const parsed = await parseBody(request, addSchema)
  if (!parsed.ok) return parsed.response
  const { sitter_id: sitterId, note } = parsed.data

  const existing = await loadItem(env, session.userId, sitterId)
  if (existing) return json(existing)

  const sitter = await env.DB.prepare('select id from sitter where id = ?')
    .bind(sitterId)
    .first<{ id: string }>()
  if (!sitter) return json({ error: 'That sitter is not in the catalog.' }, 404)

  try {
    await env.DB.prepare('insert into shortlist (user_id, sitter_id, added_at, note) values (?, ?, ?, ?)')
      .bind(session.userId, sitterId, Date.now(), note ?? null)
      .run()
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (/foreign key/i.test(message) || /constraint/i.test(message)) {
      return json({ error: 'That sitter is not in the catalog.' }, 404)
    }
    return json({ error: 'Could not add that sitter to your shortlist.' }, 500)
  }

  const row = await loadItem(env, session.userId, sitterId)
  if (!row) return json({ error: 'Could not add that sitter to your shortlist.' }, 500)
  return json(row, 201)
}

/**
 * DELETE /api/shortlist `{ sitter_id }` — remove a sitter from the session user's list.
 */
export async function onRequestDelete({ request, env }: FnCtx) {
  const session = await requireSession(env, request)
  if (isResponse(session)) return session

  const parsed = await parseBody(request, removeSchema)
  if (!parsed.ok) return parsed.response
  const { sitter_id: sitterId } = parsed.data

  await env.DB.prepare('delete from shortlist where user_id = ? and sitter_id = ?')
    .bind(session.userId, sitterId)
    .run()
  return json({ ok: true })
}

/**
 * PATCH /api/shortlist `{ display_name?, role? }` — update the session user's profile.
 */
export async function onRequestPatch({ request, env }: FnCtx) {
  const session = await requireSession(env, request)
  if (isResponse(session)) return session

  const parsed = await parseBody(request, profileSchema)
  if (!parsed.ok) return parsed.response
  const { display_name: displayName, role } = parsed.data

  if (displayName !== undefined && role !== undefined) {
    await env.DB.prepare('update users set display_name = ?, role = ?, updated_at = ? where id = ?')
      .bind(displayName, role, Date.now(), session.userId)
      .run()
  } else if (displayName !== undefined) {
    await env.DB.prepare('update users set display_name = ?, updated_at = ? where id = ?')
      .bind(displayName, Date.now(), session.userId)
      .run()
  } else if (role !== undefined) {
    await env.DB.prepare('update users set role = ?, updated_at = ? where id = ?')
      .bind(role, Date.now(), session.userId)
      .run()
  }

  const profile = await loadProfile(env, session.userId)
  return json({ profile })
}
