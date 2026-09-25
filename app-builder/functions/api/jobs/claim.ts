import { z } from 'zod';
import type { D1Database, Env } from '../../lib/env';
import { emptyResponse, jsonResponse, readValidatedBody } from '../../lib/http';
import { authorizeRunner } from '../../lib/runnerAuth';

/** CORS allow-methods for this endpoint (POST only). */
const ALLOWED_METHODS = 'POST';

/** How many compare-and-set attempts before giving up on a busy queue. */
const CLAIM_ATTEMPTS = 8;

/** Max length of the runner name stored in claimed_by. */
const MAX_RUNNER_LEN = 64;

/**
 * How long a claim holds a job that has not moved past `claimed`. After this
 * the job is claimable again, so a runner that crashed between the claim and
 * its first status update does not strand the job forever.
 *
 * The poller (n8n-prototype/poller/job-poller.mjs) moves a job off `claimed`
 * in the same cycle it claims it: one claim POST and one awaiting_owner POST,
 * each capped by its 20 s REQUEST_TIMEOUT_MS, so 40 s of timeouts at worst. When
 * that status POST fails, the poller retries it at the start of every cycle,
 * every 5 min by default (DEFAULT_INTERVAL_MIN). 30 min is six of those
 * retry cycles and 45 times that 40 s window, so only a runner
 * that is really gone loses the job. Every later status (awaiting_owner,
 * building, done...) is never re-issued, however old its claim.
 */
export const CLAIM_LEASE_MS = 30 * 60 * 1000;

/**
 * Body for POST /api/jobs/claim.
 * runner is the name recorded in claimed_by.
 */
const claimBodySchema = z.object({
  runner: z.string().trim().min(1).max(MAX_RUNNER_LEN)
});

/**
 * Oldest claimable id: queued, or claimed with an expired lease
 * (`claimed_at` before the bound cutoff). The follow-up UPDATE repeats the
 * same condition, which is what stops two claims from taking the same row.
 * See the note on {@link claimOldest} for why this is not a single
 * RETURNING statement.
 */
const PICK_CLAIMABLE_SQL =
  "SELECT id FROM jobs WHERE status = 'queued' OR (status = 'claimed' AND claimed_at < ?) ORDER BY created_at ASC LIMIT 1";

/**
 * Compare-and-set: only the claim that still sees the row claimable wins.
 * The winner writes a fresh claimed_at, so a second claim of an expired
 * lease no longer matches `claimed_at < cutoff` and gets changes === 0.
 * `meta.changes` is 1 for the winner and 0 for a claim that lost the race.
 */
const CLAIM_SQL =
  "UPDATE jobs SET status = 'claimed', claimed_at = ?, claimed_by = ?, updated_at = ? WHERE id = ? AND (status = 'queued' OR (status = 'claimed' AND claimed_at < ?))";

/** Columns the claim response is allowed to return, including the prompt. */
const LOAD_CLAIMED_SQL =
  'SELECT id, slug, prompt, entities, target_type, threshold, created_at FROM jobs WHERE id = ?';

/** Job object returned by a successful claim. */
interface ClaimedJob {
  id: string;
  slug: string;
  prompt: string;
  entities: string;
  target_type: string;
  threshold: number;
  created_at: string;
}

/**
 * True when a row is `{ id: string }`.
 *
 * @param value - Unknown D1 row.
 * @returns Whether the row has a string id.
 */
function isIdRow(value: unknown): value is { id: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as { id: unknown }).id === 'string' &&
    (value as { id: string }).id.length > 0
  );
}

/**
 * True when a row has every field the claim response returns.
 *
 * @param value - Unknown D1 row.
 * @returns Whether the row can be returned as a claimed job.
 */
function isClaimedRow(value: unknown): value is {
  id: string;
  slug: string;
  prompt: string;
  entities: string | null;
  target_type: string;
  threshold: number;
  created_at: string;
} {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row['id'] === 'string' &&
    typeof row['slug'] === 'string' &&
    typeof row['prompt'] === 'string' &&
    (typeof row['entities'] === 'string' || row['entities'] === null) &&
    typeof row['target_type'] === 'string' &&
    typeof row['threshold'] === 'number' &&
    typeof row['created_at'] === 'string'
  );
}

/**
 * Map a loaded row to the claim response. `entities` is the names string,
 * or an empty string when the column is null.
 *
 * @param row - Loaded jobs row.
 * @returns Claim response job object.
 */
function toClaimedJob(row: {
  id: string;
  slug: string;
  prompt: string;
  entities: string | null;
  target_type: string;
  threshold: number;
  created_at: string;
}): ClaimedJob {
  return {
    id: row.id,
    slug: row.slug,
    prompt: row.prompt,
    entities: row.entities ?? '',
    target_type: row.target_type,
    threshold: row.threshold,
    created_at: row.created_at
  };
}

/**
 * Atomically claim the oldest queued job, or the oldest job whose claim
 * lease has expired.
 *
 * D1's prepared-statement docs say `results` is empty for UPDATE / INSERT /
 * DELETE (https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
 * and the SQL statements page
 * (https://developers.cloudflare.com/d1/sql-api/sql-statements/) does not
 * document RETURNING. `meta.changes` is documented on D1Result
 * (https://developers.cloudflare.com/d1/worker-api/return-object/).
 * So this does not use RETURNING. It targets one id, UPDATEs only while that
 * row is still queued, checks `meta.changes`, then SELECTs that id.
 * A concurrent claim that already moved the row gets changes === 0 and must
 * not receive it; the loop then targets the next oldest queued id.
 *
 * @param db - D1 binding.
 * @param runner - Runner name stored in claimed_by.
 * @param now - ISO timestamp for claimed_at and updated_at.
 * @param leaseCutoff - ISO timestamp; claims older than this have expired.
 * @returns The claimed job, `empty` when nothing is claimable, or `contended`.
 */
async function claimOldest(
  db: D1Database,
  runner: string,
  now: string,
  leaseCutoff: string
): Promise<{ kind: 'empty' } | { kind: 'contended' } | { kind: 'claimed'; job: ClaimedJob }> {
  for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt += 1) {
    const picked = await db.prepare(PICK_CLAIMABLE_SQL).bind(leaseCutoff).all();
    const candidate = picked.results[0];
    if (!isIdRow(candidate)) {
      return { kind: 'empty' };
    }

    const updated = await db
      .prepare(CLAIM_SQL)
      .bind(now, runner, now, candidate.id, leaseCutoff)
      .run();
    if ((updated.meta?.changes ?? 0) !== 1) {
      continue;
    }

    const loaded = await db.prepare(LOAD_CLAIMED_SQL).bind(candidate.id).all();
    const row = loaded.results[0];
    if (!isClaimedRow(row) || row.id !== candidate.id) {
      return { kind: 'contended' };
    }
    return { kind: 'claimed', job: toClaimedJob(row) };
  }
  return { kind: 'contended' };
}

/**
 * POST /api/jobs/claim — move the oldest queued job to claimed. A job left
 * in `claimed` for longer than {@link CLAIM_LEASE_MS} counts as queued.
 *
 * Bearer token required. 204 when the queue is empty. 401 when the token is
 * wrong or missing. 503 when RUNNER_TOKEN is unset.
 *
 * @param context - Pages Function context.
 * @returns Claim response, 204, or an error response.
 */
export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  const auth = await authorizeRunner(request, env, ALLOWED_METHODS);
  if (!auth.ok) return auth.response;

  const parsed = await readValidatedBody(request, claimBodySchema, ALLOWED_METHODS);
  if (!parsed.ok) return parsed.response;

  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const leaseCutoff = new Date(nowMs - CLAIM_LEASE_MS).toISOString();
  try {
    const outcome = await claimOldest(env.DB, parsed.data.runner, now, leaseCutoff);
    if (outcome.kind === 'empty') {
      return emptyResponse(request, 204, ALLOWED_METHODS);
    }
    if (outcome.kind === 'contended') {
      return jsonResponse(request, { error: 'Could not claim a job' }, 500, ALLOWED_METHODS);
    }
    return jsonResponse(request, { job: outcome.job }, 200, ALLOWED_METHODS);
  } catch {
    return jsonResponse(request, { error: 'Could not claim a job' }, 500, ALLOWED_METHODS);
  }
}
