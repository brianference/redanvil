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
  /**
   * Average of review.rating rows for this sitter, or null when no review row exists.
   * Never invent a score client-side — only this field (or per-review ratings) is real.
   */
  avg_rating: number | null;
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

const SITTER_SELECT = `SELECT id, owner_user_id, name, neighbourhood, rate_per_night, pet_types, bio,
  verified_reviews, available_from, available_to, source_url, created_at,
  (SELECT AVG(CAST(rating AS REAL)) FROM review r WHERE r.sitter_id = sitter.id) AS avg_rating
  FROM sitter`;

/**
 * Normalize D1 avg_rating (number | string | null) to number | null.
 *
 * @param row - Raw sitter row from D1.
 */
function normalizeSitter(row: SitterRow): SitterRow {
  const raw = row.avg_rating as number | string | null | undefined;
  if (raw == null || raw === '') {
    return { ...row, avg_rating: null };
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  return { ...row, avg_rating: Number.isFinite(n) ? n : null };
}

/**
 * List sitters with optional text search and filters.
 * Each branch uses a fully static SQL string with only bound parameters.
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
  const hasQ = q !== undefined && q.trim() !== '';
  const hasN = neighbourhood !== undefined && neighbourhood.trim() !== '';
  const hasP = petType !== undefined && petType.trim() !== '';
  const hasR = maxRate !== undefined && Number.isFinite(maxRate);

  if (!hasQ && !hasN && !hasP && !hasR) {
    const result = await db
      .prepare(`${SITTER_SELECT} ORDER BY verified_reviews DESC, name ASC`)
      .all<SitterRow>();
    return (result.results ?? []).map(normalizeSitter);
  }

  if (hasQ && !hasN && !hasP && !hasR) {
    const like = `%${q!.trim().toLowerCase()}%`;
    const result = await db
      .prepare(
        `${SITTER_SELECT} WHERE lower(name) LIKE ? OR lower(neighbourhood) LIKE ? OR lower(pet_types) LIKE ? OR lower(bio) LIKE ? ORDER BY verified_reviews DESC, name ASC`
      )
      .bind(like, like, like, like)
      .all<SitterRow>();
    return (result.results ?? []).map(normalizeSitter);
  }

  // Combined filters: apply in memory after a bounded DB query so SQL stays
  // fully parameterized without dynamic clause assembly.
  let rows: SitterRow[];
  if (hasQ) {
    const like = `%${q!.trim().toLowerCase()}%`;
    const result = await db
      .prepare(
        `${SITTER_SELECT} WHERE lower(name) LIKE ? OR lower(neighbourhood) LIKE ? OR lower(pet_types) LIKE ? OR lower(bio) LIKE ? ORDER BY verified_reviews DESC, name ASC`
      )
      .bind(like, like, like, like)
      .all<SitterRow>();
    rows = result.results ?? [];
  } else if (hasN) {
    const result = await db
      .prepare(
        `${SITTER_SELECT} WHERE lower(neighbourhood) = ? ORDER BY verified_reviews DESC, name ASC`
      )
      .bind(neighbourhood!.trim().toLowerCase())
      .all<SitterRow>();
    rows = result.results ?? [];
  } else if (hasP) {
    const result = await db
      .prepare(
        `${SITTER_SELECT} WHERE lower(pet_types) LIKE ? ORDER BY verified_reviews DESC, name ASC`
      )
      .bind(`%${petType!.trim().toLowerCase()}%`)
      .all<SitterRow>();
    rows = result.results ?? [];
  } else {
    const result = await db
      .prepare(
        `${SITTER_SELECT} WHERE rate_per_night <= ? ORDER BY verified_reviews DESC, name ASC`
      )
      .bind(maxRate!)
      .all<SitterRow>();
    rows = result.results ?? [];
  }

  return rows
    .filter((row) => {
      if (hasN && row.neighbourhood.toLowerCase() !== neighbourhood!.trim().toLowerCase()) {
        return false;
      }
      if (hasP && !row.pet_types.toLowerCase().includes(petType!.trim().toLowerCase())) {
        return false;
      }
      if (hasR && row.rate_per_night > maxRate!) {
        return false;
      }
      return true;
    })
    .map(normalizeSitter);
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
    .prepare(`${SITTER_SELECT} WHERE id = ?`)
    .bind(id)
    .first<SitterRow>();
  return row ? normalizeSitter(row) : null;
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
      'SELECT id, sitter_id, author_user_id, rating, body, created_at FROM review WHERE sitter_id = ? ORDER BY created_at DESC'
    )
    .bind(sitterId)
    .all<ReviewRow>();
  return result.results ?? [];
}
