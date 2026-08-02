import { describe, expect, it, vi } from 'vitest';
import type { AppContext } from '../../lib/env';
import type { CropRow, WindowWithSource } from '../../lib/db';
import { onRequestGet } from './[id]';

vi.mock('../../lib/db', async () => {
  const actual = await vi.importActual<typeof import('../../lib/db')>('../../lib/db');
  return {
    ...actual,
    getCrop: vi.fn(),
    getWindowsForCrop: vi.fn(),
    getCropGuide: vi.fn()
  };
});

import { getCrop, getCropGuide, getWindowsForCrop } from '../../lib/db';

const getCropMock = vi.mocked(getCrop);
const getWindowsMock = vi.mocked(getWindowsForCrop);
const getGuideMock = vi.mocked(getCropGuide);

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
    getGuideMock.mockResolvedValueOnce({
      crop_id: 'crop-tomatoes',
      depth: 'Plant slightly deeper than the container',
      spacing_in_row: 'At least 24 in between plants',
      spacing_between_rows: null,
      sun: null,
      water: 'Water slowly and deeply',
      harvest_note: null,
      source_id: 'src-tomato-ua',
      source_title: 'Tomato Planting, Growing and Harvest',
      source_author: 'UA Cooperative Extension',
      source_publisher: 'University of Arizona Cooperative Extension',
      source_url:
        'https://extension.arizona.edu/publication/tomato-planting-growing-and-harvest',
      source_retrieved_at: '2026-08-02'
    });

    const res = await onRequestGet(ctx('crop-tomatoes'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      crop: CropRow;
      windows: Array<{ method: string; source: { title: string } }>;
      guide: { spacing_in_row: string | null; source: { title: string } } | null;
    };
    expect(body.crop).toEqual(crop);
    expect(body.windows).toHaveLength(1);
    const firstWindow = body.windows[0];
    expect(firstWindow).toBeDefined();
    expect(firstWindow?.method).toBe('T');
    expect(firstWindow?.source.title).toMatch(/Maricopa/i);
    expect(body.guide?.spacing_in_row).toMatch(/24/);
    expect(body.guide?.source.title).toMatch(/Tomato/i);
    expect(getCropMock).toHaveBeenCalledWith(expect.anything(), 'crop-tomatoes');
    expect(getWindowsMock).toHaveBeenCalledWith(expect.anything(), 'crop-tomatoes');
    expect(getGuideMock).toHaveBeenCalledWith(expect.anything(), 'crop-tomatoes');
  });

  it('returns guide null when no sourced guide exists', async () => {
    getCropMock.mockResolvedValueOnce({
      id: 'crop-sunflower',
      name: 'Sunflower',
      days_to_harvest_min: 90,
      days_to_harvest_max: 110,
      notes: null
    });
    getWindowsMock.mockResolvedValueOnce([]);
    getGuideMock.mockResolvedValueOnce(null);

    const res = await onRequestGet(ctx('crop-sunflower'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { guide: null };
    expect(body.guide).toBeNull();
  });
});
