import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AppContext } from '../lib/env';
import type { CropRow, WindowWithSource, ZoneRow } from '../lib/db';
import { onRequestGet } from './plantable';

vi.mock('../lib/db', async () => {
  const actual = await vi.importActual<typeof import('../lib/db')>('../lib/db');
  return {
    ...actual,
    resolveZoneParam: vi.fn(),
    getWindowsForHalf: vi.fn(),
    getCropsByIds: vi.fn()
  };
});

import { getCropsByIds, getWindowsForHalf, resolveZoneParam } from '../lib/db';

const resolveZoneParamMock = vi.mocked(resolveZoneParam);
const getWindowsForHalfMock = vi.mocked(getWindowsForHalf);
const getCropsByIdsMock = vi.mocked(getCropsByIds);

const zone: ZoneRow = {
  id: 'zone-cave-creek-85331',
  name: 'Cave Creek low desert',
  zip: '85331',
  last_frost: 'Feb 15',
  first_frost: 'Nov 25',
  county: 'Maricopa',
  elevation_ft: 2529,
  usda_zone: '9b'
};

/**
 * Minimal Pages Function context for GET /api/plantable.
 *
 * @param query - Query string without leading `?`.
 */
function ctx(query = ''): AppContext {
  const url = query
    ? `http://127.0.0.1/api/plantable?${query}`
    : 'http://127.0.0.1/api/plantable';
  return {
    request: new Request(url),
    env: { DB: {} as D1Database },
    params: {},
    data: {},
    functionPath: '',
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
    next: async () => new Response()
  } as unknown as AppContext;
}

describe('GET /api/plantable query validation', () => {
  beforeEach(() => {
    resolveZoneParamMock.mockReset();
    getWindowsForHalfMock.mockReset();
    getCropsByIdsMock.mockReset();
    resolveZoneParamMock.mockResolvedValue({ zone });
    getWindowsForHalfMock.mockResolvedValue([]);
    getCropsByIdsMock.mockResolvedValue(new Map());
  });

  it('returns 400 when method is not S or T', async () => {
    const res = await onRequestGet(ctx('method=X'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/method must be S or T/i);
    expect(getWindowsForHalfMock).not.toHaveBeenCalled();
  });

  it('returns 400 when date is not YYYY-MM-DD', async () => {
    const res = await onRequestGet(ctx('date=03-01-2026'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/date must be YYYY-MM-DD/i);
    expect(getWindowsForHalfMock).not.toHaveBeenCalled();
  });

  it('returns 400 when date is calendar-invalid', async () => {
    const res = await onRequestGet(ctx('date=2026-02-31'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/date/i);
    expect(getWindowsForHalfMock).not.toHaveBeenCalled();
  });

  it('accepts method=S and a valid date', async () => {
    const crop: CropRow = {
      id: 'crop-lettuce',
      name: 'Lettuce',
      days_to_harvest_min: 40,
      days_to_harvest_max: 60,
      notes: null
    };
    const window: WindowWithSource = {
      id: 'w1',
      crop_id: 'crop-lettuce',
      start_half_month: 4,
      end_half_month: 6,
      method: 'S',
      source_id: 'src-az1005',
      source_granularity: 'half-month',
      source_title: 'az1005',
      source_author: 'Kai Umeda',
      source_publisher: 'UA Extension',
      source_url: 'https://extension.arizona.edu/example',
      source_retrieved_at: '2026-01-15'
    };
    getWindowsForHalfMock.mockResolvedValueOnce([window]);
    getCropsByIdsMock.mockResolvedValueOnce(new Map([[crop.id, crop]]));

    const res = await onRequestGet(ctx('date=2026-03-01&method=S'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; date: string };
    expect(body.date).toBe('2026-03-01');
    expect(body.items).toHaveLength(1);
    expect(getWindowsForHalfMock).toHaveBeenCalledWith(expect.anything(), 4, 'S');
  });

  it('q=Beans returns a strictly smaller item set than no q', async () => {
    const beans: CropRow = {
      id: 'crop-beans-snap',
      name: 'Beans, Snap',
      days_to_harvest_min: 50,
      days_to_harvest_max: 60,
      notes: null
    };
    const lettuce: CropRow = {
      id: 'crop-lettuce',
      name: 'Lettuce',
      days_to_harvest_min: 40,
      days_to_harvest_max: 60,
      notes: null
    };
    const mkWin = (id: string, cropId: string): WindowWithSource => ({
      id,
      crop_id: cropId,
      start_half_month: 4,
      end_half_month: 6,
      method: 'S',
      source_id: 'src-az1005',
      source_granularity: 'half-month',
      source_title: 'az1005',
      source_author: 'Kai Umeda',
      source_publisher: 'UA Extension',
      source_url: 'https://extension.arizona.edu/example',
      source_retrieved_at: '2026-01-15'
    });
    getWindowsForHalfMock.mockResolvedValue([
      mkWin('w-b', beans.id),
      mkWin('w-l', lettuce.id)
    ]);
    getCropsByIdsMock.mockResolvedValue(
      new Map([
        [beans.id, beans],
        [lettuce.id, lettuce]
      ])
    );

    const all = await onRequestGet(ctx('date=2026-03-01'));
    expect(all.status).toBe(200);
    const allBody = (await all.json()) as { items: Array<{ crop: { name: string } }> };
    expect(allBody.items.length).toBe(2);

    const filtered = await onRequestGet(ctx('date=2026-03-01&q=Beans'));
    expect(filtered.status).toBe(200);
    const filteredBody = (await filtered.json()) as {
      items: Array<{ crop: { name: string } }>;
    };
    expect(filteredBody.items.length).toBeLessThan(allBody.items.length);
    expect(filteredBody.items.every((i) => /bean/i.test(i.crop.name))).toBe(true);
  });
});
