import { safeHttpUrl } from '../../../design-system/safeHttpUrl';

/** How often the status panel polls GET /api/jobs/:id/status. */
export const JOB_STATUS_POLL_INTERVAL_MS = 15_000;

/** localStorage key for the last submitted job id. Not an account id. */
export const LAST_JOB_ID_STORAGE_KEY = 'redanvil.jobId';

/** Visible prefix of a job id. The full id stays available to screen readers. */
export const JOB_ID_SHORT_LENGTH = 8;

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
 * First characters of a job id for the visible label.
 *
 * @param jobId - Full job id.
 * @returns The short form. Shorter ids are returned unchanged.
 */
export function shortJobId(jobId: string): string {
  return jobId.slice(0, JOB_ID_SHORT_LENGTH);
}

/** One row of the ordered build-step catalog (ids + human labels live in i18n). */
export interface BuildStepCatalogEntry {
  readonly id: string;
  readonly label: string;
}

/**
 * What the panel shows for a step id.
 * Unknown ids keep `line` equal to the raw id and leave the numbers null.
 */
export interface BuildStepLine {
  line: string;
  index: number | null;
  total: number | null;
  percent: number | null;
}

/**
 * Fill percent for a known step. Zero when the catalog is empty or the index is not positive.
 *
 * @param index - 1-based step index.
 * @param total - Catalog length.
 * @returns A percent from 0 to 100.
 */
function buildStepPercent(index: number, total: number): number {
  if (total <= 0 || index <= 0) return 0;
  const clamped = Math.min(index, total);
  return (clamped / total) * 100;
}

/**
 * Map a status step id onto the ordered catalog.
 *
 * A known id becomes "Step N of {total} -- {label}" via `progress`.
 * An id that is not in the catalog is returned unchanged, with no index,
 * so the panel can show it without inventing a position.
 *
 * @param stepId - Step from the public status payload.
 * @param steps - Ordered catalog. The i18n bundle is the one source.
 * @param progress - Locale formatter for a known step.
 * @returns The line to render, plus bar numbers when the id is known.
 */
export function formatBuildStepLine(
  stepId: string,
  steps: readonly BuildStepCatalogEntry[],
  progress: (index: number, total: number, label: string) => string
): BuildStepLine {
  const found = steps.findIndex((step) => step.id === stepId);
  const entry = found < 0 ? undefined : steps[found];
  if (entry === undefined) {
    return { line: stepId, index: null, total: null, percent: null };
  }
  const index = found + 1;
  const total = steps.length;
  return {
    line: progress(index, total, entry.label),
    index,
    total,
    percent: buildStepPercent(index, total)
  };
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
 * Accept only an http or https URL short enough for the status API.
 * javascript:, data:, and other schemes are dropped so the panel never links them.
 *
 * @param value - Unknown deployUrl field.
 * @returns The URL, or null when it is not a safe http(s) link.
 */
function publicDeployUrl(value: unknown): string | null {
  const safe = safeHttpUrl(value);
  if (safe === null || safe.length > MAX_DEPLOY_URL_LEN) return null;
  return safe;
}

/**
 * Whether the done state should offer the deployed app.
 * The URL must already be http(s); any other scheme stays hidden.
 *
 * @param status - Public status string.
 * @param deployUrl - Parsed deploy URL, or null.
 * @returns True only for a finished job with a safe http(s) URL.
 */
export function shouldShowDeployLink(status: string, deployUrl: string | null): boolean {
  if (status !== 'done' || deployUrl === null) return false;
  return safeHttpUrl(deployUrl) !== null && deployUrl.length <= MAX_DEPLOY_URL_LEN;
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
    deployUrl: publicDeployUrl(record['deployUrl'])
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

/**
 * Forget the stored job id so a reload does not bring the panel back.
 * Storage failures are ignored.
 */
export function clearLastJobId(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(LAST_JOB_ID_STORAGE_KEY);
  } catch {
    // Private mode and blocked storage must not trap the panel on screen.
  }
}
