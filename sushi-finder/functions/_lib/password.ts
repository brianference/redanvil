/**
 * Password hashing for the Workers runtime.
 *
 * bcrypt and argon2 are native Node modules and cannot load here, so this uses
 * PBKDF2-SHA256 from Web Crypto, which is built into the runtime and needs no
 * dependency. 210,000 iterations matches current OWASP guidance for PBKDF2-SHA256.
 */

/**
 * Iterations used for newly created hashes. Stored per row so this can be raised
 * later without invalidating existing hashes.
 *
 * OWASP recommends 210,000 for PBKDF2-SHA256, but the Workers runtime rejects
 * anything above 100,000 — deriveBits throws, which surfaces as a 1101 in
 * production while `wrangler pages dev` accepts it locally. 100,000 is therefore
 * the platform ceiling, not a preference. It remains a defensible cost (it was
 * OWASP's own recommendation until recently), and the per-row iteration count
 * means every account can be upgraded transparently on next sign-in if the cap
 * is ever lifted.
 */
export const PBKDF2_ITERATIONS = 100_000

/** The hard limit imposed by the Workers runtime. Exceeding it throws. */
export const WORKERS_PBKDF2_MAX = 100_000
const SALT_BYTES = 16
const KEY_BITS = 256

/**
 * Byte arrays are pinned to `ArrayBuffer` rather than the default
 * `ArrayBufferLike`, because Web Crypto's `BufferSource` excludes
 * `SharedArrayBuffer` and the unpinned type is not assignable to it.
 */
type Bytes = Uint8Array<ArrayBuffer>

function allocate(length: number): Bytes {
  return new Uint8Array(new ArrayBuffer(length))
}

function toBase64(bytes: Bytes): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromBase64(b64: string): Bytes {
  const bin = atob(b64)
  const out = allocate(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function derive(password: string, salt: Bytes, iterations: number): Promise<Bytes> {
  if (iterations > WORKERS_PBKDF2_MAX) {
    // Fail loudly here rather than as an opaque 1101 from deep inside Web Crypto.
    throw new Error(`PBKDF2 iterations ${iterations} exceed the Workers limit of ${WORKERS_PBKDF2_MAX}`)
  }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    KEY_BITS,
  )
  return new Uint8Array(bits)
}

export type PasswordRecord = { hash: string; salt: string; iterations: number }

/** Hash a new password. Returns the three values to persist on the user row. */
export async function hashPassword(password: string): Promise<PasswordRecord> {
  const salt = allocate(SALT_BYTES)
  crypto.getRandomValues(salt)
  const derived = await derive(password, salt, PBKDF2_ITERATIONS)
  return { hash: toBase64(derived), salt: toBase64(salt), iterations: PBKDF2_ITERATIONS }
}

/**
 * Compare a candidate password against a stored record in constant time.
 * Returns false rather than throwing when the record is incomplete, so accounts
 * created through the passwordless magic-link flow simply fail password login.
 */
export async function verifyPassword(
  password: string,
  record: Partial<PasswordRecord> | null | undefined,
): Promise<boolean> {
  if (!record?.hash || !record.salt || !record.iterations) return false
  let derived: Bytes
  try {
    derived = await derive(password, fromBase64(record.salt), record.iterations)
  } catch {
    return false
  }
  const expected = fromBase64(record.hash)
  if (expected.length !== derived.length) return false
  // Constant-time: always walk the full length, accumulate differences.
  let diff = 0
  // Both sides are read on every iteration regardless, so the `?? 0` fallbacks
  // (required by noUncheckedIndexedAccess) do not introduce an early exit or a
  // data-dependent branch. The comparison stays constant-time.
  for (let i = 0; i < expected.length; i++) {
    const a = expected[i] ?? 0
    const b = derived[i] ?? 0
    diff |= a ^ b
  }
  return diff === 0
}

/** True when the stored hash was made with fewer iterations than we now use. */
export function needsRehash(record: Partial<PasswordRecord> | null | undefined): boolean {
  return !!record?.hash && (record.iterations ?? 0) < PBKDF2_ITERATIONS
}
