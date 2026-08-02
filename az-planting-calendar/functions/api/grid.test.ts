import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AppContext } from '../lib/env';
import type { CropRow, ZoneRow } from '../lib/db';
import { onRequestGet } from './grid';

vi.mock('../lib/db', async () => {
  const actual = await vi.importActual<typeof import('../lib/db')>('../lib/db');
  return {
    ...actual,
    resolveZoneParam: vi.fn(),
    getAllCrops: vi.fn(),
    getAllWindows: vi.fn()
  };
});

import { getAllCrops, getAllWindows, resolveZoneParam } from '../lib/db';

const resolveZoneParamMock = vi.mocked(resolveZoneParam);
const getAllCropsMock = vi.mocked(getAllCrops);
const getAllWindowsMock = vi.mocked(getAllWindows);

const zone: ZoneRow = {
  id: 'zone-cave-creek-85331',
  name: 'Cave Creek low desert',
  zip: '85331',
  last_frost: 'Feb 15',
  first_frost: 'Nov 25',
  county: 'Maricopa',
  elevation_ft: 2529
};

/**
 * Minimal Pages Function context for GET /api/grid.
 *
 * @param query - Query string without leading `?`.
 */
function ctx(query = ''): AppContext {
  const url = query
    ? `http://127.0.0.1/api/grid?${query}`
    : 'http://127.0.0.1/api/grid';
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

describe('GET /api/grid query validation', () => {
  beforeEach(() => {
    resolveZoneParamMock.mockReset();
    getAllCropsMock.mockReset();
    getAllWindowsMock.mockReset();
    resolveZoneParamMock.mockResolvedValue({ zone });
    getAllCropsMock.mockResolvedValue([]);
    getAllWindowsMock.mockResolvedValue([]);
  });

  it('returns 400 when method is not S or T', async () => {
    const res = await onRequestGet(ctx('method=seed'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/method must be S or T/i);
    expect(getAllWindowsMock).not.toHaveBeenCalled();
  });

  it('returns 400 when month is out of range', async () => {
    const res = await onRequestGet(ctx('month=12'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/month must be integer 0\.\.11/i);
    expect(getAllWindowsMock).not.toHaveBeenCalled();
  });

  it('returns 400 when month is not an integer', async () => {
    const res = await onRequestGet(ctx('month=june'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/month must be integer 0\.\.11/i);
    expect(getAllWindowsMock).not.toHaveBeenCalled();
  });

  it('accepts month=6 and method=T', async () => {
    const crop: CropRow = {
      id: 'crop-tomatoes',
      name: 'Tomatoes',
      days_to_harvest_min: 60,
      days_to_harvest_max: 90,
      notes: null
    };
    getAllCropsMock.mockResolvedValueOnce([crop]);
    getAllWindowsMock.mockResolvedValueOnce([
      {
        id: 'w-t',
        crop_id: 'crop-tomatoes',
        start_half_month: 12,
        end_half_month: 13,
        method: 'T' as const,
        source_id: 'src-az1005',
      source_granularity: 'half-month',
        source_title: 'az1005',
        source_author: 'Kai Umeda',
        source_publisher: 'UA Extension',
        source_url: 'https://extension.arizona.edu/example',
        source_retrieved_at: '2026-01-15'
      }
    ]);

    const res = await onRequestGet(ctx('month=6&method=T'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { crops: unknown[] };
    expect(Array.isArray(body.crops)).toBe(true);
    expect(getAllWindowsMock).toHaveBeenCalledWith(expect.anything(), 'T', 6);
  });
});
