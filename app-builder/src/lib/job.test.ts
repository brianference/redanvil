import { describe, it, expect } from 'vitest';
import { buildJob, countEntities, slugFromPrompt } from './job';

describe('slugFromPrompt', () => {
  it('derives a kebab-case slug from the prompt', () => {
    expect(slugFromPrompt('Build a Recipe App with Search')).toBe('build-a-recipe-app-with-search');
  });

  it('falls back when the prompt has no usable characters', () => {
    expect(slugFromPrompt('!!!')).toBe('app');
  });
});

describe('countEntities', () => {
  it('counts comma-separated entity names', () => {
    expect(countEntities('User, Recipe, Favorite')).toBe(3);
    expect(countEntities('')).toBe(0);
  });
});

describe('buildJob', () => {
  it('constructs a fullstack-web job with threshold 90, answers, and createdAt', () => {
    const now = new Date('2026-07-22T12:00:00.000Z');
    const job = buildJob(
      {
        prompt: 'Build a recipe box for home cooks',
        appType: 'content',
        hasAuth: true,
        entities: 'Recipe, User'
      },
      now
    );
    expect(job).toEqual({
      kind: 'job',
      slug: 'build-a-recipe-box-for-home-cooks',
      prompt: 'Build a recipe box for home cooks',
      targetType: 'fullstack-web',
      threshold: 90,
      answers: {
        appType: 'content',
        hasAuth: 'true',
        entities: 'Recipe, User'
      },
      createdAt: '2026-07-22T12:00:00.000Z'
    });
  });

  it('always uses threshold 90 and kebab-case slug from the prompt', () => {
    const job = buildJob({
      prompt: 'My Cool SaaS Dashboard!!!',
      appType: 'dashboard',
      hasAuth: false,
      entities: 'Account'
    });
    expect(job.threshold).toBe(90);
    expect(job.slug).toBe('my-cool-saas-dashboard');
    expect(job.kind).toBe('job');
    expect(job.targetType).toBe('fullstack-web');
    expect(job.answers.hasAuth).toBe('false');
    expect(typeof job.createdAt).toBe('string');
    expect(Number.isNaN(Date.parse(job.createdAt))).toBe(false);
  });
});
