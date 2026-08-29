import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FnCtx } from '../_lib/types';

vi.mock('../_lib/auth', () => ({
  getSession: vi.fn()
}));

import { getSession } from '../_lib/auth';
import { onRequestDelete, onRequestGet, onRequestPost, sortBedItems, toBedItem } from './bed';

const getSessionMock = vi.mocked(getSession);

/**
 * Minimal Pages Function context.
 *
 * @param method - HTTP method.
 * @param body - Optional JSON body.
 */
function ctx(method: string, body?: unknown): FnCtx {
  return {
    request: new Request('http://127.0.0.1/api/bed', {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined
    }),
    env: { DB: {} as D1Database }
  };
}

describe('toBedItem / sortBedItems', () => {
  it('marks the crop in-window when next half is now and sorts soonest first', () => {
    const tomatoes = toBedItem(
      {
        cropId: 'crop-tomatoes',
        cropName: 'Tomatoes',
        zone: 'zone-cave-creek-85331',
        zoneName: 'Cave Creek',
        usdaZone: '9b',
        addedAt: 1,
        plantedAt: null,
        notes: null
      },
      [{ cropId: 'crop-tomatoes', startHalf: 20, endHalf: 21, method: 'T' }],
      14
    );
    expect(tomatoes.nextHalfMonth).toBe(20);
    expect(tomatoes.inWindow).toBe(false);
    expect(tomatoes.nextHalfMonthLabel).toBe('Nov 1');

    const beans = toBedItem(
      {
        cropId: 'crop-beans-snap',
        cropName: 'Beans, Snap',
        zone: 'zone-cave-creek-85331',
        zoneName: 'Cave Creek',
        usdaZone: '9b',
        addedAt: 1,
        plantedAt: null,
        notes: null
      },
      [{ cropId: 'crop-beans-snap', startHalf: 14, endHalf: 16, method: 'S' }],
      14
    );
    expect(beans.inWindow).toBe(true);

    const sorted = sortBedItems([tomatoes, beans], 14);
    expect(sorted.map((item) => item.cropId)).toEqual(['crop-beans-snap', 'crop-tomatoes']);
  });
});

describe('GET/POST/DELETE /api/bed', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
  });

  it('returns 401 when there is no session', async () => {
    getSessionMock.mockResolvedValue(null);
    const getRes = await onRequestGet(ctx('GET'));
    expect(getRes.status).toBe(401);
    const postRes = await onRequestPost(ctx('POST', { cropId: 'crop-tomatoes', zone: 'zone-cave-creek-85331' }));
    expect(postRes.status).toBe(401);
    const delRes = await onRequestDelete(ctx('DELETE', { cropId: 'crop-tomatoes' }));
    expect(delRes.status).toBe(401);
  });

  it('rejects an empty POST body with 400', async () => {
    getSessionMock.mockResolvedValue({ userId: 'user-1', email: 'a@example.com' });
    const res = await onRequestPost(ctx('POST', {}));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { fields?: Record<string, string> };
    expect(body.fields?.cropId).toBeTruthy();
  });
});
