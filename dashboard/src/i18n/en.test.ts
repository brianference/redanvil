import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ThemeToggle } from '../components/ThemeToggle';
import { en, type Locale } from './en';

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
  sections: readonly { heading: string; body: string }[];
}): string {
  const sectionText = page.sections.map((s) => `${s.heading} ${s.body}`).join(' ');
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
  it('exposes typed app shell copy', () => {
    const locale: Locale = en;
    expect(locale.app.name).toBe('RedAnvil');
    expect(locale.app.primaryNav).toBe('Primary');
    expect(locale.app.footerCopyright).toContain('RedAnvil');
    expect(locale.app.themeToLight).toBe('Switch to light theme');
    expect(locale.app.themeToDark).toBe('Switch to dark theme');
    expect(locale.app.menuOpen.length).toBeGreaterThan(2);
    expect(locale.app.menuClose.length).toBeGreaterThan(2);
    expect(locale.app.breadcrumbHome).toBe('Home');
    expect(locale.app.breadcrumbNav).toBe('Breadcrumb');
    expect(locale.app.navBuilder).toBe('Builder');
    expect(locale.app.navDashboard).toBe('Dashboard');
    expect(locale.app.navRuns).toBe('Runs');
    expect(locale.app.navContact).toBe('Contact');
    expect(locale.app.navGitHub).toBe('GitHub');
  });

  it('exposes page titles used for breadcrumbs', () => {
    expect(en.pages.about.title.length).toBeGreaterThan(2);
    expect(en.pages.contact.title.length).toBeGreaterThan(2);
    expect(en.pages.terms.title.length).toBeGreaterThan(2);
    expect(en.pages.privacy.title.length).toBeGreaterThan(2);
    expect(en.pages.home.title.length).toBeGreaterThan(2);
  });

  it('exposes run list and run detail copy', () => {
    expect(en.runList.coverage).toBe('Coverage');
    expect(en.runList.coverageValue(41, 41)).toBe('41/41 rules');
    expect(en.runList.iterationsValue(2)).toBe('2 iterations');
    expect(en.status.pass).toBe('Pass');
    expect(en.status.fail).toBe('Fail');
    expect(en.pages.home.kpiTotal.length).toBeGreaterThan(2);
    expect(en.pages.home.kpiPassed.length).toBeGreaterThan(2);
    expect(en.pages.home.kpiAvgScore.length).toBeGreaterThan(2);
    expect(en.runDetail.iterationsHeading.length).toBeGreaterThan(2);
    expect(en.runDetail.rulesHeading.length).toBeGreaterThan(2);
    expect(en.runDetail.laneHeading('u')).toContain('u');
  });


  it('gives each content page a non-empty intro and at least one section', () => {
    const contentPages = [en.pages.about, en.pages.contact, en.pages.terms, en.pages.privacy] as const;
    for (const page of contentPages) {
      expect(page.intro.trim().length).toBeGreaterThan(0);
      expect(page.sections.length).toBeGreaterThanOrEqual(1);
      for (const section of page.sections) {
        expect(section.heading.trim().length).toBeGreaterThan(0);
        expect(section.body.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps page copy free of banned writing-guideline words', () => {
    const contentPages = [en.pages.about, en.pages.contact, en.pages.terms, en.pages.privacy] as const;
    for (const page of contentPages) {
      const found = findBannedWords(pageCopyText(page));
      expect(found, `${page.title} has banned words: ${found.join(', ')}`).toEqual([]);
    }
  });
});

describe('Breadcrumbs', () => {
  it('renders Home link and current page label', () => {
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(Breadcrumbs, { current: en.pages.about.title }))
    );
    expect(html).toContain(en.app.breadcrumbHome);
    expect(html).toContain(en.pages.about.title);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain(`aria-label="${en.app.breadcrumbNav}"`);
  });
});

describe('ThemeToggle', () => {
  it('renders a labeled theme control with glyph', () => {
    const html = renderToStaticMarkup(createElement(ThemeToggle));
    expect(html).toContain(en.app.themeToLight);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('☀');
  });
});
