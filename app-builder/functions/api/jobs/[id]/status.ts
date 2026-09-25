import { z } from 'zod';
import type { Env } from '../../../lib/env';
import { jsonResponse, readValidatedBody } from '../../../lib/http';
import { authorizeRunner } from '../../../lib/runnerAuth';
import { isJobId } from '../../../../src/lib/jobStatus';

/** CORS allow-methods for this endpoint (public GET, runner POST). */
const ALLOWED_METHODS = 'GET, POST';

/** Lifecycle values a runner may write. `queued` is not one of them. */
const RUNNER_STATUSES = [
  'claimed',
  'awaiting_owner',
  'approved',
  'rejected',
  'building',
  'done',
  'failed'
] as const;

/** Max length of a step slug. */
const MAX_STEP_LEN = 64;

/** Max length of a human-readable detail string. */
const MAX_DETAIL_LEN = 500;

/** Max length of an execution id. */
const MAX_EXECUTION_ID_LEN = 64;

/** Max length of a deploy URL. */
const MAX_DEPLOY_URL_LEN = 200;

/**
 * True when `value` is an https URL the URL parser accepts.
 *
 * @param value - Candidate deploy URL.
 * @returns Whether it is https.
 */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Body for POST /api/jobs/:id/status.
 * status is required and cannot be `queued`. Optional fields are omitted
 * from the UPDATE (SQL COALESCE) when the runner does not send them.
 */
const statusBodySchema = z.object({
  status: z.enum(RUNNER_STATUSES),
  step: z
    .string()
    .max(MAX_STEP_LEN)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  detail: z.string().max(MAX_DETAIL_LEN).optional(),
  executionId: z.string().max(MAX_EXECUTION_ID_LEN).optional(),
  deployUrl: z
    .string()
    .max(MAX_DEPLOY_URL_LEN)
    .refine(isHttpsUrl, { message: 'deployUrl must be an https URL' })
    .optional()
});

/**
 * Public status columns only. The prompt is not selected.
 * updated_at and deploy_url are renamed in the JSON body, not here.
 */
const PUBLIC_STATUS_SQL =
  'SELECT id, status, step, detail, updated_at, deploy_url FROM jobs WHERE id = ?';

/**
 * Optional fields use COALESCE so an omitted step/detail/url does not wipe
 * the previous value. updated_at always changes, so meta.changes is 1 when
 * the id exists even if status is unchanged.
 */
const UPDATE_STATUS_SQL =
  'UPDATE jobs SET status = ?, step = COALESCE(?, step), detail = COALESCE(?, detail), execution_id = COALESCE(?, execution_id), deploy_url = COALESCE(?, deploy_url), updated_at = ? WHERE id = ?';

/** Pages params for /api/jobs/:id/status. */
interface StatusContext {
  request: Request;
  env: Env;
  params: { id?: string };
}

/**
 * Path id, or a 404 response unless it is the UUID shape submit issues.
 *
 * The id is user input like any body field. The client already polls only
 * ids that pass {@link isJobId}; the server now holds the same line, so a
 * malformed or oversized value never reaches the query. No job can have such
 * an id, so the answer is the same 404 an unknown id gets.
 *
 * @param context - Pages Function context.
 * @returns The id, or the response to return.
 */
function requireJobId(
  context: StatusContext
): { ok: true; id: string } | { ok: false; response: Response } {
  const id = context.params.id ?? '';
  if (!isJobId(id)) {
    return {
      ok: false,
      response: jsonResponse(context.request, { error: 'Job not found' }, 404, ALLOWED_METHODS)
    };
  }
  return { ok: true, id };
}

/**
 * Read a string column, treating null and non-strings as null.
 *
 * @param value - Unknown column value.
 * @returns The string, or null.
 */
function asNullableString(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  return value;
}

/**
 * True when a public status row has id and status strings.
 *
 * @param value - Unknown D1 row.
 * @returns Whether the row can be mapped to the public body.
 */
function isStatusRow(value: unknown): value is {
  id: string;
  status: string;
  step: unknown;
  detail: unknown;
  updated_at: unknown;
  deploy_url: unknown;
} {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row['id'] === 'string' && typeof row['status'] === 'string';
}

/**
 * GET /api/jobs/:id/status — public progress for one job.
 *
 * Returns only id, status, step, detail, updatedAt, and deployUrl.
 * The prompt is not selected and is not copied onto the body.
 *
 * @param context - Pages Function context.
 * @returns Public status JSON, 404, or 500.
 */
export async function onRequestGet(context: StatusContext): Promise<Response> {
  const { request, env } = context;
  const idResult = requireJobId(context);
  if (!idResult.ok) return idResult.response;

  try {
    const { results } = await env.DB.prepare(PUBLIC_STATUS_SQL).bind(idResult.id).all();
    const row = results[0];
    if (!isStatusRow(row)) {
      return jsonResponse(request, { error: 'Job not found' }, 404, ALLOWED_METHODS);
    }
    return jsonResponse(
      request,
      {
        id: row.id,
        status: row.status,
        step: asNullableString(row.step),
        detail: asNullableString(row.detail),
        updatedAt: asNullableString(row.updated_at),
        deployUrl: asNullableString(row.deploy_url)
      },
      200,
      ALLOWED_METHODS
    );
  } catch {
    return jsonResponse(request, { error: 'Could not load job status' }, 500, ALLOWED_METHODS);
  }
}

/**
 * POST /api/jobs/:id/status — runner updates one job.
 *
 * Same bearer auth as claim. 404 when the id does not exist. 401 / 503 from
 * {@link authorizeRunner}. Zod rejects `queued`, a bad step, and a non-https
 * deployUrl before any write.
 *
 * @param context - Pages Function context.
 * @returns `{ ok: true }` or an error response.
 */
export async function onRequestPost(context: StatusContext): Promise<Response> {
  const { request, env } = context;

  const auth = await authorizeRunner(request, env, ALLOWED_METHODS);
  if (!auth.ok) return auth.response;

  const idResult = requireJobId(context);
  if (!idResult.ok) return idResult.response;

  const parsed = await readValidatedBody(request, statusBodySchema, ALLOWED_METHODS);
  if (!parsed.ok) return parsed.response;

  const now = new Date().toISOString();
  const { status, step, detail, executionId, deployUrl } = parsed.data;
  try {
    const updated = await env.DB.prepare(UPDATE_STATUS_SQL)
      .bind(
        status,
        step ?? null,
        detail ?? null,
        executionId ?? null,
        deployUrl ?? null,
        now,
        idResult.id
      )
      .run();
    if ((updated.meta?.changes ?? 0) !== 1) {
      return jsonResponse(request, { error: 'Job not found' }, 404, ALLOWED_METHODS);
    }
    return jsonResponse(request, { ok: true }, 200, ALLOWED_METHODS);
  } catch {
    return jsonResponse(request, { error: 'Could not update job status' }, 500, ALLOWED_METHODS);
  }
}
