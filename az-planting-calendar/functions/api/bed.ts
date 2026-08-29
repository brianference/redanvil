/** GET/POST/DELETE /api/bed — the signed-in gardener's garden bed. */
import { z } from 'zod'
import type { Session } from '../_lib/auth'
import { getSession } from '../_lib/auth'
import { json } from '../_lib/http'
import type { Env, FnCtx } from '../_lib/types'
import { parseBody } from '../_lib/validate'
import {
  dateToHalfMonth,
  halfMonthLabel,
  halfMonthOffset,
  nextPlantableHalfMonth,
} from '../../src/lib/halfMonth'

const addSchema = z.object({
  cropId: z.string().trim().min(1).max(80),
  zone: z.string().trim().min(1).max(80),
})

const removeSchema = z.object({
  cropId: z.string().trim().min(1).max(80),
})

/** Joined garden_bed + crop + zone row as returned from D1. */
type BedRow = {
  cropId: string
  cropName: string
  zone: string
  zoneName: string | null
  usdaZone: string | null
  addedAt: number
  plantedAt: number | null
  notes: string | null
}

/** One planting_windows row scoped to the session user's bed. */
type WindowRow = {
  cropId: string
  startHalf: number
  endHalf: number
  method: 'S' | 'T'
}

const LIST_BED = `select
    gb.crop_id as cropId,
    c.name as cropName,
    gb.zone as zone,
    z.name as zoneName,
    z.usda_zone as usdaZone,
    gb.added_at as addedAt,
    gb.planted_at as plantedAt,
    gb.notes as notes
  from garden_bed gb
  join crops c on c.id = gb.crop_id
  left join zones z on z.id = gb.zone
 where gb.user_id = ?`

const LIST_WINDOWS = `select
    pw.crop_id as cropId,
    pw.start_half_month as startHalf,
    pw.end_half_month as endHalf,
    pw.method as method
  from planting_windows pw
  join garden_bed gb on gb.crop_id = pw.crop_id
 where gb.user_id = ?`

const ONE_BED = `select
    gb.crop_id as cropId,
    c.name as cropName,
    gb.zone as zone,
    z.name as zoneName,
    z.usda_zone as usdaZone,
    gb.added_at as addedAt,
    gb.planted_at as plantedAt,
    gb.notes as notes
  from garden_bed gb
  join crops c on c.id = gb.crop_id
  left join zones z on z.id = gb.zone
 where gb.user_id = ? and gb.crop_id = ?`

/**
 * Require a signed-in session, or a 401 JSON response.
 *
 * @param env - Worker bindings.
 * @param request - Incoming request (cookie).
 */
async function requireSession(env: Env, request: Request): Promise<Session | Response> {
  const session = await getSession(env, request)
  if (!session) return json({ error: 'Sign in to manage your garden bed.' }, 401)
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
 * Load planting windows for every crop on this user's bed.
 *
 * @param env - Worker bindings.
 * @param userId - Session user id.
 */
async function loadWindows(env: Env, userId: string): Promise<WindowRow[]> {
  const result = await env.DB.prepare(LIST_WINDOWS).bind(userId).all<WindowRow>()
  return result.results ?? []
}

/**
 * Shape a bed row plus its windows into the public JSON contract.
 *
 * @param row - Joined garden_bed row.
 * @param windows - Planting windows for this crop.
 * @param nowHalf - Current half-month index.
 */
export function toBedItem(row: BedRow, windows: WindowRow[], nowHalf: number) {
  const bounds = windows.map((w) => ({
    start_half_month: w.startHalf,
    end_half_month: w.endHalf,
  }))
  const nextHalf = nextPlantableHalfMonth(bounds, nowHalf)
  return {
    cropId: row.cropId,
    cropName: row.cropName,
    zone: row.zone,
    zoneName: row.zoneName,
    usdaZone: row.usdaZone,
    addedAt: row.addedAt,
    plantedAt: row.plantedAt,
    notes: row.notes,
    nextHalfMonth: nextHalf,
    nextHalfMonthLabel: nextHalf == null ? null : halfMonthLabel(nextHalf),
    inWindow: nextHalf === nowHalf,
    windows: windows
      .slice()
      .sort((a, b) => a.startHalf - b.startHalf)
      .map((w) => ({
        start_half_month: w.startHalf,
        end_half_month: w.endHalf,
        method: w.method,
        startLabel: halfMonthLabel(w.startHalf),
        endLabel: halfMonthLabel(w.endHalf),
      })),
  }
}

/**
 * Sort bed items by soonest planting window, then by crop name.
 *
 * @param items - Unsorted bed items.
 * @param nowHalf - Current half-month index.
 */
export function sortBedItems<T extends { nextHalfMonth: number | null; cropName: string }>(
  items: T[],
  nowHalf: number,
): T[] {
  return items.slice().sort((a, b) => {
    if (a.nextHalfMonth == null && b.nextHalfMonth == null) {
      return a.cropName.localeCompare(b.cropName)
    }
    if (a.nextHalfMonth == null) return 1
    if (b.nextHalfMonth == null) return -1
    const delta =
      halfMonthOffset(nowHalf, a.nextHalfMonth) - halfMonthOffset(nowHalf, b.nextHalfMonth)
    if (delta !== 0) return delta
    return a.cropName.localeCompare(b.cropName)
  })
}

/**
 * Load one bed row and its windows, shaped for the client.
 *
 * @param env - Worker bindings.
 * @param userId - Session user id.
 * @param cropId - Crop id.
 * @param nowHalf - Current half-month index.
 */
async function loadBedItem(env: Env, userId: string, cropId: string, nowHalf: number) {
  const row = await env.DB.prepare(ONE_BED).bind(userId, cropId).first<BedRow>()
  if (!row) return null
  const allWindows = await loadWindows(env, userId)
  const windows = allWindows.filter((w) => w.cropId === cropId)
  return toBedItem(row, windows, nowHalf)
}

/**
 * GET /api/bed — list the session user's garden bed, next planting window first.
 */
export async function onRequestGet({ request, env }: FnCtx) {
  const session = await requireSession(env, request)
  if (isResponse(session)) return session

  const nowHalf = dateToHalfMonth(new Date())
  const listed = await env.DB.prepare(LIST_BED).bind(session.userId).all<BedRow>()
  const rows = listed.results ?? []
  const windows = await loadWindows(env, session.userId)
  const byCrop = new Map<string, WindowRow[]>()
  for (const w of windows) {
    const list = byCrop.get(w.cropId)
    if (list) list.push(w)
    else byCrop.set(w.cropId, [w])
  }
  const items = sortBedItems(
    rows.map((row) => toBedItem(row, byCrop.get(row.cropId) ?? [], nowHalf)),
    nowHalf,
  )
  return json({ items })
}

/**
 * POST /api/bed `{ cropId, zone }` — add a crop for the session user.
 */
export async function onRequestPost({ request, env }: FnCtx) {
  const session = await requireSession(env, request)
  if (isResponse(session)) return session

  const parsed = await parseBody(request, addSchema)
  if (!parsed.ok) return parsed.response
  const { cropId, zone } = parsed.data

  const nowHalf = dateToHalfMonth(new Date())
  const existing = await loadBedItem(env, session.userId, cropId, nowHalf)
  if (existing) return json(existing)

  const crop = await env.DB.prepare('select id from crops where id = ?')
    .bind(cropId)
    .first<{ id: string }>()
  if (!crop) return json({ error: 'That crop is not in this calendar.' }, 404)

  const zoneRow = await env.DB.prepare('select id from zones where id = ?')
    .bind(zone)
    .first<{ id: string }>()
  if (!zoneRow) return json({ error: 'Pick a planning zone that this calendar covers.' }, 400)

  try {
    await env.DB.prepare(
      'insert into garden_bed (user_id, crop_id, zone, added_at) values (?, ?, ?, ?)',
    )
      .bind(session.userId, cropId, zone, Date.now())
      .run()
  } catch {
    return json({ error: 'Could not add that crop to your bed.' }, 500)
  }

  const row = await loadBedItem(env, session.userId, cropId, nowHalf)
  if (!row) return json({ error: 'Could not add that crop to your bed.' }, 500)
  return json(row, 201)
}

/**
 * DELETE /api/bed `{ cropId }` — remove a crop from the session user's bed.
 */
export async function onRequestDelete({ request, env }: FnCtx) {
  const session = await requireSession(env, request)
  if (isResponse(session)) return session

  const parsed = await parseBody(request, removeSchema)
  if (!parsed.ok) return parsed.response
  const { cropId } = parsed.data

  await env.DB.prepare('delete from garden_bed where user_id = ? and crop_id = ?')
    .bind(session.userId, cropId)
    .run()
  return json({ ok: true })
}
