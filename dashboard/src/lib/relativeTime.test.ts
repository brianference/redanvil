import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from './relativeTime';

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-07-21T12:00:00.000Z');

  it('returns just now for sub-minute deltas', () => {
    expect(formatRelativeTime('2026-07-21T11:59:30.000Z', now)).toBe('just now');
  });

  it('formats minutes, hours, and days', () => {
    expect(formatRelativeTime('2026-07-21T11:45:00.000Z', now)).toBe('15m ago');
    expect(formatRelativeTime('2026-07-21T10:00:00.000Z', now)).toBe('2h ago');
    expect(formatRelativeTime('2026-07-19T12:00:00.000Z', now)).toBe('2d ago');
  });

  it('returns the raw string when the timestamp is invalid', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('not-a-date');
  });
});
