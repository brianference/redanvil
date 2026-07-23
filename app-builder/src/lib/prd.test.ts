import { describe, it, expect } from 'vitest';
import { generatePrd } from './prd';
import { estimate } from './estimate';

const cost = estimate({ features: 3, hasAuth: true, entities: 2 });
const prd = generatePrd(
  {
    prompt: 'Build an app for tracking tesla driving stats',
    appType: 'dashboard',
    hasAuth: true,
    entities: 'trips, drivers'
  },
  cost
);

describe('generatePrd', () => {
  it('derives a schema-valid slug, non-empty title, and original prompt', () => {
    expect(prd.slug).toMatch(/^[a-z0-9][a-z0-9-]+$/);
    expect(prd.title.length).toBeGreaterThan(0);
    expect(prd.prompt).toBe('Build an app for tracking tesla driving stats');
  });

  it('does not truncate titles mid-phrase and embeds the full title in the markdown H1', () => {
    const long = generatePrd(
      {
        prompt: 'A Shift Scheduling app for Small Businesses with employee roles and swaps',
        appType: 'internal tool',
        hasAuth: true,
        entities: 'shifts, employees'
      },
      cost
    );
    // Must not end mid-word on the old 6-word cut ("…for Small")
    expect(long.title).not.toMatch(/for Small$/);
    expect(long.title.toLowerCase()).toContain('shift');
    expect(long.markdown.startsWith(`# Product Requirements Document — ${long.title}`)).toBe(
      true
    );
    // No ellipsis stuffed into the markdown heading
    expect(long.markdown.split('\n')[0]).not.toContain('…');
    expect(long.markdown.split('\n')[0]).not.toContain('...');
  });

  it('includes the required PRD sections', () => {
    const md = prd.markdown.toLowerCase();
    for (const section of [
      'summary',
      'core features',
      'data model',
      'tech stack',
      'test design',
      'initial build prompt'
    ]) {
      expect(md, section).toContain(section);
    }
  });

  it('embeds the enforced Cloudflare stack and the user entities', () => {
    expect(prd.markdown).toContain('Cloudflare');
    expect(prd.markdown).toContain('Web Crypto');
    expect(prd.markdown.toLowerCase()).toContain('trips');
  });
});
