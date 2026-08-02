import { describe, expect, it, vi } from 'vitest';
import type { AppContext } from '../../lib/env';
import type { CropRow, WindowWithSource } from '../../lib/db';
import { onRequestGet } from './[id]';

vi.mock('../../lib/db', async () => {
  const actual = await vi.importActual<typeof import('../../lib/db')>('../../lib/db');
  return {
    ...actual,
    getCrop: vi.fn(),
    getWindowsForCrop: vi.fn()
  };
});

import { getCrop, getWindowsForCrop } from '../../lib/db';

const getCropMock = vi.mocked(getCrop);
const getWindowsMock = vi.mocked(getWindowsForCrop);

/**
 * Build a minimal Pages Function context for GET /api/crops/:id.
 *
 * @param id - Route param or undefined to simulate a missing id.
 */
function ctx(id: string | undefined): AppContext {
  return {
    request: new Request(
      id ? `http://127.0.0.1/api/crops/${id}` : 'http://127.0.0.1/api/crops/'
    ),
    env: { DB: {} as D1Database },
    params: id === undefined ? {} : { id },
    data: {},
    functionPath: '',
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
    next: async () => new Response()
  } as unknown as AppContext;
}

describe('GET /api/crops/[id]', () => {
  it('returns 400 when crop id is missing', async () => {
    const res = await onRequestGet(ctx(undefined));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/crop id/i);
  });

  it('returns 404 when the crop is not in the database', async () => {
    getCropMock.mockResolvedValueOnce(null);
    const res = await onRequestGet(ctx('crop-missing'));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/not found/i);
    expect(getWindowsMock).not.toHaveBeenCalled();
  });

  it('returns crop and windows for a known id', async () => {
    const crop: CropRow = {
      id: 'crop-tomatoes',
      name: 'Tomatoes',
      days_to_harvest_min: 60,
      days_to_harvest_max: 90,
      notes: 'Stake or cage.'
    };
    const windows: WindowWithSource[] = [
      {
        id: 'w-t',
        crop_id: 'crop-tomatoes',
        start_half_month: 2,
        end_half_month: 4,
        method: 'T',
        source_id: 'src-az1005',
        source_granularity: 'half-month',
        source_title: 'Vegetable Planting Calendar for Maricopa County',
        source_author: 'Kai Umeda',
        source_publisher: 'University of Arizona Cooperative Extension',
        source_url: 'https://extension.arizona.edu/publication/vegetable-planting-calendar-maricopa-county',
        source_retrieved_at: '2026-01-15'
      }
    ];
    getCropMock.mockResolvedValueOnce(crop);
    getWindowsMock.mockResolvedValueOnce(windows);

    const res = await onRequestGet(ctx('crop-tomatoes'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      crop: CropRow;
      windows: Array<{ method: string; source: { title: string } }>;
    };
    expect(body.crop).toEqual(crop);
    expect(body.windows).toHaveLength(1);
    const firstWindow = body.windows[0];
    expect(firstWindow).toBeDefined();
    expect(firstWindow?.method).toBe('T');
    expect(firstWindow?.source.title).toMatch(/Maricopa/i);
    expect(getCropMock).toHaveBeenCalledWith(expect.anything(), 'crop-tomatoes');
    expect(getWindowsMock).toHaveBeenCalledWith(expect.anything(), 'crop-tomatoes');
  });
});
