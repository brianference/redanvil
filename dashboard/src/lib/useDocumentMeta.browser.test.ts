import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from '../components/shell/constants';
import { mount, type Mounted } from '../test-support/mount';
import { type DocumentMeta, useDocumentMeta } from './useDocumentMeta';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/**
 * Minimal route component: sets the given meta and renders nothing.
 *
 * @returns null.
 */
function MetaProbe(meta: DocumentMeta): null {
  useDocumentMeta(meta);
  return null;
}

/**
 * Content attribute of a head meta tag.
 *
 * @param selector - CSS selector for the tag.
 * @returns Its content, or null when absent.
 */
function metaContent(selector: string): string | null {
  return document.head.querySelector(selector)?.getAttribute('content') ?? null;
}

describe('useDocumentMeta in a real document', () => {
  it('sets title, description, OG tags and a canonical on the dashboard origin', async () => {
    mounted = mount(
      createElement(MetaProbe, {
        title: 'About · RedAnvil Dashboard',
        description: 'What the dashboard shows.',
        path: '/about'
      })
    );

    await expect.poll(() => document.title).toBe('About · RedAnvil Dashboard');
    expect(metaContent('meta[name="description"]')).toBe('What the dashboard shows.');
    expect(metaContent('meta[property="og:title"]')).toBe('About · RedAnvil Dashboard');
    expect(metaContent('meta[property="og:url"]')).toBe(`${DASHBOARD_URL}/about`);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://redanvil-dashboard.pages.dev/about'
    );
  });

  it('replaces the previous route meta instead of adding a second tag', async () => {
    mounted = mount(createElement(MetaProbe, { title: 'One', description: 'first', path: '/' }));
    await expect.poll(() => document.title).toBe('One');
    mounted.unmount();
    mounted = mount(
      createElement(MetaProbe, { title: 'Two', description: 'second', path: 'contact' })
    );

    await expect.poll(() => document.title).toBe('Two');
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(metaContent('meta[name="description"]')).toBe('second');
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${DASHBOARD_URL}/contact`
    );
  });
});
