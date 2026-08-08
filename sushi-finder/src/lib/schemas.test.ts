import { describe, expect, it } from 'vitest';
import {
  AssistantRequestSchema,
  SushiCreateSchema,
  SushiRowSchema
} from './schemas';

describe('SushiRowSchema', () => {
  it('SushiRowSchema_acceptsValidRow', () => {
    const row = SushiRowSchema.parse({
      id: 'sushi_jiro',
      title: 'Sukiyabashi Jiro',
      description: 'Omakase in Ginza',
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-01-15T10:00:00.000Z'
    });
    expect(row.id).toBe('sushi_jiro');
  });

  it('SushiRowSchema_rejectsMissingId', () => {
    const result = SushiRowSchema.safeParse({
      title: 'x',
      description: '',
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-01-15T10:00:00.000Z'
    });
    expect(result.success).toBe(false);
  });
});

describe('SushiCreateSchema', () => {
  it('SushiCreateSchema_requiresTitle', () => {
    const result = SushiCreateSchema.safeParse({ title: '   ', description: 'x' });
    expect(result.success).toBe(false);
  });

  it('SushiCreateSchema_acceptsValid', () => {
    const row = SushiCreateSchema.parse({ title: 'Test Place', description: 'Notes' });
    expect(row.title).toBe('Test Place');
    expect(row.description).toBe('Notes');
  });
});

describe('AssistantRequestSchema', () => {
  it('assistantBodySchema_rejectsEmptyMessage', () => {
    const result = AssistantRequestSchema.safeParse({ message: '  ' });
    expect(result.success).toBe(false);
  });
});
