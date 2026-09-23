/** How often the status panel polls GET /api/jobs/:id/status. */
export const JOB_STATUS_POLL_INTERVAL_MS = 15_000;

/** localStorage key for the last submitted job id. Not an account id. */
export const LAST_JOB_ID_STORAGE_KEY = 'redanvil.jobId';

/** Statuses that stop polling. Anything else keeps the 15s loop. */
const TERMINAL_JOB_STATUSES: ReadonlySet<string> = new Set(['done', 'failed', 'rejected']);

/** UUID shape crypto.randomUUID() returns. */
const JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Max length of a deploy URL, matching the status API. */
const MAX_DEPLOY_URL_LEN = 200;

/**
 * Public status payload. The prompt is not part of this type on purpose.
 */
export interface PublicJobStatus {
  id: string;
  status: string;
  step: string | null;
  detail: string | null;
  updatedAt: string | null;
  deployUrl: string | null;
}

/**
 * Whether polling should stop.
 *
 * @param status - Status string from the public endpoint.
 * @returns True for done, failed, and rejected.
 */
export function isTerminalJobStatus(status: string): boolean {
  return TERMINAL_JOB_STATUSES.has(status);
}

/**
 * True when `value` is a job id this app stores and polls.
 *
 * @param value - Untrusted string from the submit response or localStorage.
 * @returns Whether it is a lowercase UUID.
 */
export function isJobId(value: string): boolean {
  return JOB_ID_PATTERN.test(value);
}

/**
 * Path for the public status endpoint.
 *
 * @param jobId - Job id from submit.
 * @returns Same-origin path.
 */
export function jobStatusUrl(jobId: string): string {
  return `/api/jobs/${encodeURIComponent(jobId)}/status`;
}

/**
 * Read a string field, or null when it is missing or empty.
 *
 * @param value - Unknown JSON field.
 * @returns The string, or null.
 */
function nullableString(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  return value;
}

/**
 * Accept only an https URL short enough for the status API.
 *
 * @param value - Unknown deployUrl field.
 * @returns The URL, or null when it is not a safe https link.
 */
function httpsDeployUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_DEPLOY_URL_LEN) return null;
  try {
    if (new URL(trimmed).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return trimmed;
}

/**
 * Parse the public status JSON.
 *
 * Extra fields, including `prompt`, are ignored. A payload that is not the
 * public shape returns null so the panel fails closed instead of rendering
 * whatever the server sent.
 *
 * @param payload - Parsed JSON.
 * @returns The public status, or null.
 */
export function parsePublicJobStatus(payload: unknown): PublicJobStatus | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const record = payload as Record<string, unknown>;
  if (typeof record['id'] !== 'string' || !isJobId(record['id'])) return null;
  if (typeof record['status'] !== 'string' || record['status'].length === 0) return null;
  return {
    id: record['id'],
    status: record['status'],
    step: nullableString(record['step']),
    detail: nullableString(record['detail']),
    updatedAt: nullableString(record['updatedAt']),
    deployUrl: httpsDeployUrl(record['deployUrl'])
  };
}

/**
 * Read the job id from a successful POST /api/submit body.
 *
 * @param payload - Parsed JSON.
 * @returns The id, or null when the body has none.
 */
export function parseSubmittedJobId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const id = (payload as Record<string, unknown>)['id'];
  if (typeof id !== 'string' || !isJobId(id)) return null;
  return id;
}

/**
 * Read the last submitted job id. Storage failures return null.
 *
 * @returns The stored id, or null.
 */
export function readLastJobId(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const value = localStorage.getItem(LAST_JOB_ID_STORAGE_KEY);
    if (value === null || !isJobId(value)) return null;
    return value;
  } catch {
    return null;
  }
}

/**
 * Remember the last submitted job id so a reload can keep showing status.
 * Storage failures are ignored; the in-memory panel still works.
 *
 * @param jobId - Id returned by POST /api/submit.
 */
export function writeLastJobId(jobId: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!isJobId(jobId)) return;
    localStorage.setItem(LAST_JOB_ID_STORAGE_KEY, jobId);
  } catch {
    // Private mode and blocked storage must not fail the submit.
  }
}
