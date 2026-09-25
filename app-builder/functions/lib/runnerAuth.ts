import type { Env } from './env';
import { jsonResponse } from './http';

/**
 * SHA-256 digest of a string via Web Crypto.
 *
 * @param value - Raw string. Callers must not log this when it is the secret.
 * @returns 32-byte digest.
 */
async function sha256Bytes(value: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return new Uint8Array(digest);
}

/**
 * Constant-time equality of two strings.
 *
 * Compares SHA-256 digests, never the raw strings with `===`, so a mismatch
 * does not return early on the first differing character of the secret.
 *
 * @param left - Candidate value (for example the bearer token).
 * @param right - Expected value (the Pages secret).
 * @returns True only when the digests are identical.
 */
export async function digestsEqual(left: string, right: string): Promise<boolean> {
  // Both digests are always 32 bytes, so the loop never exits early on length.
  const [leftBytes, rightBytes] = await Promise.all([sha256Bytes(left), sha256Bytes(right)]);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

/**
 * Read the bearer token from Authorization, or an empty string when absent.
 *
 * An empty string still gets hashed in {@link digestsEqual} so a missing
 * header is not a shorter compare than a wrong token.
 *
 * @param request - Incoming request.
 * @returns The token after `Bearer `, or `''`.
 */
function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) {
    return '';
  }
  return header.slice(prefix.length);
}

/**
 * Authorize a runner request against `RUNNER_TOKEN`.
 *
 * Fail closed: an unset or empty secret is 503, never an open list or claim.
 * A missing or wrong bearer token is 401. The secret is not logged.
 *
 * @param request - Incoming request.
 * @param env - Pages bindings.
 * @param methods - CORS allow-methods for the error response.
 * @returns `{ ok: true }` or the response the caller must return.
 */
export async function authorizeRunner(
  request: Request,
  env: Env,
  methods: string
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const expected = env.RUNNER_TOKEN;
  if (expected === undefined || expected.length === 0) {
    return {
      ok: false,
      response: jsonResponse(request, { error: 'runner not configured' }, 503, methods)
    };
  }
  const provided = bearerToken(request);
  const matches = await digestsEqual(provided, expected);
  if (!matches) {
    return {
      ok: false,
      response: jsonResponse(request, { error: 'unauthorized' }, 401, methods)
    };
  }
  return { ok: true };
}
