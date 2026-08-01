import { describe, it, expect } from 'vitest';
import {
  buildFeatureSuggestions,
  buildFeatures,
  defaultSelectedFeatureIds,
  filterFeaturesBySelection
} from './features';

describe('buildFeatureSuggestions', () => {
  it('reuses buildFeatures ids and titles (no parallel invented list)', () => {
    const entities = ['Reminder', 'Pet'];
    const features = buildFeatures(entities, false);
    const suggestions = buildFeatureSuggestions(entities, false);
    expect(suggestions.map((s) => s.id)).toEqual(features.map((f) => f.id));
    expect(suggestions.map((s) => s.title)).toEqual(features.map((f) => f.name));
    expect(suggestions.every((s) => s.rationale.length > 8)).toBe(true);
  });

  it('defaults selection to MVP ids only', () => {
    const defaults = defaultSelectedFeatureIds(['Trip', 'Driver'], true);
    const suggestions = buildFeatureSuggestions(['Trip', 'Driver'], true);
    expect(defaults.length).toBeGreaterThan(0);
    expect(defaults.every((id) => suggestions.find((s) => s.id === id)?.mvp === true)).toBe(true);
    expect(defaults).not.toContain(
      suggestions.find((s) => s.title.startsWith('Manage Driver'))?.id
    );
  });
});

describe('buildFeatures standard features', () => {
  it('always emits Search and filter + Ask the assistant as MVP', () => {
    const features = buildFeatures(['Crop'], false, 'planting calendar for low desert');
    const search = features.find((f) => f.name.startsWith('Search and filter '));
    const assistant = features.find((f) => f.name.startsWith('Ask the assistant about '));
    expect(search, 'missing Search and filter feature').toBeDefined();
    expect(assistant, 'missing Ask the assistant feature').toBeDefined();
    expect(search!.mvp).toBe(true);
    expect(assistant!.mvp).toBe(true);
    expect(search!.acceptance.some((a) => /GIVEN/.test(a) && /WHEN/.test(a) && /THEN/.test(a))).toBe(
      true
    );
    expect(
      assistant!.acceptance.some((a) => /grounded in app data|app data/i.test(a))
    ).toBe(true);
    expect(
      assistant!.acceptance.some((a) => /error state|502|model call fails/i.test(a))
    ).toBe(true);
    expect(search!.tests.e2e.length).toBeGreaterThan(0);
    expect(assistant!.tests.integration.some((t) => /\/api\/assistant/.test(t))).toBe(true);
  });

  it('emits standard features even when entities are empty', () => {
    const features = buildFeatures([], false, 'a simple utility');
    expect(features.some((f) => f.name.startsWith('Search and filter '))).toBe(true);
    expect(features.some((f) => f.name.startsWith('Ask the assistant about '))).toBe(true);
  });
});

describe('filterFeaturesBySelection', () => {
  it('returns all features when selection is null (legacy)', () => {
    const all = buildFeatures(['Trip'], true);
    expect(filterFeaturesBySelection(all, null)).toEqual(all);
    expect(filterFeaturesBySelection(all, undefined)).toEqual(all);
  });

  it('keeps only selected ids', () => {
    const all = buildFeatures(['Trip', 'Driver'], true);
    const filtered = filterFeaturesBySelection(all, ['F1', 'F4']);
    expect(filtered.map((f) => f.id)).toEqual(['F1', 'F4']);
  });
});
