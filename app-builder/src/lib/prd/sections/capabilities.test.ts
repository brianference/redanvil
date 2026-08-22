import { describe, it, expect } from 'vitest';
import { detectCapabilities, extractCriteria, extractSubject } from './capabilities';
import { buildFeatureSuggestions } from './features';

/**
 * The generator produced a CRUD app for every prompt because the prompt was
 * never passed to the feature derivation. A request for the lowest-cost flight
 * with layover and travel-time constraints yielded "Browse & search FlightTime"
 * over a table with `title` and `description` — no search, no constraints.
 */
const FLIGHT =
  'a full stack mobile first app that finds the lowest cost airline flight with specific nonstop, limit to one layover, duration of layover, arrival time, total travel time optimizations';

describe('capability detection', () => {
  it('keeps every constraint the user named', () => {
    const criteria = extractCriteria(FLIGHT);
    for (const expected of [
      'nonstop',
      'limit to one layover',
      'duration of layover',
      'arrival time',
      'total travel time'
    ]) {
      expect(criteria.join(' | ')).toContain(expected);
    }
  });

  it('reads the objective and subject from the prompt', () => {
    const [primary] = detectCapabilities(FLIGHT, ['flight times']);
    expect(primary?.kind).toBe('search-rank');
    expect(primary?.objective).toBe('lowest cost');
    expect(primary?.subject).toBe('airline flight');
  });

  it('falls back to the entity when the prompt only names software', () => {
    // "a shift scheduling app" yields the subject "app" — which names nothing.
    expect(extractSubject('a shift scheduling app for small teams', ['shifts'])).toBe('shift');
    expect(extractSubject('a simple tool', ['invoices'])).toBe('invoice');
  });

  it('does not use a pronoun as the capability subject', () => {
    expect(extractSubject('loses track of which ones they sent', ['Application'])).toBe(
      'Application'
    );
    expect(extractSubject('someone loses track of them after sending', ['Application'])).toBe(
      'Application'
    );
    expect(extractSubject('search those listings by title', ['Listing']).toLowerCase()).toMatch(
      /listing/
    );
  });

  it('is deterministic — a spec that changes on regeneration is not a spec', () => {
    expect(detectCapabilities(FLIGHT, ['flight times'])).toEqual(
      detectCapabilities(FLIGHT, ['flight times'])
    );
  });

  it('invents nothing when the prompt describes no capability', () => {
    expect(detectCapabilities('a simple notes app', ['notes'])).toEqual([]);
  });
});

describe('features derived for a real prompt', () => {
  it('leads with what the app is FOR, not with CRUD', () => {
    const titles = buildFeatureSuggestions(['flight times'], false, FLIGHT).map((s) => s.title);
    expect(titles[0]).toMatch(/search/i);
    expect(titles[0]).toMatch(/airline flight/i);
    expect(titles[1]).toMatch(/filter and sort/i);
    // The regression: the first feature used to be "Browse & search FlightTime".
    expect(titles[0]).not.toMatch(/browse & search FlightTime/i);
  });

  it('makes the search and its filters MVP', () => {
    const mvp = buildFeatureSuggestions(['flight times'], false, FLIGHT)
      .filter((s) => s.mvp)
      .map((s) => s.title);
    expect(mvp.some((t) => /search airline flight/i.test(t))).toBe(true);
    expect(mvp.some((t) => /filter and sort/i.test(t))).toBe(true);
  });

  it('still produces a CRUD app when the prompt asks for one', () => {
    const titles = buildFeatureSuggestions(['notes'], false, 'a simple notes app').map(
      (s) => s.title
    );
    expect(titles[0]).toMatch(/browse & search Note/i);
  });

  it('numbers features sequentially regardless of how many capabilities lead', () => {
    const ids = buildFeatureSuggestions(['flight times'], false, FLIGHT).map((s) => s.id);
    expect(ids).toEqual(ids.map((_, i) => `F${i + 1}`));
  });
});

describe('rationales describe the feature they sit under', () => {
  // They used to switch on hard-coded F1..F4, which silently became wrong the
  // moment ids were assigned dynamically: with two capability features leading,
  // "Search airline flight" was captioned "browse and search the list" and
  // every rationale in the wizard was off by two.
  it('never captions a capability feature with an entity CRUD rationale', () => {
    const suggestions = buildFeatureSuggestions(['flight times'], false, FLIGHT);
    const search = suggestions.find((s) => /^Search /.test(s.title));
    const filter = suggestions.find((s) => /^Filter and sort /.test(s.title));
    expect(search?.rationale).toMatch(/your description/i);
    expect(filter?.rationale).toMatch(/your description/i);
    expect(search?.rationale).not.toMatch(/browse and search the list/i);
  });

  it('still explains entity features by their entity', () => {
    const suggestions = buildFeatureSuggestions(['flight times'], false, FLIGHT);
    expect(suggestions.find((s) => /^Browse & search /.test(s.title))?.rationale).toMatch(
      /browse and search the list/i
    );
    expect(suggestions.find((s) => / detail$/.test(s.title))?.rationale).toMatch(
      /open a single record/i
    );
  });

  it('gives every feature a rationale, whatever leads the list', () => {
    for (const prompt of [FLIGHT, 'a simple notes app', 'a shift scheduling app with alerts']) {
      for (const s of buildFeatureSuggestions(['notes', 'tags'], false, prompt)) {
        expect(s.rationale.trim().length, `${s.title} has no rationale`).toBeGreaterThan(8);
      }
    }
  });
});

describe('a calendar is not a booking system', () => {
  // The real prompt that produced the wrong spec. "calendar" was a scheduling
  // keyword, so an Arizona planting calendar came back as "Schedule Item --
  // users assign Item to a time and a person, and the app refuses assignments
  // that conflict", with detectConflict tests attached. Building §11 literally
  // gives an item tracker and the planting calendar never appears.
  const planting = [
    'Show what is plantable in the current half-month window, seed vs transplant marked.',
    'Full year calendar grid: crops down, 24 half-month columns across.',
    'Crop detail: days to harvest, notes, every planting window.',
    'Filter by month and by seed/transplant.',
    'Every planting window cites AZ1005 (Vegetable Planting Calendar for Maricopa County).'
  ].join('\n');

  it('does not read a planting calendar as scheduling', () => {
    const kinds = detectCapabilities(planting, ['Crop', 'PlantingWindow']).map((c) => c.kind);
    expect(kinds).not.toContain('schedule');
  });

  it('detects a reference capability for a planting calendar (A2)', () => {
    const kinds = detectCapabilities(planting, ['Crop', 'PlantingWindow']).map((c) => c.kind);
    expect(kinds).toContain('reference');
  });

  it('still detects scheduling when something is actually assigned', () => {
    // The positive control. A rule that answered "not scheduling" for every
    // input would pass the test above and carry no information.
    for (const prompt of [
      'staff can book an appointment with a stylist',
      'assign shifts to nurses across a weekly roster',
      'check room availability before reserving it'
    ]) {
      expect(detectCapabilities(prompt, ['Booking']).map((c) => c.kind)).toContain('schedule');
    }
  });

  it('lets a genuine search prompt win over reference (search-rank first)', () => {
    const kinds = detectCapabilities(
      'find the lowest cost airline flight with nonstop only',
      ['flight']
    ).map((c) => c.kind);
    expect(kinds[0]).toBe('search-rank');
  });
});

describe('multi-line criteria (A3)', () => {
  it('keeps requirement lines after the first, not only a with|by tail', () => {
    const planting = [
      'Show what is plantable in the current half-month window, seed vs transplant marked.',
      'Full year calendar grid: crops down, 24 half-month columns across.',
      'Crop detail: days to harvest, notes, every planting window.',
      'Filter by month and by seed/transplant.',
      'Every planting window cites AZ1005.'
    ].join('\n');
    const criteria = extractCriteria(planting).join(' | ').toLowerCase();
    expect(criteria).toMatch(/seed|transplant/);
    expect(criteria).toMatch(/harvest|month|az1005|half-month|grid|window/);
  });
});

describe('reference features', () => {
  it('emits grid, filter, and detail with GIVEN/WHEN/THEN acceptance', () => {
    const planting =
      'Show what is plantable in the current half-month window, seed vs transplant marked.\n' +
      'Filter by month and by seed/transplant.\n' +
      'Crop detail: days to harvest.';
    const titles = buildFeatureSuggestions(['Crop'], false, planting).map((s) => s.title);
    expect(titles.some((t) => /grid/i.test(t))).toBe(true);
    expect(titles.some((t) => /^Filter /i.test(t))).toBe(true);
    expect(titles.some((t) => /detail/i.test(t))).toBe(true);
    expect(titles.some((t) => /Schedule /i.test(t))).toBe(false);
  });
});
