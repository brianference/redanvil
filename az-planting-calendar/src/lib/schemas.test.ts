import { describe, expect, it } from 'vitest';
import {
  CropSchema,
  FilterQuerySchema,
  HealthResponseSchema,
  MethodSchema,
  PlantableQuerySchema,
  PlantingWindowSchema,
  SourceSchema
} from './schemas';

describe('MethodSchema', () => {
  it('accepts S and T only', () => {
    expect(MethodSchema.parse('S')).toBe('S');
    expect(MethodSchema.parse('T')).toBe('T');
    expect(() => MethodSchema.parse('X')).toThrow();
    expect(() => MethodSchema.parse('seed')).toThrow();
  });
});

describe('SourceSchema', () => {
  it('requires a valid URL', () => {
    const ok = SourceSchema.parse({
      id: 'src-1',
      title: 'Calendar',
      author: 'Kai Umeda',
      publisher: 'UA Extension',
      url: 'https://extension.arizona.edu/publication/vegetable-planting-calendar-maricopa-county',
      retrieved_at: '2026-08-01'
    });
    expect(ok.id).toBe('src-1');
    expect(() =>
      SourceSchema.parse({
        id: 'x',
        title: 't',
        author: 'a',
        publisher: 'p',
        url: 'not-a-url',
        retrieved_at: '2026-08-01'
      })
    ).toThrow();
  });
});

describe('CropSchema', () => {
  it('allows null harvest days', () => {
    const crop = CropSchema.parse({
      id: 'crop-tomatoes',
      name: 'Tomatoes',
      days_to_harvest_min: 50,
      days_to_harvest_max: 120,
      notes: '50-120 days'
    });
    expect(crop.name).toBe('Tomatoes');
    const open = CropSchema.parse({
      id: 'crop-asparagus',
      name: 'Asparagus',
      days_to_harvest_min: null,
      days_to_harvest_max: null,
      notes: '2-3 years'
    });
    expect(open.days_to_harvest_min).toBeNull();
  });
});

describe('PlantingWindowSchema', () => {
  it('enforces half-month bounds and method', () => {
    const w = PlantingWindowSchema.parse({
      id: 'pw-1',
      crop_id: 'crop-tomatoes',
      start_half_month: 3,
      end_half_month: 5,
      method: 'T',
      source_id: 'src-az1005-maricopa'
    });
    expect(w.start_half_month).toBe(3);
    expect(() =>
      PlantingWindowSchema.parse({
        id: 'pw-bad',
        crop_id: 'c',
        start_half_month: 24,
        end_half_month: 0,
        method: 'T',
        source_id: 's'
      })
    ).toThrow();
  });
});

describe('query schemas', () => {
  it('parses plantable date and filters', () => {
    expect(PlantableQuerySchema.parse({ date: '2026-03-01' }).date).toBe('2026-03-01');
    expect(() => PlantableQuerySchema.parse({ date: '03-01-2026' })).toThrow();
    expect(FilterQuerySchema.parse({ method: 'S', month: 2 })).toEqual({
      method: 'S',
      month: 2
    });
    expect(() => FilterQuerySchema.parse({ month: 12 })).toThrow();
  });

  it('validates health payload', () => {
    expect(HealthResponseSchema.parse({ status: 'ok' }).status).toBe('ok');
    expect(() => HealthResponseSchema.parse({ status: 'down' })).toThrow();
  });
});
