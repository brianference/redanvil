import { describe, expect, it, vi } from 'vitest';
import type { AppContext } from '../lib/env';
import type { ZoneRow } from '../lib/db';
import { onRequestGet } from './zone';

vi.mock('../lib/db', () => ({
  getDefaultZone: vi.fn()
}));

import { getDefaultZone } from '../lib/db';

const getDefaultZoneMock = vi.mocked(getDefaultZone);

/**
 * Minimal context for GET /api/zone.
 */
function ctx(): AppContext {
  return {
    request: new Request('http://127.0.0.1/api/zone'),
    env: { DB: {} as D1Database },
    params: {},
    data: {},
    functionPath: '',
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
    next: async () => new Response()
  } as unknown as AppContext;
}

describe('GET /api/zone', () => {
  it('returns the default zone object shape', async () => {
    const zone: ZoneRow = {
      id: 'zone-cave-creek-85331',
      name: 'Cave Creek low desert',
      zip: '85331',
      last_frost: 'Feb 15',
      first_frost: 'Nov 25'
    };
    getDefaultZoneMock.mockResolvedValueOnce(zone);

    const res = await onRequestGet(ctx());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { zone: ZoneRow };
    expect(body).toEqual({ zone });
    expect(body.zone).toMatchObject({
      id: 'zone-cave-creek-85331',
      zip: '85331',
      name: expect.any(String),
      last_frost: expect.any(String),
      first_frost: expect.any(String)
    });
  });

  it('returns 500 when the default zone is not configured', async () => {
    getDefaultZoneMock.mockResolvedValueOnce(null);
    const res = await onRequestGet(ctx());
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/zone/i);
  });
});
