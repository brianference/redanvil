import { describe, it, expect, vi, afterEach } from 'vitest';
import { createActiveFlag, isAbortError } from './abortableEffect';

afterEach(() => {
  vi.useRealTimers();
});

describe('isAbortError', () => {
  it('returns true for Error with name AbortError', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    expect(isAbortError(err)).toBe(true);
  });

  it('returns true for DOMException AbortError when available', () => {
    if (typeof DOMException === 'undefined') return;
    expect(isAbortError(new DOMException('Aborted', 'AbortError'))).toBe(true);
  });

  it('returns false for ordinary errors and non-errors', () => {
    expect(isAbortError(new Error('network'))).toBe(false);
    expect(isAbortError('string')).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});

describe('createActiveFlag', () => {
  it('runs ifActive callbacks only while active (stale setState must not apply)', () => {
    const flag = createActiveFlag();
    const applied: string[] = [];

    expect(flag.isActive()).toBe(true);
    expect(flag.ifActive(() => applied.push('first'))).toBe(true);
    expect(applied).toEqual(['first']);

    // Simulate effect cleanup, then a late response/catch from the prior run.
    flag.deactivate();
    expect(flag.isActive()).toBe(false);
    expect(flag.ifActive(() => applied.push('stale'))).toBe(false);
    expect(applied).toEqual(['first']);
  });

  it('lets a newer run apply after an older run is deactivated', () => {
    const older = createActiveFlag();
    const newer = createActiveFlag();
    let state = 'loading';

    older.ifActive(() => {
      state = 'loading-A';
    });
    older.deactivate();
    newer.ifActive(() => {
      state = 'loading-B';
    });

    // Stale success from A must not overwrite B.
    older.ifActive(() => {
      state = 'success-A';
    });
    newer.ifActive(() => {
      state = 'success-B';
    });

    expect(state).toBe('success-B');
  });
});
