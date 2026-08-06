import { describe, it, expect } from 'vitest';
import {
  deriveEntities,
  entityPascal,
  isTitleFragment,
  primaryEntity,
  requirementLines,
  stripGeneratorDirectives,
  titleFromPrompt
} from './naming';

const PLANTING = [
  'Show what is plantable in the current half-month window, seed vs transplant marked.',
  'Full year calendar grid: crops down, 24 half-month columns across.',
  'Crop detail: days to harvest, notes, every planting window.',
  'Filter by month and by seed/transplant.',
  'Every planting window cites AZ1005 (Vegetable Planting Calendar for Maricopa County).',
  'Cave Creek, AZ elevation note.',
  '(reverse engineer features from this https://www.almanac.com/gardening/planting-calendar)'
].join('\n');

describe('deriveEntities', () => {
  it('pulls domain nouns from a planting-calendar prompt', () => {
    const entities = deriveEntities(PLANTING);
    expect(entities.map((e) => e.toLowerCase())).toEqual(
      expect.arrayContaining(['crop', 'plantingwindow'])
    );
    expect(entities).not.toContain('Item');
  });

  it('returns empty when nothing domain-like is present (fail closed)', () => {
    expect(deriveEntities('!!!')).toEqual([]);
    expect(deriveEntities('a simple app')).toEqual([]);
  });

  it('derives from a status-page prompt without inventing Item', () => {
    const entities = deriveEntities('Simple status page for uptime checks');
    expect(entities.length).toBeGreaterThan(0);
    expect(entities).not.toContain('Item');
  });
});

describe('titleFromPrompt / isTitleFragment', () => {
  it('names a short product phrase, not a truncated multi-line sentence', () => {
    const title = titleFromPrompt(PLANTING);
    expect(title.length).toBeLessThan(48);
    expect(title.toLowerCase()).not.toMatch(/seed vs/);
    expect(isTitleFragment(title)).toBe(false);
  });

  it('does not end on a dangling connective', () => {
    const title = titleFromPrompt(
      'a mobile-first app that finds the lowest cost airline flight with nonstop only'
    );
    expect(title).not.toMatch(/\b(with|for|the|a|an|to|of|and)$/i);
    expect(isTitleFragment(title)).toBe(false);
  });

  it('flags long imperative titles as fragments', () => {
    expect(
      isTitleFragment('Show What Is Plantable In the Current Half Month Window Seed Vs')
    ).toBe(true);
  });

  it('(f) Find-and-book pet sitters → noun-phrase title/slug; old mangled title is a fragment', () => {
    // Measured bug: "Find and book trusted local pet sitters" became
    // title "And Book Trusted Local Pet Sitters" / slug and-book-trusted-...
    const prompt = 'Find and book trusted local pet sitters';
    const title = titleFromPrompt(prompt);
    expect(title.toLowerCase()).not.toMatch(/^and\b/);
    expect(title.toLowerCase()).not.toMatch(/^book\b/);
    expect(title.toLowerCase()).not.toMatch(/^find\b/);
    expect(title.toLowerCase()).toMatch(/pet\s+sitter/);
    expect(isTitleFragment(title)).toBe(false);
    // Old broken output must now be flagged.
    expect(isTitleFragment('And Book Trusted Local Pet Sitters')).toBe(true);
    expect(isTitleFragment('Book Trusted Local Pet Sitters')).toBe(true);
  });
});

describe('stripGeneratorDirectives / requirementLines', () => {
  it('strips reverse-engineer clauses and bare URLs into references', () => {
    const { productPrompt, references } = stripGeneratorDirectives(PLANTING);
    expect(productPrompt.toLowerCase()).not.toContain('reverse engineer');
    expect(productPrompt).not.toMatch(/https?:\/\//);
    expect(references.some((r) => /almanac\.com/i.test(r))).toBe(true);
  });

  it('splits multi-line prompts into requirement lines', () => {
    const lines = requirementLines(PLANTING);
    expect(lines.length).toBeGreaterThanOrEqual(5);
    expect(lines.some((l) => /seed vs transplant/i.test(l))).toBe(true);
    expect(lines.some((l) => /days to harvest/i.test(l))).toBe(true);
    expect(lines.every((l) => !/reverse engineer/i.test(l))).toBe(true);
  });
});

describe('primaryEntity / entityPascal', () => {
  it('never invents Item for an empty list', () => {
    expect(primaryEntity([])).toBeNull();
    expect(entityPascal('')).toBe('');
  });

  it('normalises the primary entity', () => {
    expect(primaryEntity(['trips', 'drivers'])).toBe('Trip');
  });
});
