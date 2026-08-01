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
}

export interface CropRow {
  id: string;
  name: string;
  days_to_harvest_min: number | null;
  days_to_harvest_max: number | null;
  notes: string | null;
}

export interface WindowRow {
  id: string;
  crop_id: string;
  start_half_month: number;
  end_half_month: number;
  method: 'S' | 'T';
  source_id: string;
}

export interface WindowWithSource extends WindowRow {
  source_title: string;
  source_author: string;
  source_publisher: string;
  source_url: string;
  source_retrieved_at: string;
}

const DEFAULT_ZONE_ID = 'zone-cave-creek-85331';

/**
 * Load the default Cave Creek zone.
 *
 * @param db - D1 binding.
 */
export async function getDefaultZone(db: D1Database): Promise<ZoneRow | null> {
  return db
    .prepare(
      `SELECT id, name, zip, last_frost, first_frost
       FROM zones WHERE id = ?`
    )
    .bind(DEFAULT_ZONE_ID)
    .first<ZoneRow>();
}

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
  const methodClause = method ? ' AND pw.method = ?' : '';
  const sql = `
    SELECT
      pw.id, pw.crop_id, pw.start_half_month, pw.end_half_month, pw.method, pw.source_id,
      s.title AS source_title, s.author AS source_author, s.publisher AS source_publisher,
      s.url AS source_url, s.retrieved_at AS source_retrieved_at
    FROM planting_windows pw
    INNER JOIN sources s ON s.id = pw.source_id
    WHERE (
      (pw.start_half_month <= pw.end_half_month
        AND ? >= pw.start_half_month AND ? <= pw.end_half_month)
      OR
      (pw.start_half_month > pw.end_half_month
        AND (? >= pw.start_half_month OR ? <= pw.end_half_month))
    )${methodClause}
    ORDER BY pw.crop_id, pw.method
  `;
  const stmt = db.prepare(sql);
  const binds = method
    ? [half, half, half, half, method]
    : [half, half, half, half];
  const result = await stmt.bind(...binds).all<WindowWithSource>();
  return result.results ?? [];
}

/**
 * All crops ordered by name, with window counts.
 *
 * @param db - D1 binding.
 */
export async function listCrops(
  db: D1Database
): Promise<Array<CropRow & { window_count: number }>> {
  const result = await db
    .prepare(
      `SELECT c.id, c.name, c.days_to_harvest_min, c.days_to_harvest_max, c.notes,
              COUNT(pw.id) AS window_count
       FROM crops c
       LEFT JOIN planting_windows pw ON pw.crop_id = c.id
       GROUP BY c.id
       ORDER BY c.name COLLATE NOCASE`
    )
    .all<CropRow & { window_count: number }>();
  return result.results ?? [];
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

/**
 * All windows (for grid), optional filters.
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
  const clauses: string[] = [];
  const binds: Array<string | number> = [];

  if (method) {
    clauses.push('pw.method = ?');
    binds.push(method);
  }
  if (month !== undefined) {
    const h0 = month * 2;
    const h1 = month * 2 + 1;
    // Window overlaps either half of the month
    clauses.push(`(
      (pw.start_half_month <= pw.end_half_month AND pw.start_half_month <= ? AND pw.end_half_month >= ?)
      OR
      (pw.start_half_month <= pw.end_half_month AND pw.start_half_month <= ? AND pw.end_half_month >= ?)
      OR
      (pw.start_half_month > pw.end_half_month AND (
        ? >= pw.start_half_month OR ? <= pw.end_half_month OR
        ? >= pw.start_half_month OR ? <= pw.end_half_month
      ))
    )`);
    binds.push(h1, h0, h1, h0, h0, h0, h1, h1);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `
    SELECT
      pw.id, pw.crop_id, pw.start_half_month, pw.end_half_month, pw.method, pw.source_id,
      s.title AS source_title, s.author AS source_author, s.publisher AS source_publisher,
      s.url AS source_url, s.retrieved_at AS source_retrieved_at
    FROM planting_windows pw
    INNER JOIN sources s ON s.id = pw.source_id
    ${where}
    ORDER BY pw.crop_id, pw.start_half_month, pw.method
  `;
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
