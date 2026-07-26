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
