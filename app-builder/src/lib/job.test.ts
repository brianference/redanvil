import { describe, it, expect } from 'vitest';
import {
  buildJob,
  countEntities,
  slugFromPrompt,
  isPromptReady,
  isAppTypeReady,
  canForgePrd,
  DEFAULT_APP_TYPE,
  EMPTY_WIZARD_ANSWERS
} from './job';
import { en } from '../i18n/en';

describe('DEFAULT_APP_TYPE', () => {
  it('is one of the rendered chips, so the chip row opens with a selection', () => {
    // The chip is selected by string equality with `value.appType`. A default
    // that is not in this list selects nothing and looks like a bug.
    expect(en.wizard.appTypeChips).toContain(DEFAULT_APP_TYPE);
  });

  it('pre-fills the wizard so Scope is satisfied on first paint', () => {
    expect(EMPTY_WIZARD_ANSWERS.appType).toBe(DEFAULT_APP_TYPE);
    expect(isAppTypeReady(EMPTY_WIZARD_ANSWERS)).toBe(true);
  });
});

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
        entities: 'Recipe, User',
        dataStorage: 'simple',
        hasRealtime: 'false',
        integrations: ''
      },
      createdAt: '2026-07-22T12:00:00.000Z'
    });
  });

  it('always uses threshold 90 and kebab-case slug from the prompt', () => {
    const job = buildJob({
      prompt: 'My Cool SaaS Dashboard!!!',
      appType: 'dashboard',
      hasAuth: false,
      entities: 'Account',
      dataStorage: 'relational',
      hasRealtime: true,
      integrations: 'Stripe'
    });
    expect(job.threshold).toBe(90);
    expect(job.slug).toBe('my-cool-saas-dashboard');
    expect(job.kind).toBe('job');
    expect(job.targetType).toBe('fullstack-web');
    expect(job.answers.hasAuth).toBe('false');
    expect(job.answers.dataStorage).toBe('relational');
    expect(job.answers.hasRealtime).toBe('true');
    expect(job.answers.integrations).toBe('Stripe');
    expect(typeof job.createdAt).toBe('string');
    expect(Number.isNaN(Date.parse(job.createdAt))).toBe(false);
  });
});

describe('wizard readiness (canForgePrd)', () => {
  const base = {
    prompt: 'an app to remind me to clean my dog ears',
    appType: '',
    hasAuth: false,
    entities: '',
    dataStorage: 'simple' as const,
    hasRealtime: false,
    integrations: '',
    selectedFeatureIds: null as string[] | null
  };

  it('is not ready to forge when app type is empty — the exact production 400', () => {
    // User typed a real prompt but never picked an app type. The submit schema is
    // appType.min(1), so an empty one returned "String must contain at least 1
    // character(s)". The wizard must block this before it reaches the server.
    expect(isPromptReady(base)).toBe(true);
    expect(isAppTypeReady(base)).toBe(false);
    expect(canForgePrd(base)).toBe(false);
  });

  it('is not ready when app type is only whitespace', () => {
    expect(canForgePrd({ ...base, appType: '   ' })).toBe(false);
  });

  it('is ready once both prompt and app type are provided', () => {
    expect(canForgePrd({ ...base, appType: 'Mobile app' })).toBe(true);
  });

  it('is not ready when the prompt is too short even with an app type', () => {
    expect(canForgePrd({ ...base, prompt: 'short', appType: 'SaaS' })).toBe(false);
  });

  // The empty-selection branch was the one canForgePrd path no test reached: an
  // independent judge found it while every other branch was covered twice. It is
  // the whole point of the Features step — deselect everything and Forge must
  // refuse, rather than generate a PRD with no features in it.
  it('refuses to forge when the user has deselected every feature', () => {
    const ready = { ...base, appType: 'SaaS' };
    expect(canForgePrd({ ...ready, selectedFeatureIds: [] })).toBe(false);
    expect(canForgePrd({ ...ready, selectedFeatureIds: ['F1'] })).toBe(true);
    // null means "not chosen yet", which is not the same as "chosen none".
    expect(canForgePrd({ ...ready, selectedFeatureIds: null })).toBe(true);
  });
});
