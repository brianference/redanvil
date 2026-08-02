import { describe, it, expect } from 'vitest';
import {
  AssistantFiltersSchema,
  buildAnswer,
  extractJsonObject,
  modelText,
  type AssistantCrop,
  type ModelResult
} from './assistant';

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
