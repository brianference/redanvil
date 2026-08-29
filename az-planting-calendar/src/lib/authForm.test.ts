import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { ApiError } from './apiError';
import { formErrorMessage, passwordLengthError, safeInternalPath } from './authForm';

describe('passwordLengthError', () => {
  it('rejects shorter than 12 and longer than 200 before submit', () => {
    expect(passwordLengthError('short')).toBe(en.auth.passwordTooShort);
    expect(passwordLengthError('x'.repeat(12))).toBeNull();
    expect(passwordLengthError('x'.repeat(200))).toBeNull();
    expect(passwordLengthError('x'.repeat(201))).toBe(en.auth.passwordTooLong);
  });
});

describe('formErrorMessage', () => {
  it('uses Retry-After seconds on 429', () => {
    const err = new ApiError('slow down', 429, {}, undefined, 42);
    expect(formErrorMessage(err, en.auth.genericError)).toBe(en.auth.rateLimited(42));
  });

  it('uses the generic 429 copy when Retry-After is missing', () => {
    const err = new ApiError('slow down', 429);
    expect(formErrorMessage(err, en.auth.genericError)).toBe(en.auth.rateLimitedGeneric);
  });

  it('passes through an API error message', () => {
    const err = new ApiError('That email and password combination did not match.', 401);
    expect(formErrorMessage(err, en.auth.genericError)).toBe(
      'That email and password combination did not match.'
    );
  });
});

describe('safeInternalPath', () => {
  it('allows same-origin paths and rejects protocol-relative tricks', () => {
    expect(safeInternalPath('/account')).toBe('/account');
    expect(safeInternalPath('/crop/crop-tomatoes')).toBe('/crop/crop-tomatoes');
    expect(safeInternalPath('//evil.example')).toBeNull();
    expect(safeInternalPath('https://evil.example')).toBeNull();
    expect(safeInternalPath(12)).toBeNull();
  });
});
