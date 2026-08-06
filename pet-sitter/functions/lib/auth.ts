/** Web Crypto auth: PBKDF2 password hashing, HMAC-SHA256 session tokens. */

const PBKDF2_ITERATIONS = 100_000;
const SESSION_DAYS = 14;

/**
 * Hash a password with PBKDF2-SHA256.
 *
 * @param password - Plain password.
 * @param salt - Random salt bytes.
 */
export async function hashPassword(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  // Copy into a plain ArrayBuffer so TS BufferSource checks stay happy.
  const saltBuf = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuf).set(salt);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuf, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
}

/**
 * Constant-time-ish compare of two ArrayBuffers.
 *
 * @param a - First buffer.
 * @param b - Second buffer.
 */
export function buffersEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < av.length; i += 1) {
    diff |= (av[i] ?? 0) ^ (bv[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Encode bytes as base64url.
 *
 * @param bytes - Source bytes.
 */
export function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i += 1) {
    bin += String.fromCharCode(arr[i] ?? 0);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode base64url to Uint8Array.
 *
 * @param value - Base64url string.
 */
export function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const bin = atob(padded + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

/**
 * SHA-256 hex digest of a session token (stored form).
 *
 * @param token - Raw session token.
 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return toBase64Url(digest);
}

/**
 * Create a new random session token and expiry ISO string.
 */
export function newSessionToken(): { token: string; expiresAt: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = toBase64Url(bytes);
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  return { token, expiresAt: expires.toISOString() };
}

/**
 * Random salt for password hashing (16 bytes, base64url).
 */
export function newSalt(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}
