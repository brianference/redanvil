/**
 * Parameterized D1 queries for crops, windows, sources, and zone.
 */

export interface SourceRow {
  id: string;
  title: string;
  author: string;
  publisher: string;
  url: string;
  retrieved_at: string;
}

export interface ZoneRow {
  id: string;
  name: string;
  zip: string;
  last_frost: string;
  first_frost: string;
  county: string | null;
  elevation_ft: number | null;
  /** USDA Plant Hardiness Zone (e.g. "9b", "10a"); null when not sourced. */
  usda_zone: string | null;
}

/** Source column precision for a planting window (from the cited publication). */
export type SourceGranularity = 'month' | 'half-month';

export interface CropRow {
  id: string;
  name: string;
  days_to_harvest_min: number | null;
  days_to_harvest_max: number | null;
  notes: string | null;
}

/**
 * Optional per-crop growing guidance (how to plant), always cited.
 * Null fields mean the source did not state that value -- never invented.
 */
export interface CropGuideRow {
  crop_id: string;
  depth: string | null;
  spacing_in_row: string | null;
  spacing_between_rows: string | null;
  sun: string | null;
  water: string | null;
  harvest_note: string | null;
  source_id: string;
  source_title: string;
  source_author: string;
  source_publisher: string;
  source_url: string;
  source_retrieved_at: string;
}

export interface WindowRow {
  id: string;
  crop_id: string;
  start_half_month: number;
  end_half_month: number;
  method: 'S' | 'T';
  source_id: string;
  source_granularity: SourceGranularity;
}

export interface WindowWithSource extends WindowRow {
  source_title: string;
  source_author: string;
  source_publisher: string;
  source_url: string;
  source_retrieved_at: string;
}

export const DEFAULT_ZONE_ID = 'zone-cave-creek-85331';

const ZONE_SELECT =
  'id, name, zip, last_frost, first_frost, county, elevation_ft, usda_zone';

/**
 * Load the default Cave Creek zone.
 *
 * @param db - D1 binding.
 */
export async function getDefaultZone(db: D1Database): Promise<ZoneRow | null> {
  return db
    .prepare(`SELECT ${ZONE_SELECT} FROM zones WHERE id = ?`)
    .bind(DEFAULT_ZONE_ID)
    .first<ZoneRow>();
}

/**
 * Load a zone by primary id.
 *
 * @param db - D1 binding.
 * @param id - Zone id (e.g. zone-cave-creek-85331).
 */
export async function getZoneById(
  db: D1Database,
  id: string
): Promise<ZoneRow | null> {
  return db
    .prepare(`SELECT ${ZONE_SELECT} FROM zones WHERE id = ?`)
    .bind(id)
    .first<ZoneRow>();
}

/**
 * Resolve a zone from id, ZIP, or city name fragment.
 * Prefer exact id, then exact ZIP, then case-insensitive name contains.
 *
 * @param db - D1 binding.
 * @param q - Zone id, ZIP, or city name (trimmed by caller).
 */
export async function resolveZone(
  db: D1Database,
  q: string
): Promise<ZoneRow | null> {
  const byId = await getZoneById(db, q);
  if (byId) return byId;

  const byZip = await db
    .prepare(`SELECT ${ZONE_SELECT} FROM zones WHERE zip = ?`)
    .bind(q)
    .first<ZoneRow>();
  if (byZip) return byZip;

  const byName = await db
    .prepare(
      `SELECT ${ZONE_SELECT}
       FROM zones
       WHERE name LIKE ? ESCAPE '\\'
       ORDER BY name COLLATE NOCASE
       LIMIT 1`
    )
    .bind(`%${escapeLike(q)}%`)
    .first<ZoneRow>();
  return byName;
}

/**
 * List zones, optionally filtered by city, ZIP, id, county, or state.
 * State tokens "AZ" / "Arizona" match zones whose name includes AZ/Arizona.
 *
 * @param db - D1 binding.
 * @param q - Optional search fragment (city, ZIP, county, or state).
 */
export async function listZones(
  db: D1Database,
  q?: string
): Promise<ZoneRow[]> {
  const nameFilter = q !== undefined && q.length > 0;
  if (nameFilter) {
    const token = q.trim().toLowerCase();
    if (token === 'az' || token === 'arizona') {
      const result = await db
        .prepare(
          `SELECT ${ZONE_SELECT}
           FROM zones
           WHERE name LIKE '% AZ %' ESCAPE '\\'
              OR name LIKE '% AZ(%' ESCAPE '\\'
              OR name LIKE '% AZ' ESCAPE '\\'
              OR name LIKE 'AZ %' ESCAPE '\\'
              OR name LIKE '%Arizona%' ESCAPE '\\'
           ORDER BY name COLLATE NOCASE`
        )
        .all<ZoneRow>();
      return result.results ?? [];
    }
    const like = `%${escapeLike(q)}%`;
    const result = await db
      .prepare(
        `SELECT ${ZONE_SELECT}
         FROM zones
         WHERE name LIKE ? ESCAPE '\\'
            OR zip LIKE ? ESCAPE '\\'
            OR id LIKE ? ESCAPE '\\'
            OR IFNULL(county, '') LIKE ? ESCAPE '\\'
         ORDER BY name COLLATE NOCASE`
      )
      .bind(like, like, like, like)
      .all<ZoneRow>();
    return result.results ?? [];
  }
  const result = await db
    .prepare(`SELECT ${ZONE_SELECT} FROM zones ORDER BY name COLLATE NOCASE`)
    .all<ZoneRow>();
  return result.results ?? [];
}

/**
 * Resolve optional zone query param to a zone row, defaulting to Cave Creek.
 * Returns null only when the default zone is missing from D1.
 *
 * @param db - D1 binding.
 * @param zoneParam - Optional zone id, city, or ZIP.
 * @returns Zone or an error code for a bad explicit lookup.
 */
export async function resolveZoneParam(
  db: D1Database,
  zoneParam?: string
): Promise<{ zone: ZoneRow } | { error: 'not_found' } | { error: 'default_missing' }> {
  if (zoneParam && zoneParam.trim().length > 0) {
    const found = await resolveZone(db, zoneParam.trim());
    if (!found) return { error: 'not_found' };
    return { zone: found };
  }
  const def = await getDefaultZone(db);
  if (!def) return { error: 'default_missing' };
  return { zone: def };
}

/** Half-month window predicate; values bound with four `?` (start/end pairs). */
const WINDOW_HALF_BOUNDS = `(
  (pw.start_half_month <= pw.end_half_month
    AND ? >= pw.start_half_month AND ? <= pw.end_half_month)
  OR
  (pw.start_half_month > pw.end_half_month
    AND (? >= pw.start_half_month OR ? <= pw.end_half_month))
)`;

const WINDOW_SELECT = `
  pw.id, pw.crop_id, pw.start_half_month, pw.end_half_month, pw.method, pw.source_id,
  pw.source_granularity,
  s.title AS source_title, s.author AS source_author, s.publisher AS source_publisher,
  s.url AS source_url, s.retrieved_at AS source_retrieved_at
`;

/**
 * Windows active for a half-month, with source joined.
 * Non-wrapping: start <= end AND half between them.
 * Wrapping: start > end AND (half >= start OR half <= end).
 *
 * @param db - D1 binding.
 * @param half - Current half-month 0..23.
 * @param method - Optional method filter.
 */
export async function getWindowsForHalf(
  db: D1Database,
  half: number,
  method?: 'S' | 'T'
): Promise<WindowWithSource[]> {
  // Two fixed queries so structure never interpolates a parameter value.
  const sql = method
    ? `SELECT ${WINDOW_SELECT}
       FROM planting_windows pw
       INNER JOIN sources s ON s.id = pw.source_id
       WHERE ${WINDOW_HALF_BOUNDS} AND pw.method = ?
       ORDER BY pw.crop_id, pw.method`
    : `SELECT ${WINDOW_SELECT}
       FROM planting_windows pw
       INNER JOIN sources s ON s.id = pw.source_id
       WHERE ${WINDOW_HALF_BOUNDS}
       ORDER BY pw.crop_id, pw.method`;
  const binds = method
    ? [half, half, half, half, method]
    : [half, half, half, half];
  const result = await db.prepare(sql).bind(...binds).all<WindowWithSource>();
  return result.results ?? [];
}

/**
 * All crops ordered by name, with window counts.
 * When `q` is provided, filters to crop names that contain the query
 * (case-insensitive), using a parameterized LIKE bind.
 *
 * @param db - D1 binding.
 * @param q - Optional name search fragment (already trimmed by the caller).
 */
export async function listCrops(
  db: D1Database,
  q?: string
): Promise<Array<CropRow & { window_count: number }>> {
  const nameFilter = q !== undefined && q.length > 0;
  // SQLite LIKE is case-insensitive for ASCII; ESCAPE keeps user %/_ literal.
  const sql = nameFilter
    ? `SELECT c.id, c.name, c.days_to_harvest_min, c.days_to_harvest_max, c.notes,
              COUNT(pw.id) AS window_count
       FROM crops c
       LEFT JOIN planting_windows pw ON pw.crop_id = c.id
       WHERE c.name LIKE ? ESCAPE '\\'
       GROUP BY c.id
       ORDER BY c.name COLLATE NOCASE`
    : `SELECT c.id, c.name, c.days_to_harvest_min, c.days_to_harvest_max, c.notes,
              COUNT(pw.id) AS window_count
       FROM crops c
       LEFT JOIN planting_windows pw ON pw.crop_id = c.id
       GROUP BY c.id
       ORDER BY c.name COLLATE NOCASE`;

  const stmt = db.prepare(sql);
  const result = nameFilter
    ? await stmt.bind(`%${escapeLike(q)}%`).all<CropRow & { window_count: number }>()
    : await stmt.all<CropRow & { window_count: number }>();
  return result.results ?? [];
}

/**
 * Escape LIKE wildcards in a user search fragment so % and _ are literal.
 *
 * @param value - Raw search text (not including surrounding %).
 */
export function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Single crop by id.
 *
 * @param db - D1 binding.
 * @param id - Crop id.
 */
export async function getCrop(db: D1Database, id: string): Promise<CropRow | null> {
  return db
    .prepare(
      `SELECT id, name, days_to_harvest_min, days_to_harvest_max, notes
       FROM crops WHERE id = ?`
    )
    .bind(id)
    .first<CropRow>();
}

/**
 * Optional growing guide for a crop (depth, spacing, sun, water), with citation.
 * Returns null when no sourced guide row exists -- never invent guidance.
 *
 * @param db - D1 binding.
 * @param cropId - Crop id.
 */
export async function getCropGuide(
  db: D1Database,
  cropId: string
): Promise<CropGuideRow | null> {
  return db
    .prepare(
      `SELECT
         g.crop_id, g.depth, g.spacing_in_row, g.spacing_between_rows,
         g.sun, g.water, g.harvest_note, g.source_id,
         s.title AS source_title, s.author AS source_author,
         s.publisher AS source_publisher, s.url AS source_url,
         s.retrieved_at AS source_retrieved_at
       FROM crop_guides g
       INNER JOIN sources s ON s.id = g.source_id
       WHERE g.crop_id = ?`
    )
    .bind(cropId)
    .first<CropGuideRow>();
}

/**
 * Map a guide row into the API shape (nested source object).
 *
 * @param row - Joined crop_guides + sources row.
 */
export function guideToApi(row: CropGuideRow) {
  return {
    depth: row.depth,
    spacing_in_row: row.spacing_in_row,
    spacing_between_rows: row.spacing_between_rows,
    sun: row.sun,
    water: row.water,
    harvest_note: row.harvest_note,
    source: {
      id: row.source_id,
      title: row.source_title,
      author: row.source_author,
      publisher: row.source_publisher,
      url: row.source_url,
      retrieved_at: row.source_retrieved_at
    }
  };
}

/**
 * All windows for a crop with sources.
 *
 * @param db - D1 binding.
 * @param cropId - Crop id.
 */
export async function getWindowsForCrop(
  db: D1Database,
  cropId: string
): Promise<WindowWithSource[]> {
  const result = await db
    .prepare(
      `SELECT
         pw.id, pw.crop_id, pw.start_half_month, pw.end_half_month, pw.method, pw.source_id,
         pw.source_granularity,
         s.title AS source_title, s.author AS source_author, s.publisher AS source_publisher,
         s.url AS source_url, s.retrieved_at AS source_retrieved_at
       FROM planting_windows pw
       INNER JOIN sources s ON s.id = pw.source_id
       WHERE pw.crop_id = ?
       ORDER BY pw.start_half_month, pw.method`
    )
    .bind(cropId)
    .all<WindowWithSource>();
  return result.results ?? [];
}

/** Month-overlap predicate; eight `?` binds (h1,h0,h1,h0,h0,h0,h1,h1). */
const WINDOW_MONTH_OVERLAP = `(
  (pw.start_half_month <= pw.end_half_month AND pw.start_half_month <= ? AND pw.end_half_month >= ?)
  OR
  (pw.start_half_month <= pw.end_half_month AND pw.start_half_month <= ? AND pw.end_half_month >= ?)
  OR
  (pw.start_half_month > pw.end_half_month AND (
    ? >= pw.start_half_month OR ? <= pw.end_half_month OR
    ? >= pw.start_half_month OR ? <= pw.end_half_month
  ))
)`;

/**
 * All windows (for grid), optional filters.
 * Four fixed SQL shapes (method × month) so structure never interpolates values.
 *
 * @param db - D1 binding.
 * @param method - Optional method filter.
 * @param month - Optional calendar month 0..11 (matches either half).
 */
export async function getAllWindows(
  db: D1Database,
  method?: 'S' | 'T',
  month?: number
): Promise<WindowWithSource[]> {
  const fromJoin = `FROM planting_windows pw
    INNER JOIN sources s ON s.id = pw.source_id`;
  const order = `ORDER BY pw.crop_id, pw.start_half_month, pw.method`;

  let sql: string;
  /** @type {Array<string | number>} */
  const binds: Array<string | number> = [];

  if (method && month !== undefined) {
    const h0 = month * 2;
    const h1 = month * 2 + 1;
    sql = `SELECT ${WINDOW_SELECT} ${fromJoin}
      WHERE pw.method = ? AND ${WINDOW_MONTH_OVERLAP} ${order}`;
    binds.push(method, h1, h0, h1, h0, h0, h0, h1, h1);
  } else if (method) {
    sql = `SELECT ${WINDOW_SELECT} ${fromJoin}
      WHERE pw.method = ? ${order}`;
    binds.push(method);
  } else if (month !== undefined) {
    const h0 = month * 2;
    const h1 = month * 2 + 1;
    sql = `SELECT ${WINDOW_SELECT} ${fromJoin}
      WHERE ${WINDOW_MONTH_OVERLAP} ${order}`;
    binds.push(h1, h0, h1, h0, h0, h0, h1, h1);
  } else {
    sql = `SELECT ${WINDOW_SELECT} ${fromJoin} ${order}`;
  }

  const result = await db
    .prepare(sql)
    .bind(...binds)
    .all<WindowWithSource>();
  return result.results ?? [];
}

/**
 * Map a window row into API source + window shape.
 *
 * @param row - Joined window/source row.
 */
export function windowToApi(row: WindowWithSource) {
  return {
    id: row.id,
    crop_id: row.crop_id,
    start_half_month: row.start_half_month,
    end_half_month: row.end_half_month,
    method: row.method,
    source_id: row.source_id,
    source_granularity: row.source_granularity ?? 'half-month',
    source: {
      id: row.source_id,
      title: row.source_title,
      author: row.source_author,
      publisher: row.source_publisher,
      url: row.source_url,
      retrieved_at: row.source_retrieved_at
    }
  };
}

/**
 * Crops keyed by id.
 *
 * @param db - D1 binding.
 */
export async function getCropsByIds(
  db: D1Database,
  ids: string[]
): Promise<Map<string, CropRow>> {
  const map = new Map<string, CropRow>();
  if (ids.length === 0) return map;
  // Parameterized IN clause
  const placeholders = ids.map(() => '?').join(',');
  const result = await db
    .prepare(
      `SELECT id, name, days_to_harvest_min, days_to_harvest_max, notes
       FROM crops WHERE id IN (${placeholders})`
    )
    .bind(...ids)
    .all<CropRow>();
  for (const row of result.results ?? []) {
    map.set(row.id, row);
  }
  return map;
}

/**
 * All crops for grid.
 *
 * @param db - D1 binding.
 */
export async function getAllCrops(db: D1Database): Promise<CropRow[]> {
  const result = await db
    .prepare(
      `SELECT id, name, days_to_harvest_min, days_to_harvest_max, notes
       FROM crops ORDER BY name COLLATE NOCASE`
    )
    .all<CropRow>();
  return result.results ?? [];
}
