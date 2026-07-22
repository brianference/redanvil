/**
 * Extract a human-readable error message from an API JSON payload.
 * Returns the payload's string `error` field when present, else the fallback.
 */
export function messageFromPayload(payload: unknown, fallback: string): string {
  return typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof (payload as { error: unknown }).error === 'string'
    ? (payload as { error: string }).error
    : fallback;
}
