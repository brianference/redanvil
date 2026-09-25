import { page, userEvent } from '@vitest/browser/context';
import { createElement, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { mount, type Mounted } from '../test-support/mount';
import { RunSearch } from './RunSearch';

/**
 * Browser lane: whether the search field's label is rendered (and so can name
 * it) is a layout question a string renderer cannot answer. A `display:none`
 * label rendered fine as a string and named nothing.
 */

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/** RunSearch with its query held in real state, as Home holds it. */
function ControlledSearch(): JSX.Element {
  const [query, setQuery] = useState('');
  return createElement(RunSearch, { value: query, onChange: setQuery });
}

/** Mount the controlled search into the document. */
function mountSearch(): void {
  mounted = mount(createElement(ControlledSearch));
}

/**
 * The current text of the search input.
 *
 * @param el - Element the locator resolved to.
 * @returns Its value.
 */
function searchValue(el: Element): string {
  if (!(el instanceof HTMLInputElement)) throw new Error('searchbox is not an input');
  return el.value;
}

describe('RunSearch in a real browser', () => {
  it('names the field with a label that is rendered, only off screen', () => {
    // Chromium's own accessibility tree (CDP Accessibility.getFullAXTree) gives
    // the input an empty name when its <label for> is display:none, and the
    // label's text when the label is clipped to 1px. Playwright's getByRole
    // resolves the name either way, so it cannot tell the two apart; these
    // checks can.
    mountSearch();
    const input = mounted?.container.querySelector('input');
    if (input === null || input === undefined) throw new Error('input not rendered');
    const label = input.labels?.[0];
    if (label === undefined) throw new Error('input has no associated label');
    expect(label.textContent).toBe(en.pages.home.searchLabel);
    expect(label.checkVisibility({ visibilityProperty: true })).toBe(true);
    const box = label.getBoundingClientRect();
    expect(box.width).toBeLessThanOrEqual(1);
    expect(box.height).toBeLessThanOrEqual(1);
  });

  it('shows what the visitor types', async () => {
    mountSearch();
    const box = page.getByRole('searchbox', { name: en.pages.home.searchLabel });
    await userEvent.fill(box, 'az');
    await expect.poll(() => searchValue(box.element())).toBe('az');
  });
});
