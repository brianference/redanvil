import { describe, it, expect } from 'vitest';
import { messageFromPayload } from './apiError';

describe('messageFromPayload', () => {
  it('returns the payload error string when present', () => {
    expect(messageFromPayload({ error: 'Not found' }, 'fallback')).toBe('Not found');
  });

  it('falls back when there is no string error field', () => {
    expect(messageFromPayload({ error: 42 }, 'fallback')).toBe('fallback');
    expect(messageFromPayload(null, 'fallback')).toBe('fallback');
    expect(messageFromPayload('nope', 'fallback')).toBe('fallback');
    expect(messageFromPayload({}, 'fallback')).toBe('fallback');
  });
});
