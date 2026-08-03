import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { en } from '../i18n/en';
import { matchesRunQuery, RunSearch } from './RunSearch';

describe('matchesRunQuery', () => {
  it('matches a case-insensitive substring of the slug', () => {
    expect(matchesRunQuery('az-planting-calendar', 'AZ')).toBe(true);
    expect(matchesRunQuery('az-planting-calendar', 'planting')).toBe(true);
  });

  it('rejects a slug that does not contain the query', () => {
    expect(matchesRunQuery('app-builder', 'az')).toBe(false);
  });

  it('an empty or whitespace-only query matches everything', () => {
    expect(matchesRunQuery('dashboard', '')).toBe(true);
    expect(matchesRunQuery('dashboard', '   ')).toBe(true);
  });

  it('narrows a known three-slug set to the matching subset, not all or none', () => {
    const slugs = ['app-builder', 'az-planting-calendar', 'dashboard'];
    const before = slugs.filter((s) => matchesRunQuery(s, ''));
    const after = slugs.filter((s) => matchesRunQuery(s, 'az'));
    expect(before.length).toBe(3);
    expect(after).toEqual(['az-planting-calendar']);
    expect(after.length).toBeLessThan(before.length);
  });
});

describe('RunSearch', () => {
  it('renders an accessible text search input, not a bare select', () => {
    const html = renderToStaticMarkup(
      createElement(RunSearch, { value: '', onChange: () => undefined })
    );
    expect(html).toContain('type="search"');
    expect(html).toContain(`aria-label="${en.pages.home.searchLabel}"`);
    expect(html).not.toContain('<select');
  });

  it('reflects the controlled value', () => {
    const html = renderToStaticMarkup(
      createElement(RunSearch, { value: 'az', onChange: () => undefined })
    );
    expect(html).toContain('value="az"');
  });
});
