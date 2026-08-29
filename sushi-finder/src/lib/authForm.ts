import { en } from '../i18n/en';
import { ApiError } from './apiError';
import { interpolate } from './interpolate';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './schemas';

/**
 * Keep post-login redirects on this origin (no protocol-relative tricks).
 *
 * @param value - Candidate path from location state.
 * @returns The path if it is a same-app absolute path, otherwise null.
 */
export function safeInternalPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//') || value.includes('\\')) return null;
  return value;
}

/**
 * Client-side password rule check. Matches the server floor and ceiling.
 *
 * @param password - Candidate password.
 * @returns An i18n error, or null when the length is acceptable.
 */
export function passwordLengthError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return en.auth.passwordTooShort;
  if (password.length > PASSWORD_MAX_LENGTH) return en.auth.passwordTooLong;
  return null;
}

/**
 * Map a caught API failure onto form copy, including 429 Retry-After.
 *
 * @param err - Caught value.
 * @param fallback - i18n string when the error has no message.
 */
export function formErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 429) {
    if (err.retryAfter && err.retryAfter > 0) {
      return interpolate(en.auth.rateLimited, { seconds: err.retryAfter });
    }
    return en.auth.rateLimitedGeneric;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}
