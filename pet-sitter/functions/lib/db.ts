/** D1 access helpers for sitters and related rows. */

/** Sitter row as stored in D1. */
export interface SitterRow {
  id: string;
  owner_user_id: string | null;
  name: string;
  neighbourhood: string;
  rate_per_night: number;
  pet_types: string;
  bio: string;
  verified_reviews: number;
  available_from: string | null;
  available_to: string | null;
  source_url: string | null;
  created_at: string;
}

/** Review row. */
export interface ReviewRow {
  id: string;
  sitter_id: string;
  author_user_id: string | null;
  rating: number;
  body: string;
  created_at: string;
}

/**
 * List sitters with optional text search and filters.
 *
 * @param db - D1 binding.
 * @param q - Free-text query matched against name, neighbourhood, pet_types, bio.
 * @param neighbourhood - Exact neighbourhood filter when set.
 * @param petType - Substring match on pet_types when set.
 * @param maxRate - Inclusive max rate_per_night when set.
 * @returns Matching sitter rows ordered by verified_reviews desc, then name.
 */
export async function listSitters(
  db: D1Database,
  q?: string,
  neighbourhood?: string,
  petType?: string,
  maxRate?: number
): Promise<SitterRow[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [];

  if (q !== undefined && q.trim() !== '') {
    const like = `%${q.trim().toLowerCase()}%`;
    clauses.push(
      '(lower(name) LIKE ? OR lower(neighbourhood) LIKE ? OR lower(pet_types) LIKE ? OR lower(bio) LIKE ?)'
    );
    binds.push(like, like, like, like);
  }
  if (neighbourhood !== undefined && neighbourhood.trim() !== '') {
    clauses.push('lower(neighbourhood) = ?');
    binds.push(neighbourhood.trim().toLowerCase());
  }
  if (petType !== undefined && petType.trim() !== '') {
    clauses.push('lower(pet_types) LIKE ?');
    binds.push(`%${petType.trim().toLowerCase()}%`);
  }
  if (maxRate !== undefined && Number.isFinite(maxRate)) {
    clauses.push('rate_per_night <= ?');
    binds.push(maxRate);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `SELECT id, owner_user_id, name, neighbourhood, rate_per_night, pet_types, bio,
    verified_reviews, available_from, available_to, source_url, created_at
    FROM sitter ${where}
    ORDER BY verified_reviews DESC, name ASC`;

  const stmt = db.prepare(sql);
  const bound = binds.length > 0 ? stmt.bind(...binds) : stmt;
  const result = await bound.all<SitterRow>();
  return result.results ?? [];
}

/**
 * Fetch one sitter by id.
 *
 * @param db - D1 binding.
 * @param id - Sitter id.
 * @returns Row or null when missing.
 */
export async function getSitter(db: D1Database, id: string): Promise<SitterRow | null> {
  const row = await db
    .prepare(
      `SELECT id, owner_user_id, name, neighbourhood, rate_per_night, pet_types, bio,
        verified_reviews, available_from, available_to, source_url, created_at
       FROM sitter WHERE id = ?`
    )
    .bind(id)
    .first<SitterRow>();
  return row ?? null;
}

/**
 * Reviews for a sitter, newest first.
 *
 * @param db - D1 binding.
 * @param sitterId - Sitter id.
 */
export async function listReviewsForSitter(
  db: D1Database,
  sitterId: string
): Promise<ReviewRow[]> {
  const result = await db
    .prepare(
      `SELECT id, sitter_id, author_user_id, rating, body, created_at
       FROM review WHERE sitter_id = ? ORDER BY created_at DESC`
    )
    .bind(sitterId)
    .all<ReviewRow>();
  return result.results ?? [];
}
