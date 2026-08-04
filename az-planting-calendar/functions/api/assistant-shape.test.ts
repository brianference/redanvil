import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CropRow, WindowWithSource } from '../lib/db';
import { AssistantFiltersSchema } from '../../src/lib/schemas';
import {
  buildAnswer,
  extractJsonObject,
  groundFilters,
  modelText,
  type AssistantCrop,
  type ModelResult
} from './assistant';

vi.mock('../lib/db', async () => {
  const actual = await vi.importActual<typeof import('../lib/db')>('../lib/db');
  return {
    ...actual,
    getWindowsForHalf: vi.fn(),
    getCropsByIds: vi.fn(),
    listCrops: vi.fn()
  };
});

import { getCropsByIds, getWindowsForHalf, listCrops } from '../lib/db';

const getWindowsForHalfMock = vi.mocked(getWindowsForHalf);
const getCropsByIdsMock = vi.mocked(getCropsByIds);
const listCropsMock = vi.mocked(listCrops);

/**
 * Minimal D1 mock for COUNT(*) used by the method-filter branch of groundFilters.
 * getWindowsForCropMethod does: prepare(sql).bind(cropId, method).first()
 *
 * @param countByKey - Map of `${cropId}:${method}` to window count.
 */
function mockD1(countByKey: Record<string, number> = {}): D1Database {
  const prepare = vi.fn(() => ({
    bind: (cropId: string, method: string) => ({
      first: async () => ({ n: countByKey[`${cropId}:${method}`] ?? 0 }),
      all: async () => ({ results: [] }),
      run: async () => undefined,
      raw: async () => []
    }),
    first: async () => ({ n: 0 }),
    all: async () => ({ results: [] }),
    run: async () => undefined,
    raw: async () => []
  }));
  return { prepare } as unknown as D1Database;
}

/**
 * Build a window row for assistant grounding tests.
 *
 * @param cropId - Crop id.
 * @param method - S or T.
 */
function windowFor(cropId: string, method: 'S' | 'T'): WindowWithSource {
  return {
    id: `w-${cropId}-${method}`,
    crop_id: cropId,
    start_half_month: 14,
    end_half_month: 15,
    method,
    source_id: 'src-az1005',
      source_granularity: 'half-month',
    source_title: 'az1005',
    source_author: 'Kai Umeda',
    source_publisher: 'UA Extension',
    source_url: 'https://extension.arizona.edu/example',
    source_retrieved_at: '2026-01-15'
  };
}

const tomato: CropRow = {
  id: 'crop-tomatoes',
  name: 'Tomatoes',
  days_to_harvest_min: 60,
  days_to_harvest_max: 90,
  notes: null
};

const lettuce: CropRow = {
  id: 'crop-lettuce',
  name: 'Lettuce',
  days_to_harvest_min: 40,
  days_to_harvest_max: 55,
  notes: null
};

/**
 * Workers AI returns text in two different shapes depending on the model.
 */
describe('modelText', () => {
  it('reads the OpenAI-style shape current models return', () => {
    const result: ModelResult = {
      response: '',
      choices: [{ message: { content: '{"half_month":14}' } }]
    };
    expect(modelText(result)).toBe('{"half_month":14}');
  });

  it('still reads the legacy response field', () => {
    expect(modelText({ response: '{"method":"S"}' })).toBe('{"method":"S"}');
  });

  it('prefers choices when both are present and response is blank', () => {
    expect(
      modelText({ response: '   ', choices: [{ message: { content: 'real' } }] })
    ).toBe('real');
  });

  it('returns empty string when the model genuinely produced nothing', () => {
    expect(modelText({ response: '', choices: [] })).toBe('');
    expect(modelText({})).toBe('');
  });
});

describe('extractJsonObject', () => {
  it('parses raw JSON', () => {
    expect(extractJsonObject('{"half_month":14,"method":"T"}')).toEqual({
      half_month: 14,
      method: 'T'
    });
  });

  it('parses fenced JSON', () => {
    expect(extractJsonObject('```json\n{"crop":"tomato"}\n```')).toEqual({
      crop: 'tomato'
    });
  });

  it('throws when there is no object', () => {
    expect(() => extractJsonObject('not json at all')).toThrow();
  });
});

describe('AssistantFiltersSchema', () => {
  it('accepts empty filters', () => {
    expect(AssistantFiltersSchema.parse({})).toEqual({});
  });

  it('accepts half_month, method, crop', () => {
    expect(
      AssistantFiltersSchema.parse({ half_month: 14, method: 'S', crop: 'tomato' })
    ).toEqual({ half_month: 14, method: 'S', crop: 'tomato' });
  });

  it('rejects half_month out of range', () => {
    expect(AssistantFiltersSchema.safeParse({ half_month: 24 }).success).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(AssistantFiltersSchema.safeParse({ prose: 'nope' }).success).toBe(false);
  });
});

describe('buildAnswer', () => {
  const sample: AssistantCrop[] = [
    { id: 'c1', name: 'Tomatoes', methods: ['T'] },
    { id: 'c2', name: 'Peppers', methods: ['T'] }
  ];

  it('builds a half-month count sentence from real rows', () => {
    const text = buildAnswer(sample, { half_month: 14 });
    expect(text).toMatch(/2 crops can go in/i);
    expect(text).toMatch(/Aug 1/);
    expect(text).toContain('Tomatoes');
    expect(text).toContain('Peppers');
    expect(text).toContain('az1005');
  });

  it('handles empty crop list without inventing plants', () => {
    const text = buildAnswer([], { half_month: 14, method: 'S' });
    expect(text).toMatch(/No crops/i);
    expect(text).not.toMatch(/tomato/i);
  });

  it('names a crop search result', () => {
    const text = buildAnswer(
      [{ id: 'c1', name: 'Tomatoes', methods: [] }],
      { crop: 'tomato' }
    );
    expect(text).toMatch(/1 crop matching "tomato"/i);
    expect(text).toContain('Tomatoes');
  });
});

/**
 * Production path: groundFilters is what answers every assistant request.
 * Cover half_month, crop, method, and empty-filter branches against a fake D1.
 */
describe('groundFilters', () => {
  beforeEach(() => {
    getWindowsForHalfMock.mockReset();
    getCropsByIdsMock.mockReset();
    listCropsMock.mockReset();
  });

  it('half_month branch: loads windows for the half and returns sorted crops', async () => {
    getWindowsForHalfMock.mockResolvedValueOnce([
      windowFor('crop-tomatoes', 'T'),
      windowFor('crop-lettuce', 'S')
    ]);
    getCropsByIdsMock.mockResolvedValueOnce(
      new Map([
        [tomato.id, tomato],
        [lettuce.id, lettuce]
      ])
    );

    const { crops, answer } = await groundFilters(mockD1(), { half_month: 14 });
    expect(getWindowsForHalfMock).toHaveBeenCalledWith(expect.anything(), 14, undefined);
    expect(crops.map((c) => c.name)).toEqual(['Lettuce', 'Tomatoes']);
    expect(answer).toMatch(/2 crops can go in/i);
    expect(answer).toContain('az1005');
  });

  it('half_month + method branch: passes method into getWindowsForHalf', async () => {
    getWindowsForHalfMock.mockResolvedValueOnce([windowFor('crop-lettuce', 'S')]);
    getCropsByIdsMock.mockResolvedValueOnce(new Map([[lettuce.id, lettuce]]));

    const { crops, answer } = await groundFilters(mockD1(), {
      half_month: 14,
      method: 'S'
    });
    expect(getWindowsForHalfMock).toHaveBeenCalledWith(expect.anything(), 14, 'S');
    expect(crops).toHaveLength(1);
    expect(crops[0]?.methods).toEqual(['S']);
    expect(answer).toMatch(/seeded/i);
  });

  it('half_month + crop branch: narrows window results by crop name fragment', async () => {
    getWindowsForHalfMock.mockResolvedValueOnce([
      windowFor('crop-tomatoes', 'T'),
      windowFor('crop-lettuce', 'S')
    ]);
    getCropsByIdsMock.mockResolvedValueOnce(
      new Map([
        [tomato.id, tomato],
        [lettuce.id, lettuce]
      ])
    );

    const { crops, answer } = await groundFilters(mockD1(), {
      half_month: 14,
      crop: 'tomato'
    });
    expect(crops).toHaveLength(1);
    expect(crops[0]?.name).toBe('Tomatoes');
    expect(answer).toContain('Tomatoes');
  });

  it('half_month branch with no windows: empty crops and no invented plants', async () => {
    getWindowsForHalfMock.mockResolvedValueOnce([]);
    getCropsByIdsMock.mockResolvedValueOnce(new Map());

    const { crops, answer } = await groundFilters(mockD1(), { half_month: 14 });
    expect(crops).toEqual([]);
    expect(answer).toMatch(/No crops/i);
    expect(answer).not.toMatch(/tomato/i);
  });

  it('crop branch: lists matching crops from listCrops without method filter', async () => {
    listCropsMock.mockResolvedValueOnce([{ ...tomato, window_count: 2 }]);

    const { crops, answer } = await groundFilters(mockD1(), { crop: 'tomato' });
    expect(listCropsMock).toHaveBeenCalledWith(expect.anything(), 'tomato');
    expect(crops).toEqual([{ id: tomato.id, name: tomato.name, methods: [] }]);
    expect(answer).toMatch(/matching "tomato"/i);
  });

  it('crop + method branch: keeps only crops with a window of that method', async () => {
    listCropsMock.mockResolvedValueOnce([
      { ...tomato, window_count: 1 },
      { ...lettuce, window_count: 1 }
    ]);
    // Tomato has transplant windows; lettuce does not for method T.
    const db = mockD1({
      'crop-tomatoes:T': 1,
      'crop-lettuce:T': 0
    });

    const { crops, answer } = await groundFilters(db, {
      crop: 't',
      method: 'T'
    });
    expect(crops).toEqual([{ id: tomato.id, name: tomato.name, methods: ['T'] }]);
    expect(answer).toMatch(/transplant windows/i);
  });

  it('method-only branch: lists every crop that has a window of that method', async () => {
    listCropsMock.mockResolvedValueOnce([
      { ...tomato, window_count: 1 },
      { ...lettuce, window_count: 1 }
    ]);
    const db = mockD1({
      'crop-tomatoes:S': 0,
      'crop-lettuce:S': 2
    });

    const { crops, answer } = await groundFilters(db, { method: 'S' });
    expect(listCropsMock).toHaveBeenCalledWith(expect.anything());
    expect(crops).toEqual([{ id: lettuce.id, name: lettuce.name, methods: ['S'] }]);
    expect(answer).toMatch(/seed windows/i);
  });

  it('empty-filter branch: returns the full crop list from listCrops', async () => {
    listCropsMock.mockResolvedValueOnce([
      { ...lettuce, window_count: 1 },
      { ...tomato, window_count: 1 }
    ]);

    const { crops, answer } = await groundFilters(mockD1(), {});
    expect(listCropsMock).toHaveBeenCalledWith(expect.anything());
    expect(crops.map((c) => c.name)).toEqual(['Lettuce', 'Tomatoes']);
    expect(answer).toMatch(/are in this calendar/i);
  });
});
