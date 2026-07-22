import { describe, it, expect } from 'vitest';
import { countThisWeek, formatRelativeTime, parseSavedList } from './savedList';

describe('parseSavedList', () => {
  it('accepts valid rows and rejects malformed payloads', () => {
    const ok = parseSavedList([
      { id: 'a', slug: 'meal', title: 'Meal planner', created_at: '2026-07-01T12:00:00.000Z' }
    ]);
    expect(ok).toHaveLength(1);
    expect(ok?.[0]?.slug).toBe('meal');
    expect(parseSavedList({ not: 'array' })).toBeNull();
    expect(parseSavedList([{ id: 1 }])).toBeNull();
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-07-21T12:00:00.000Z');

  it('formats recent deltas', () => {
    expect(formatRelativeTime('2026-07-21T11:59:30.000Z', now)).toBe('now');
    expect(formatRelativeTime('2026-07-21T11:30:00.000Z', now)).toBe('30m ago');
    expect(formatRelativeTime('2026-07-21T10:00:00.000Z', now)).toBe('2h ago');
    expect(formatRelativeTime('2026-07-18T12:00:00.000Z', now)).toBe('3d ago');
  });

  it('returns the raw string when unparseable', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('not-a-date');
  });
});

describe('countThisWeek', () => {
  const now = Date.parse('2026-07-21T12:00:00.000Z');

  it('counts only items from the last 7 days', () => {
    const items = [
      {
        id: '1',
        slug: 'a',
        title: 'A',
        created_at: '2026-07-20T12:00:00.000Z'
      },
      {
        id: '2',
        slug: 'b',
        title: 'B',
        created_at: '2026-07-01T12:00:00.000Z'
      }
    ];
    expect(countThisWeek(items, now)).toBe(1);
  });
});
