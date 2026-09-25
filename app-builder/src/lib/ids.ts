/**
 * Shapes of the ids the API mints, shared by the server boundary and the
 * client so neither accepts an id the other would reject.
 */

/** Lowercase UUID, the shape crypto.randomUUID() returns for every job and PRD. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * A PRD id: a minted UUID, or a seeded slug such as `prd-tesla-driving-stats`
 * (migrations/0002_seed_prd.sql). Both are lowercase letters, digits and
 * hyphens, starting with a letter or digit.
 */
export const PRD_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
