import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  entityPascal,
  hasPronounHead,
  isTitleFragment,
  primaryEntity,
  requirementLines,
  stripGeneratorDirectives,
  titleFromPrompt
} from './naming';

/**
 * The overnight prompt that produced title "Real" / entities ["Spreadsheet"].
 * Read from disk so a paraphrase cannot silently replace it.
 */
const JOB_APPLICATION_PROMPT = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
    '.redanvil',
    'overnight',
    'concept-job-application-site.txt'
  ),
  'utf8'
);

const PLANTING = [
  'Show what is plantable in the current half-month window, seed vs transplant marked.',
  'Full year calendar grid: crops down, 24 half-month columns across.',
  'Crop detail: days to harvest, notes, every planting window.',
  'Filter by month and by seed/transplant.',
  'Every planting window cites AZ1005 (Vegetable Planting Calendar for Maricopa County).',
  'Cave Creek, AZ elevation note.',
  '(reverse engineer features from this https://www.almanac.com/gardening/planting-calendar)'
].join('\n');

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

describe('job-application-site prompt (overnight, exact file)', () => {
  it('does not title the product "Real" (adjective lifted from mid-sentence)', () => {
    // Known-bad output from this prompt: title "Real" / slug "real", taken
    // from "shows real, current job openings". A single leading adjective is
    // not a product name.
    expect(JOB_APPLICATION_PROMPT).toMatch(/shows real, current job openings/);
    expect(isTitleFragment('Real')).toBe(true);
    const title = titleFromPrompt(JOB_APPLICATION_PROMPT);
    expect(title.toLowerCase()).not.toBe('real');
    expect(isTitleFragment(title)).toBe(false);
    expect(title.toLowerCase()).toMatch(/job/);
  });

  it('rejects a pronoun-headed phrase as an entity, not only one wording', () => {
    expect(hasPronounHead('ones they sent')).toBe(true);
    expect(hasPronounHead('them')).toBe(true);
    expect(hasPronounHead('those')).toBe(true);
    expect(hasPronounHead('those listings')).toBe(false);
    expect(hasPronounHead('Application')).toBe(false);
  });
});
