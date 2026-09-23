import { describe, expect, it } from 'vitest';
import {
  readPath,
  setupCapturedParams,
  fillParams,
  type ApiExample
} from '../scripts/checks/u-api-real-output.mjs';

describe('u-api-real-output setup capture', () => {
  it('reads a dotted path and returns undefined for a missing segment', () => {
    expect(readPath({ reminder: { id: 'r_1' } }, 'reminder.id')).toBe('r_1');
    expect(readPath({ reminder: null }, 'reminder.id')).toBeUndefined();
    expect(readPath('text', 'a.b')).toBeUndefined();
  });

  it('a parameter promised by setup is not unfillable; one nobody promises still is', () => {
    const example: ApiExample = { setup: [{ method: 'POST', route: '/api/reminders/hardcoded', capture: { id: 'reminder.id' } }] };
    expect(setupCapturedParams(example).has('id')).toBe(true);
    const { missing } = fillParams('/api/reminders/[id]/undo', example.params);
    expect(missing.filter((n) => !setupCapturedParams(example).has(n))).toEqual([]);
    // Known-bad: an example with no setup and no params leaves `id` missing.
    const bare: ApiExample = {};
    expect(fillParams('/api/reminders/[id]/undo', bare.params).missing).toEqual(['id']);
    expect(setupCapturedParams(bare).size).toBe(0);
  });
});

describe('fillParams understands the optional catch-all', () => {
  it('fills [[catchall]] by its inner name and maps an empty value to the directory', () => {
    expect(fillParams('/api/[[catchall]]', { catchall: 'zzz' })).toEqual({ path: '/api/zzz', missing: [] });
    expect(fillParams('/api/[[catchall]]', { catchall: '' })).toEqual({ path: '/api', missing: [] });
    // Known-bad: no value at all is still reported under the inner name.
    expect(fillParams('/api/[[catchall]]', {}).missing).toEqual(['catchall']);
  });
});
