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
