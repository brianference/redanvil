import { describe, it, expect } from 'vitest';
import {
  AssistantRequestSchema,
  AuthBodySchema,
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

describe('AuthBodySchema', () => {
  it('accepts sign-out without credentials', () => {
    expect(AuthBodySchema.safeParse({ action: 'sign-out' }).success).toBe(true);
  });

  it('requires email and password for sign-in and register', () => {
    expect(
      AuthBodySchema.safeParse({
        action: 'sign-in',
        email: 'a@example.com',
        password: 'long-enough-password'
      }).success
    ).toBe(true);
    expect(
      AuthBodySchema.safeParse({
        action: 'register',
        email: 'not-an-email',
        password: 'short'
      }).success
    ).toBe(false);
  });
});
