/**
 * HTTP failure carrying status, field errors, and optional Retry-After.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly fields: Record<string, string>;
  readonly field: string | undefined;
  readonly retryAfter: number | undefined;

  /**
   * @param message - Human-readable error from the API body, or a fallback.
   * @param status - HTTP status.
   * @param fields - Per-field messages from a 400 `fields` object.
   * @param field - Single field name from a 409 `{ field }` body.
   * @param retryAfter - Seconds from the Retry-After header, when present.
   */
  constructor(
    message: string,
    status: number,
    fields: Record<string, string> = {},
    field?: string,
    retryAfter?: number
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
    this.field = field;
    this.retryAfter = retryAfter;
  }
}

/**
 * Build an {@link ApiError} from a failed fetch response.
 *
 * @param res - Non-OK response.
 * @returns An error with status, optional field map, and Retry-After.
 */
export async function parseFailedResponse(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  let fields: Record<string, string> = {};
  let field: string | undefined;
  try {
    const body = (await res.json()) as {
      error?: string;
      fields?: Record<string, string>;
      field?: string;
    };
    if (body.error) message = body.error;
    if (body.fields && typeof body.fields === 'object') fields = body.fields;
    if (typeof body.field === 'string') field = body.field;
  } catch {
    // Non-JSON bodies still produce a usable status line.
  }
  const retryHeader = res.headers.get('Retry-After');
  const parsedRetry = retryHeader ? Number.parseInt(retryHeader, 10) : Number.NaN;
  const retryAfter = Number.isFinite(parsedRetry) && parsedRetry > 0 ? parsedRetry : undefined;
  return new ApiError(message, res.status, fields, field, retryAfter);
}

/**
 * Field-level message for an input, from `fields` or a single `field` property.
 *
 * @param err - Caught value, possibly an {@link ApiError}.
 * @param name - Form field name.
 */
export function fieldError(err: unknown, name: string): string | undefined {
  if (!(err instanceof ApiError)) return undefined;
  if (err.fields[name]) return err.fields[name];
  if (err.field === name) return err.message;
  return undefined;
}
