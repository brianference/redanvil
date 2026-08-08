/**
 * D1 access helpers for the sushis table.
 * All SQL is parameterized; no string-concatenated identifiers or values.
 */

/** Row shape as stored in D1 (snake_case columns). */
export interface SushiDbRow {
  id: string;
  created_at: string;
  title: string;
  description: string;
  updated_at: string;
}

/** API / client row (camelCase, PRD §7.2 examples). */
export interface SushiRow {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Map a D1 row to the public API shape.
 *
 * @param row - Database row.
 */
export function toSushiRow(row: SushiDbRow): SushiRow {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * List sushis with optional case-insensitive title search.
 *
 * @param db - D1 binding.
 * @param q - Optional title fragment; empty/undefined lists all.
 */
export async function listSushis(db: D1Database, q?: string): Promise<SushiRow[]> {
  const trimmed = q?.trim();
  if (trimmed && trimmed.length > 0) {
    const like = `%${trimmed.toLowerCase()}%`;
    const result = await db
      .prepare(
        `SELECT id, created_at, title, description, updated_at
         FROM sushis
         WHERE lower(title) LIKE ?
         ORDER BY title ASC`
      )
      .bind(like)
      .all<SushiDbRow>();
    return (result.results ?? []).map(toSushiRow);
  }

  const result = await db
    .prepare(
      `SELECT id, created_at, title, description, updated_at
       FROM sushis
       ORDER BY title ASC`
    )
    .all<SushiDbRow>();
  return (result.results ?? []).map(toSushiRow);
}

/**
 * Fetch one sushi by id.
 *
 * @param db - D1 binding.
 * @param id - Primary key.
 */
export async function getSushi(db: D1Database, id: string): Promise<SushiRow | null> {
  const row = await db
    .prepare(
      `SELECT id, created_at, title, description, updated_at
       FROM sushis
       WHERE id = ?`
    )
    .bind(id)
    .first<SushiDbRow>();
  return row ? toSushiRow(row) : null;
}

/**
 * Insert a sushi row.
 *
 * @param db - D1 binding.
 * @param input - Title and description already Zod-validated.
 */
export async function createSushi(
  db: D1Database,
  input: { title: string; description: string }
): Promise<SushiRow> {
  const id = `sushi_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO sushis (id, created_at, title, description, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, now, input.title, input.description, now)
    .run();
  const created = await getSushi(db, id);
  if (!created) {
    throw new Error('Failed to read sushi after insert');
  }
  return created;
}

/**
 * Update title and/or description on an existing row.
 *
 * @param db - D1 binding.
 * @param id - Primary key.
 * @param input - Partial fields already Zod-validated.
 */
export async function updateSushi(
  db: D1Database,
  id: string,
  input: { title?: string; description?: string }
): Promise<SushiRow | null> {
  const existing = await getSushi(db, id);
  if (!existing) return null;

  const title = input.title ?? existing.title;
  const description = input.description ?? existing.description;
  const now = new Date().toISOString();

  await db
    .prepare(
      `UPDATE sushis
       SET title = ?, description = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(title, description, now, id)
    .run();

  return getSushi(db, id);
}

/**
 * Delete a sushi by id.
 *
 * @param db - D1 binding.
 * @param id - Primary key.
 * @returns True when a row was deleted.
 */
export async function deleteSushi(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare(`DELETE FROM sushis WHERE id = ?`).bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}
