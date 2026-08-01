import { describe, expect, it, vi } from 'vitest';
import {
  escapeLike,
  getCrop,
  getDefaultZone,
  getWindowsForCrop,
  listCrops,
  windowToApi,
  type CropRow,
  type WindowWithSource,
  type ZoneRow
} from './db';

/**
 * Minimal D1 mock: records the last SQL/binds and returns a fixed result shape.
 */
function mockDb(result: {
  first?: unknown;
  all?: unknown[];
}): D1Database {
  const first = vi.fn(async () => result.first ?? null);
  const all = vi.fn(async () => ({ results: result.all ?? [] }));
  const bind = vi.fn(() => ({ first, all, bind, run: vi.fn(), raw: vi.fn() }));
  const prepare = vi.fn(() => ({ bind, first, all, run: vi.fn(), raw: vi.fn() }));
  return { prepare } as unknown as D1Database;
}

describe('getDefaultZone', () => {
  it('queries the Cave Creek default zone id and returns the row', async () => {
    const zone: ZoneRow = {
      id: 'zone-cave-creek-85331',
      name: 'Cave Creek low desert',
      zip: '85331',
      last_frost: 'Feb 15',
      first_frost: 'Nov 25'
    };
    const db = mockDb({ first: zone });
    const got = await getDefaultZone(db);
    expect(got).toEqual(zone);
    expect(db.prepare).toHaveBeenCalled();
    const prepareMock = db.prepare as ReturnType<typeof vi.fn>;
    const firstCall = prepareMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const sql = String(firstCall?.[0] ?? '');
    expect(sql).toMatch(/FROM zones/i);
    expect(sql).toMatch(/\?/);
  });

  it('returns null when the zone row is missing', async () => {
    const db = mockDb({ first: null });
    expect(await getDefaultZone(db)).toBeNull();
  });
});

describe('getCrop', () => {
  it('binds the crop id and returns the crop row', async () => {
    const crop: CropRow = {
      id: 'crop-tomatoes',
      name: 'Tomatoes',
      days_to_harvest_min: 60,
      days_to_harvest_max: 90,
      notes: null
    };
    const stmt = {
      bind: vi.fn(() => ({
        first: vi.fn(async () => crop),
        all: vi.fn(),
        run: vi.fn(),
        raw: vi.fn()
      })),
      first: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
      raw: vi.fn()
    };
    const prepare = vi.fn(() => stmt);
    const db = { prepare } as unknown as D1Database;
    const got = await getCrop(db, 'crop-tomatoes');
    expect(got).toEqual(crop);
    expect(stmt.bind).toHaveBeenCalledWith('crop-tomatoes');
  });

  it('returns null for unknown crop ids', async () => {
    const stmt = {
      bind: vi.fn(() => ({
        first: vi.fn(async () => null),
        all: vi.fn(),
        run: vi.fn(),
        raw: vi.fn()
      })),
      first: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
      raw: vi.fn()
    };
    const db = { prepare: vi.fn(() => stmt) } as unknown as D1Database;
    expect(await getCrop(db, 'crop-does-not-exist')).toBeNull();
  });
});

describe('getWindowsForCrop', () => {
  it('returns joined window rows for a crop id', async () => {
    const rows: WindowWithSource[] = [
      {
        id: 'w1',
        crop_id: 'crop-tomatoes',
        start_half_month: 2,
        end_half_month: 5,
        method: 'T',
        source_id: 'src-az1005',
        source_title: 'Vegetable Planting Calendar for Maricopa County',
        source_author: 'Kai Umeda',
        source_publisher: 'University of Arizona Cooperative Extension',
        source_url: 'https://extension.arizona.edu/publication/vegetable-planting-calendar-maricopa-county',
        source_retrieved_at: '2026-01-15'
      }
    ];
    const stmt = {
      bind: vi.fn(() => ({
        first: vi.fn(),
        all: vi.fn(async () => ({ results: rows })),
        run: vi.fn(),
        raw: vi.fn()
      })),
      first: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
      raw: vi.fn()
    };
    const db = { prepare: vi.fn(() => stmt) } as unknown as D1Database;
    const got = await getWindowsForCrop(db, 'crop-tomatoes');
    expect(got).toEqual(rows);
    expect(stmt.bind).toHaveBeenCalledWith('crop-tomatoes');
  });
});

describe('listCrops', () => {
  it('lists all crops when q is omitted', async () => {
    const rows = [
      {
        id: 'crop-tomatoes',
        name: 'Tomatoes',
        days_to_harvest_min: 60,
        days_to_harvest_max: 90,
        notes: null,
        window_count: 2
      }
    ];
    const all = vi.fn(async () => ({ results: rows }));
    const bind = vi.fn(() => ({ all, first: vi.fn(), run: vi.fn(), raw: vi.fn() }));
    const prepare = vi.fn(() => ({ bind, all, first: vi.fn(), run: vi.fn(), raw: vi.fn() }));
    const db = { prepare } as unknown as D1Database;
    const got = await listCrops(db);
    expect(got).toEqual(rows);
    expect(prepare).toHaveBeenCalled();
    const firstCall = prepare.mock.calls[0] as unknown as [string] | undefined;
    const sql = String(firstCall?.[0] ?? '');
    expect(sql).toMatch(/FROM crops/i);
    expect(sql).not.toMatch(/LIKE/i);
    expect(bind).not.toHaveBeenCalled();
  });

  it('filters by crop name with parameterized LIKE when q is set', async () => {
    const rows = [
      {
        id: 'crop-tomatoes',
        name: 'Tomatoes',
        days_to_harvest_min: 60,
        days_to_harvest_max: 90,
        notes: null,
        window_count: 2
      }
    ];
    const all = vi.fn(async () => ({ results: rows }));
    const bind = vi.fn(() => ({ all, first: vi.fn(), run: vi.fn(), raw: vi.fn() }));
    const prepare = vi.fn(() => ({ bind, all, first: vi.fn(), run: vi.fn(), raw: vi.fn() }));
    const db = { prepare } as unknown as D1Database;
    const got = await listCrops(db, 'tomato');
    expect(got).toEqual(rows);
    const firstCall = prepare.mock.calls[0] as unknown as [string] | undefined;
    const sql = String(firstCall?.[0] ?? '');
    expect(sql).toMatch(/LIKE \? ESCAPE/i);
    expect(sql).toMatch(/\?/);
    expect(bind).toHaveBeenCalledWith('%tomato%');
  });

  it('escapes LIKE wildcards in the search fragment', async () => {
    const all = vi.fn(async () => ({ results: [] }));
    const bind = vi.fn(() => ({ all, first: vi.fn(), run: vi.fn(), raw: vi.fn() }));
    const prepare = vi.fn(() => ({ bind, all, first: vi.fn(), run: vi.fn(), raw: vi.fn() }));
    const db = { prepare } as unknown as D1Database;
    await listCrops(db, '100%_sure');
    expect(bind).toHaveBeenCalledWith('%100\\%\\_sure%');
  });
});

describe('escapeLike', () => {
  it('escapes backslash, percent, and underscore', () => {
    expect(escapeLike('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
  });
});

describe('windowToApi', () => {
  it('nests source fields under source and keeps method and halves', () => {
    const row: WindowWithSource = {
      id: 'w1',
      crop_id: 'crop-beans',
      start_half_month: 4,
      end_half_month: 6,
      method: 'S',
      source_id: 'src-az1005',
      source_title: 'Vegetable Planting Calendar for Maricopa County',
      source_author: 'Kai Umeda',
      source_publisher: 'University of Arizona Cooperative Extension',
      source_url: 'https://extension.arizona.edu/example',
      source_retrieved_at: '2026-01-15'
    };
    expect(windowToApi(row)).toEqual({
      id: 'w1',
      crop_id: 'crop-beans',
      start_half_month: 4,
      end_half_month: 6,
      method: 'S',
      source_id: 'src-az1005',
      source: {
        id: 'src-az1005',
        title: 'Vegetable Planting Calendar for Maricopa County',
        author: 'Kai Umeda',
        publisher: 'University of Arizona Cooperative Extension',
        url: 'https://extension.arizona.edu/example',
        retrieved_at: '2026-01-15'
      }
    });
  });
});
