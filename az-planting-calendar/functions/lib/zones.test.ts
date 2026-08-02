import { describe, expect, it, vi } from 'vitest';
import {
  escapeLike,
  listZones,
  resolveZone,
  resolveZoneParam,
  type ZoneRow
} from './db';

/**
 * Minimal D1 mock that returns different results based on SQL shape.
 */
function mockDb(handlers: {
  first?: (sql: string, binds: unknown[]) => unknown;
  all?: (sql: string, binds: unknown[]) => unknown[];
}): D1Database {
  const first = vi.fn(async function (this: { _sql: string; _binds: unknown[] }) {
    return handlers.first?.(this._sql, this._binds) ?? null;
  });
  const all = vi.fn(async function (this: { _sql: string; _binds: unknown[] }) {
    return { results: handlers.all?.(this._sql, this._binds) ?? [] };
  });
  const bind = vi.fn(function (this: { _sql: string }, ...binds: unknown[]) {
    const ctx = { _sql: this._sql, _binds: binds, first, all, bind, run: vi.fn(), raw: vi.fn() };
    return {
      first: first.bind(ctx),
      all: all.bind(ctx),
      bind,
      run: vi.fn(),
      raw: vi.fn()
    };
  });
  const prepare = vi.fn((sql: string) => {
    const ctx = { _sql: sql, _binds: [] as unknown[], first, all, bind, run: vi.fn(), raw: vi.fn() };
    return {
      bind: (...binds: unknown[]) => {
        ctx._binds = binds;
        return {
          first: async () => handlers.first?.(sql, binds) ?? null,
          all: async () => ({ results: handlers.all?.(sql, binds) ?? [] }),
          run: vi.fn(),
          raw: vi.fn()
        };
      },
      first: async () => handlers.first?.(sql, []) ?? null,
      all: async () => ({ results: handlers.all?.(sql, []) ?? [] }),
      run: vi.fn(),
      raw: vi.fn()
    };
  });
  return { prepare } as unknown as D1Database;
}

const caveCreek: ZoneRow = {
  id: 'zone-cave-creek-85331',
  name: 'Cave Creek AZ (low desert, Maricopa County)',
  zip: '85331',
  last_frost: '02-20',
  first_frost: '12-06',
  county: 'Maricopa',
  elevation_ft: 2529
};

const phoenix: ZoneRow = {
  id: 'zone-phoenix-85004',
  name: 'Phoenix AZ (low desert, Maricopa County)',
  zip: '85004',
  last_frost: '02-03',
  first_frost: '12-08',
  county: 'Maricopa',
  elevation_ft: 1154
};

describe('escapeLike', () => {
  it('escapes wildcards', () => {
    expect(escapeLike('a%b_c')).toBe('a\\%b\\_c');
  });
});

describe('resolveZone', () => {
  it('resolves by exact zone id', async () => {
    const db = mockDb({
      first: (sql, binds) => {
        if (sql.includes('WHERE id = ?') && binds[0] === 'zone-cave-creek-85331') {
          return caveCreek;
        }
        return null;
      }
    });
    const got = await resolveZone(db, 'zone-cave-creek-85331');
    expect(got?.id).toBe('zone-cave-creek-85331');
  });

  it('resolves by ZIP when id misses', async () => {
    const db = mockDb({
      first: (sql, binds) => {
        if (sql.includes('WHERE id = ?')) return null;
        if (sql.includes('WHERE zip = ?') && binds[0] === '85004') return phoenix;
        return null;
      }
    });
    const got = await resolveZone(db, '85004');
    expect(got?.name).toMatch(/Phoenix/i);
  });

  it('resolves by city name fragment', async () => {
    const db = mockDb({
      first: (sql, binds) => {
        if (sql.includes('WHERE id = ?')) return null;
        if (sql.includes('WHERE zip = ?')) return null;
        if (sql.includes('LIKE') && String(binds[0]).toLowerCase().includes('cave')) {
          return caveCreek;
        }
        return null;
      }
    });
    const got = await resolveZone(db, 'cave creek');
    expect(got?.zip).toBe('85331');
  });

  it('returns null on miss', async () => {
    const db = mockDb({
      first: () => null
    });
    expect(await resolveZone(db, 'zzznomatch')).toBeNull();
  });
});

describe('resolveZoneParam', () => {
  it('defaults to Cave Creek when zone param omitted', async () => {
    const db = mockDb({
      first: (sql, binds) => {
        if (binds[0] === 'zone-cave-creek-85331') return caveCreek;
        return null;
      }
    });
    const result = await resolveZoneParam(db, undefined);
    expect('zone' in result && result.zone.id).toBe('zone-cave-creek-85331');
  });

  it('returns not_found for a bad lookup', async () => {
    const db = mockDb({ first: () => null });
    const result = await resolveZoneParam(db, 'nope');
    expect(result).toEqual({ error: 'not_found' });
  });
});

describe('listZones', () => {
  it('lists all when q is empty', async () => {
    const db = mockDb({
      all: () => [caveCreek, phoenix]
    });
    const rows = await listZones(db);
    expect(rows).toHaveLength(2);
  });

  it('filters by q when provided', async () => {
    const db = mockDb({
      all: (_sql, binds) => {
        expect(String(binds[0])).toContain('phoe');
        return [phoenix];
      }
    });
    const rows = await listZones(db, 'phoe');
    expect(rows).toEqual([phoenix]);
  });
});
