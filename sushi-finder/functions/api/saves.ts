/** GET/POST/DELETE/PATCH /api/saves — the signed-in person's saved sushi places. */
import { z } from 'zod'
import type { Session } from '../_lib/auth'
import { getSession } from '../_lib/auth'
import { json } from '../_lib/http'
import type { Env, FnCtx } from '../_lib/types'
import { parseBody } from '../_lib/validate'

const saveSchema = z.object({
  sushiId: z.string().trim().min(1).max(80),
})

const patchSchema = z.object({
  sushiId: z.string().trim().min(1).max(80),
  beenThere: z.boolean(),
})

/** Joined saved-place row as returned to the client. */
type SavedPlaceRow = {
  sushiId: string
  title: string
  city: string
  style: string
  photoUrl: string
  savedAt: number
  beenThere: number
  visitedAt: number | null
  notes: string | null
}

const LIST_SAVED = `select
    sp.sushi_id as sushiId,
    s.title as title,
    coalesce(s.city, '') as city,
    coalesce(s.style, '') as style,
    coalesce(s.photo_url, '') as photoUrl,
    sp.saved_at as savedAt,
    sp.been_there as beenThere,
    sp.visited_at as visitedAt,
    sp.notes as notes
  from saved_places sp
  join sushis s on s.id = sp.sushi_id
 where sp.user_id = ?
 order by sp.saved_at desc`

const ONE_SAVED = `select
    sp.sushi_id as sushiId,
    s.title as title,
    coalesce(s.city, '') as city,
    coalesce(s.style, '') as style,
    coalesce(s.photo_url, '') as photoUrl,
    sp.saved_at as savedAt,
    sp.been_there as beenThere,
    sp.visited_at as visitedAt,
    sp.notes as notes
  from saved_places sp
  join sushis s on s.id = sp.sushi_id
 where sp.user_id = ? and sp.sushi_id = ?`

/**
 * Shape a D1 row into the public JSON contract (booleans, not 0/1).
 *
 * @param row - Joined saved_places + sushis row.
 */
function toSavedPlace(row: SavedPlaceRow) {
  return {
    sushiId: row.sushiId,
    title: row.title,
    city: row.city,
    style: row.style,
    photoUrl: row.photoUrl,
    savedAt: row.savedAt,
    beenThere: row.beenThere === 1,
    visitedAt: row.visitedAt,
    notes: row.notes,
  }
}

/**
 * Load one saved place for a user, or null when it is not on their list.
 *
 * @param env - Worker bindings.
 * @param userId - Session user id.
 * @param sushiId - Catalog id.
 */
async function loadSaved(env: Env, userId: string, sushiId: string): Promise<SavedPlaceRow | null> {
  return env.DB.prepare(ONE_SAVED).bind(userId, sushiId).first<SavedPlaceRow>()
}

/**
 * Require a signed-in session, or a 401 JSON response.
 *
 * @param env - Worker bindings.
 * @param request - Incoming request (cookie).
 */
async function requireSession(env: Env, request: Request): Promise<Session | Response> {
  const session = await getSession(env, request)
  if (!session) return json({ error: 'Sign in to manage saved places.' }, 401)
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
 * GET /api/saves — list saved places for the session user, newest first.
 */
export async function onRequestGet({ request, env }: FnCtx) {
  const session = await requireSession(env, request)
  if (isResponse(session)) return session

  const result = await env.DB.prepare(LIST_SAVED).bind(session.userId).all<SavedPlaceRow>()
  return json({ items: (result.results ?? []).map(toSavedPlace) })
}

/**
 * POST /api/saves `{ sushiId }` — save a catalog place for the session user.
 */
export async function onRequestPost({ request, env }: FnCtx) {
  const session = await requireSession(env, request)
  if (isResponse(session)) return session

  const parsed = await parseBody(request, saveSchema)
  if (!parsed.ok) return parsed.response
  const { sushiId } = parsed.data

  const existing = await loadSaved(env, session.userId, sushiId)
  if (existing) return json(toSavedPlace(existing))

  try {
    await env.DB.prepare(
      'insert into saved_places (user_id, sushi_id, saved_at, been_there) values (?, ?, ?, 0)',
    )
      .bind(session.userId, sushiId, Date.now())
      .run()
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (/foreign key/i.test(message) || /constraint/i.test(message)) {
      return json({ error: 'That sushi is not in the catalog.' }, 404)
    }
    return json({ error: 'Could not save that place.' }, 500)
  }

  const row = await loadSaved(env, session.userId, sushiId)
  if (!row) return json({ error: 'Could not save that place.' }, 500)
  return json(toSavedPlace(row), 201)
}

/**
 * DELETE /api/saves `{ sushiId }` — remove a place from the session user's list.
 */
export async function onRequestDelete({ request, env }: FnCtx) {
  const session = await requireSession(env, request)
  if (isResponse(session)) return session

  const parsed = await parseBody(request, saveSchema)
  if (!parsed.ok) return parsed.response
  const { sushiId } = parsed.data

  await env.DB.prepare('delete from saved_places where user_id = ? and sushi_id = ?')
    .bind(session.userId, sushiId)
    .run()
  return json({ ok: true })
}

/**
 * PATCH /api/saves `{ sushiId, beenThere }` — mark a saved place as visited or not.
 */
export async function onRequestPatch({ request, env }: FnCtx) {
  const session = await requireSession(env, request)
  if (isResponse(session)) return session

  const parsed = await parseBody(request, patchSchema)
  if (!parsed.ok) return parsed.response
  const { sushiId, beenThere } = parsed.data

  const existing = await env.DB.prepare(
    'select sushi_id as sushiId from saved_places where user_id = ? and sushi_id = ?',
  )
    .bind(session.userId, sushiId)
    .first<{ sushiId: string }>()
  if (!existing) return json({ error: 'That place is not on your list.' }, 404)

  const visitedAt = beenThere ? Date.now() : null
  await env.DB.prepare(
    'update saved_places set been_there = ?, visited_at = ? where user_id = ? and sushi_id = ?',
  )
    .bind(beenThere ? 1 : 0, visitedAt, session.userId, sushiId)
    .run()

  const row = await loadSaved(env, session.userId, sushiId)
  if (!row) return json({ error: 'That place is not on your list.' }, 404)
  return json(toSavedPlace(row))
}
