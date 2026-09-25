/// <reference types="@vitest/browser/matchers" />
/**
 * Browser lane: the examples catalog's filter chips and its empty state.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { Examples } from './Examples';
import { ExampleGrid } from '../components/examples/ExampleGrid';
import { en } from '../i18n/en';
import { EXAMPLES } from '../lib/examples';
import { mount, type Mounted } from '../testing/render';

const copy = en.pages.examples;

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/**
 * Slugs of the example cards currently rendered.
 *
 * @returns Rendered card slugs, in order.
 */
function renderedSlugs(): string[] {
  return [...document.querySelectorAll<HTMLElement>('article.ex-card')].map(
    (card) => card.dataset.slug ?? ''
  );
}

describe('examples catalog (real browser)', () => {
  it('shows every example under All, and only a category when its chip is pressed', async () => {
    mounted = mount(<Examples />, { route: '/examples' });
    const filters = page.getByRole('group', { name: copy.filtersLabel });

    await expect.element(filters.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(renderedSlugs()).toEqual(EXAMPLES.map((example) => example.slug));

    const travel = filters.getByRole('button', { name: 'Travel' });
    await userEvent.click(travel);
    await expect.element(travel).toHaveAttribute('aria-pressed', 'true');
    await expect.element(filters.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(renderedSlugs()).toEqual(
      EXAMPLES.filter((example) => example.categories.includes('Travel')).map((example) => example.slug)
    );
    expect(renderedSlugs().length).toBeLessThan(EXAMPLES.length);
  });

  it('says so, instead of rendering an empty grid, when nothing matches', async () => {
    mounted = mount(<ExampleGrid examples={[]} />);
    await expect.element(page.getByRole('status')).toHaveTextContent(copy.filterEmpty);
    expect(renderedSlugs()).toEqual([]);
  });
});
