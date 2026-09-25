import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Privacy } from '../pages/Privacy';
import { Terms } from '../pages/Terms';
import { en } from './en';

/** Words banned by the Human Writing Guidelines (case-insensitive whole words). */
const BANNED_WORDS = [
  'delve',
  'pivotal',
  'crucial',
  'leverage',
  'utilize',
  'seamless',
  'robust',
  'transformative',
  'innovative',
  'groundbreaking',
  'cutting-edge',
  'revolutionary',
  'synergy',
  'paradigm',
  'holistic',
  'empower',
  'streamline',
  'ecosystem',
  'best-in-class',
  'world-class',
  'next-generation',
  'game-changer',
  'unlock',
  'unleash',
  'elevate',
  'harness',
  'facilitate',
  'optimize',
  'scalable',
  'mission-critical'
] as const;

/**
 * Flatten a content page's user-facing strings for banned-word scanning.
 */
function pageCopyText(page: {
  title: string;
  intro: string;
  updated?: string;
  sections: readonly { heading: string; body: string; items?: readonly string[] }[];
}): string {
  const sectionText = page.sections
    .map((s) => `${s.heading} ${s.body} ${(s.items ?? []).join(' ')}`)
    .join(' ');
  const updated = page.updated ?? '';
  return `${page.title} ${page.intro} ${updated} ${sectionText}`;
}

/**
 * Return banned words found in text (whole-word, case-insensitive).
 */
function findBannedWords(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_WORDS.filter((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(lower);
  });
}

describe('en locale bundle', () => {
  it('gives every route a distinct, human breadcrumb title', () => {
    const titles = [
      en.pages.about.title,
      en.pages.contact.title,
      en.pages.terms.title,
      en.pages.privacy.title,
      en.pages.home.title,
      en.pages.notFound.title
    ];
    // Two routes sharing a breadcrumb is a real bug: the crumb stops telling
    // you where you are. Presence checks cannot see it.
    expect(new Set(titles).size).toBe(titles.length);
    for (const t of titles) {
      expect(t).not.toMatch(/lorem|todo|tbd|placeholder|untitled/i);
      expect(t.trim()).toBe(t);
    }
  });

  it('formats run counts with the right plural and a lane label per prefix', () => {
    expect(en.runList.coverageValue(41, 43)).toBe('41/43 rules');
    expect(en.runList.iterationsValue(1)).toBe('1 iteration');
    expect(en.runList.iterationsValue(2)).toBe('2 iterations');
    expect(en.runDetail.laneHeading('fe')).toBe('fe lane');
    // Three KPI tiles sit side by side; identical labels would make the strip
    // unreadable.
    expect(
      new Set([en.pages.home.kpiTotal, en.pages.home.kpiPassed, en.pages.home.kpiAvgScore]).size
    ).toBe(3);
  });

  it('keeps page copy free of banned writing-guideline words', () => {
    const contentPages = [
      en.pages.about,
      en.pages.contact,
      en.pages.terms,
      en.pages.privacy
    ] as const;
    for (const page of contentPages) {
      const found = findBannedWords(pageCopyText(page));
      expect(found, `${page.title} has banned words: ${found.join(', ')}`).toEqual([]);
    }
  });
});

describe('Breadcrumbs', () => {
  it('renders Home link and current page label', () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(Breadcrumbs, { current: en.pages.about.title })
      )
    );
    expect(html).toContain(en.app.breadcrumbHome);
    expect(html).toContain(en.pages.about.title);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain(`aria-label="${en.app.breadcrumbNav}"`);
  });
});

/**
 * Render a routed page the way the app does and return its markup.
 *
 * @param page - Page component to render.
 * @returns Static HTML of the whole page, shell included.
 */
function renderPage(page: () => JSX.Element): string {
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(page)));
}

/**
 * Visible text of rendered markup, tags dropped and whitespace collapsed.
 *
 * @param html - Rendered markup.
 * @returns Plain text.
 */
function textOf(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
}

describe('legal pages as rendered', () => {
  it.each([
    ['Terms', Terms, en.pages.terms],
    ['Privacy', Privacy, en.pages.privacy]
  ] as const)('%s shows each section under its own h2 and meets the R30 floor', (_name, page, copy) => {
    const html = renderPage(page);
    const headings = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((match) => match[1]);
    expect(headings).toEqual(copy.sections.map((section) => section.heading));
    expect(headings.length).toBeGreaterThanOrEqual(3);
    const main = textOf(html.split('<main')[1]?.split('</main>')[0] ?? '');
    expect(main.trim().split(' ').length).toBeGreaterThanOrEqual(150);
  });

  it('tells a visitor on the Terms page that a score is not a certification', () => {
    expect(textOf(renderPage(Terms))).toContain(
      'They are not a third-party certification of security, quality, accessibility'
    );
  });

  it('names on the Privacy page the storage key the theme toggle actually writes', () => {
    // ThemeToggle.browser.test asserts the toggle writes localStorage["theme"].
    expect(textOf(renderPage(Privacy))).toContain(
      'localStorage for theme preference under the key theme (values light or dark)'
    );
  });
});
