import { describe, expect, it } from 'vitest';
import {
  readPath,
  setupCapturedParams,
  fillParams,
  parseLocalSecrets,
  mintLocalSecrets,
  resolveHeaders,
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

describe('localSecrets: auth-gated routes without a committed credential', () => {
  it('mints a fresh 64-hex value per declared name, different every run', () => {
    const first = mintLocalSecrets(['RUNNER_TOKEN', 'RATE_LIMIT_KEY']);
    const second = mintLocalSecrets(['RUNNER_TOKEN']);
    expect(Object.keys(first)).toEqual(['RUNNER_TOKEN', 'RATE_LIMIT_KEY']);
    expect(first.RUNNER_TOKEN).toMatch(/^[0-9a-f]{64}$/);
    expect(second.RUNNER_TOKEN).not.toBe(first.RUNNER_TOKEN);
  });

  it('substitutes a declared reference into the header', () => {
    const r = resolveHeaders({ authorization: 'Bearer {{secret:RUNNER_TOKEN}}' }, { RUNNER_TOKEN: 'abc' });
    expect(r).toEqual({ headers: { authorization: 'Bearer abc' }, error: null });
  });

  it('FAILS CLOSED on a reference nobody declared instead of sending an empty token', () => {
    const r = resolveHeaders({ authorization: 'Bearer {{secret:RUNER_TOKEN}}' }, { RUNNER_TOKEN: 'abc' });
    expect(r.error).toMatch(/RUNER_TOKEN/);
    expect(r.headers).toEqual({});
  });

  it('accepts binding names only, and rejects a value smuggled in as a name', () => {
    expect(parseLocalSecrets(undefined)).toEqual({ names: [], error: null });
    expect(parseLocalSecrets(['RUNNER_TOKEN'])).toEqual({ names: ['RUNNER_TOKEN'], error: null });
    expect(parseLocalSecrets(['RUNNER_TOKEN=hunter2']).error).toMatch(/invalid binding name/);
    expect(parseLocalSecrets('RUNNER_TOKEN').error).toMatch(/must be an array/);
  });
});
