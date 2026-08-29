import { describe, expect, it } from 'vitest';
import { ApiError, fieldError, parseFailedResponse } from './apiError';

describe('parseFailedResponse', () => {
  it('reads error, fields, field, and Retry-After', async () => {
    const res = new Response(JSON.stringify({ error: 'fix this', fields: { email: 'taken' }, field: 'email' }), {
      status: 409,
      headers: { 'Retry-After': '15', 'Content-Type': 'application/json' }
    });
    const err = await parseFailedResponse(res);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.message).toBe('fix this');
    expect(err.fields.email).toBe('taken');
    expect(err.field).toBe('email');
    expect(err.retryAfter).toBe(15);
  });

  it('falls back when the body is not JSON', async () => {
    const res = new Response('nope', { status: 500 });
    const err = await parseFailedResponse(res);
    expect(err.message).toBe('Request failed (500)');
    expect(err.retryAfter).toBeUndefined();
  });
});

describe('fieldError', () => {
  it('prefers fields over the single field property', () => {
    const err = new ApiError('fix', 400, { password: 'Use at least 12 characters.' }, 'email');
    expect(fieldError(err, 'password')).toBe('Use at least 12 characters.');
    expect(fieldError(err, 'email')).toBe('fix');
    expect(fieldError(err, 'name')).toBeUndefined();
    expect(fieldError(new Error('x'), 'email')).toBeUndefined();
  });
});
