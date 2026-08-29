import { describe, it, expect } from 'vitest';
import {
  AssistantRequestSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SessionResponseSchema,
  ShortlistResponseSchema,
  SittersQuerySchema
} from './schemas';

describe('AssistantRequestSchema', () => {
  it('accepts a short message', () => {
    const r = AssistantRequestSchema.safeParse({ message: 'dogs in Leslieville' });
    expect(r.success).toBe(true);
  });

  it('rejects empty and oversized messages', () => {
    expect(AssistantRequestSchema.safeParse({ message: '' }).success).toBe(false);
    expect(AssistantRequestSchema.safeParse({ message: 'x'.repeat(501) }).success).toBe(
      false
    );
  });
});

describe('SittersQuerySchema', () => {
  it('accepts empty query objects', () => {
    expect(SittersQuerySchema.safeParse({}).success).toBe(true);
  });

  it('coerces max_rate and accepts filters', () => {
    const r = SittersQuerySchema.safeParse({
      q: 'Leslieville',
      neighbourhood: 'Leslieville',
      pet_type: 'dogs',
      max_rate: '60'
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.max_rate).toBe(60);
    }
  });
});

describe('password length constants', () => {
  it('matches the server floor and ceiling', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(PASSWORD_MAX_LENGTH).toBe(200);
  });
});

describe('SessionResponseSchema', () => {
  it('accepts a signed-out snapshot', () => {
    const r = SessionResponseSchema.safeParse({
      email: null,
      emailVerified: false,
      enabled: true
    });
    expect(r.success).toBe(true);
  });
});

describe('ShortlistResponseSchema', () => {
  it('accepts a profile with a shortlist row', () => {
    const r = ShortlistResponseSchema.safeParse({
      profile: { display_name: 'Ada', role: 'owner' },
      items: [
        {
          sitter_id: 'sit-leslieville-01',
          name: 'Avery Chen',
          neighbourhood: 'Leslieville',
          rate_per_night: 55,
          added_at: 1,
          note: null
        }
      ]
    });
    expect(r.success).toBe(true);
  });

  it('rejects an unknown role', () => {
    const r = ShortlistResponseSchema.safeParse({
      profile: { display_name: 'Ada', role: 'admin' },
      items: []
    });
    expect(r.success).toBe(false);
  });
});
