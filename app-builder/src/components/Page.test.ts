import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { Page } from './Page';

/**
 * Render Page inside a MemoryRouter (required for Link / useLocation).
 *
 * @param path - Initial route path.
 * @param props - Optional Page props overrides.
 * @returns Static HTML string.
 */
function renderPage(
  path: string,
  props: { title?: string; breadcrumb?: string; children?: ReactNode } = {}
): string {
  const { title = 'Test page', breadcrumb, children = createElement('span', null, 'body') } = props;
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(Page, { title, breadcrumb, children })
    )
  );
}

/**
 * Extract the first header landmark (role=banner via &lt;header&gt;).
 *
 * @param html - Full page markup.
 * @returns Header HTML fragment.
 */
function getHeaderByRole(html: string): string {
  const match = html.match(/<header\b[\s\S]*?<\/header>/i);
  if (match === null) {
    throw new Error('No header landmark found');
  }
  return match[0];
}

/**
 * Find a navigation landmark by accessible name (getByRole('navigation', { name })).
 *
 * @param containerHtml - Markup to search (e.g. header).
 * @param name - aria-label / accessible name.
 * @returns Matching nav HTML fragment.
 */
function getNavigationByName(containerHtml: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<nav\\b[^>]*aria-label="${escaped}"[^>]*>[\\s\\S]*?<\\/nav>`, 'i');
  const match = containerHtml.match(re);
  if (match === null) {
    throw new Error(`No navigation with accessible name "${name}"`);
  }
  return match[0];
}

/**
 * Collect link accessible names from markup (getByRole('link') text content).
 *
 * @param html - Markup containing anchors.
 * @returns Ordered list of link text (trimmed).
 */
function getLinkNames(html: string): string[] {
  const names: string[] = [];
  const re = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1] ?? '';
    const text = raw.replace(/<[^>]+>/g, '').trim();
    if (text.length > 0) {
      names.push(text);
    }
  }
  return names;
}

describe('Page shell — primary header navigation', () => {
  const primaryLabels = [
    en.app.navBuilder,
    en.app.navDashboard,
    en.app.navSaved,
    en.app.navAbout,
    en.app.navContact
  ] as const;

  it('exposes primary links inside the header navigation landmark (by role/name)', () => {
    const html = renderPage('/');
    const header = getHeaderByRole(html);
    const nav = getNavigationByName(header, en.app.primaryNav);
    const linkNames = getLinkNames(nav);

    for (const label of primaryLabels) {
      expect(linkNames, `missing header link: ${label}`).toContain(label);
    }
  });

  it('marks the current route with aria-current="page" on the matching primary link', () => {
    const html = renderPage('/about');
    const header = getHeaderByRole(html);
    const nav = getNavigationByName(header, en.app.primaryNav);

    const aboutLink = nav.match(new RegExp(`<a\\b[^>]*>\\s*${en.app.navAbout}\\s*<\\/a>`, 'i'));
    expect(aboutLink).not.toBeNull();
    expect(aboutLink?.[0]).toMatch(/aria-current="page"/i);

    const builderLink = nav.match(new RegExp(`<a\\b[^>]*>\\s*${en.app.navBuilder}\\s*<\\/a>`, 'i'));
    expect(builderLink?.[0] ?? '').not.toMatch(/aria-current="page"/i);
  });

  it('renders breadcrumbs on inner pages when breadcrumb prop is set', () => {
    const html = renderPage('/saved', {
      title: en.pages.saved.title,
      breadcrumb: en.pages.saved.title
    });
    expect(html).toContain(`aria-label="${en.app.breadcrumbNav}"`);
    expect(html).toContain(en.app.breadcrumbHome);
    expect(html).toContain(en.pages.saved.title);
  });
});
