import { describe, it, expect } from 'vitest';
import {
  buffersEqual,
  hashPassword,
  hashToken,
  newSalt,
  newSessionToken,
  toBase64Url,
  fromBase64Url
} from './auth';

describe('toBase64Url / fromBase64Url', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 255]);
    const encoded = toBase64Url(bytes);
    expect(encoded.includes('+')).toBe(false);
    expect(encoded.includes('/')).toBe(false);
    const back = fromBase64Url(encoded);
    expect([...back]).toEqual([...bytes]);
  });
});

describe('buffersEqual', () => {
  it('compares equal and unequal buffers', () => {
    const a = new Uint8Array([1, 2, 3]).buffer;
    const b = new Uint8Array([1, 2, 3]).buffer;
    const c = new Uint8Array([1, 2, 4]).buffer;
    expect(buffersEqual(a, b)).toBe(true);
    expect(buffersEqual(a, c)).toBe(false);
    expect(buffersEqual(a, new Uint8Array([1, 2]).buffer)).toBe(false);
  });
});

describe('password and session helpers', () => {
  it('hashes a password and salt deterministically for the same inputs', async () => {
    const saltStr = newSalt();
    expect(saltStr.length).toBeGreaterThan(8);
    const salt = fromBase64Url(saltStr);
    const h1 = await hashPassword('long-enough-secret', salt);
    const h2 = await hashPassword('long-enough-secret', salt);
    expect(buffersEqual(h1, h2)).toBe(true);
    const other = await hashPassword('different-secret!!', salt);
    expect(buffersEqual(h1, other)).toBe(false);
  });

  it('issues a session token and can hash it', async () => {
    const session = newSessionToken();
    expect(session.token.length).toBeGreaterThan(16);
    expect(session.expiresAt.length).toBeGreaterThan(10);
    const hashed = await hashToken(session.token);
    expect(hashed.length).toBeGreaterThan(0);
  });
});
