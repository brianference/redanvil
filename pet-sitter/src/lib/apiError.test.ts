import { describe, expect, it } from 'vitest';
import { ApiError, fieldError, parseFailedResponse } from './apiError';

describe('parseFailedResponse', () => {
  it('reads error, fields, field, and Retry-After', async () => {
    const res = new Response(
      JSON.stringify({
        error: 'Please fix the highlighted fields.',
        fields: { email: 'Enter a valid email address.' },
        field: 'email'
      }),
      { status: 400, headers: { 'Retry-After': '30' } }
    );
    const err = await parseFailedResponse(res);
    expect(err.status).toBe(400);
    expect(err.message).toBe('Please fix the highlighted fields.');
    expect(err.fields.email).toBe('Enter a valid email address.');
    expect(err.field).toBe('email');
    expect(err.retryAfter).toBe(30);
  });

  it('falls back when the body is not JSON', async () => {
    const res = new Response('nope', { status: 500 });
    const err = await parseFailedResponse(res);
    expect(err.status).toBe(500);
    expect(err.message).toBe('Request failed (500)');
    expect(err.retryAfter).toBeUndefined();
  });

  it('ignores a non-positive Retry-After', async () => {
    const res = new Response(JSON.stringify({ error: 'slow' }), {
      status: 429,
      headers: { 'Retry-After': '0' }
    });
    const err = await parseFailedResponse(res);
    expect(err.retryAfter).toBeUndefined();
  });
});

describe('fieldError', () => {
  it('returns the named field, or the message when field matches', () => {
    const withFields = new ApiError('form', 400, { password: 'Use at least 12 characters.' });
    expect(fieldError(withFields, 'password')).toBe('Use at least 12 characters.');
    expect(fieldError(withFields, 'email')).toBeUndefined();

    const withField = new ApiError('An account with that email already exists. Sign in instead.', 409, {}, 'email');
    expect(fieldError(withField, 'email')).toBe(
      'An account with that email already exists. Sign in instead.'
    );
    expect(fieldError(new Error('nope'), 'email')).toBeUndefined();
  });
});
