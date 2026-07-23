/** Web Crypto auth: PBKDF2 password hashing, HMAC-SHA256 tokens. Runs natively on Workers. */
export async function hashPassword(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  // BufferSource rejects ArrayBufferLike on some TS lib versions; copy into a plain ArrayBuffer view.
  const saltView = new Uint8Array(salt);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltView, iterations: 100_000, hash: 'SHA-256' },
    key,
    256
  );
}
