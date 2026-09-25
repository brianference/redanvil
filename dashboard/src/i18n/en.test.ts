import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ContentSections } from '../components/ContentSections';
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

/** Count whitespace-separated words in legal page copy (R30 floor). */
function pageWordCount(page: {
  title: string;
  intro: string;
  updated?: string;
  sections: readonly { heading: string; body: string; items?: readonly string[] }[];
}): number {
  return pageCopyText(page).trim().split(/\s+/).filter(Boolean).length;
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

  it('meets R30 substance floor on Terms and Privacy (>=150 words, >=3 sections)', () => {
    for (const key of ['terms', 'privacy'] as const) {
      const p = en.pages[key];
      expect(p.sections.length, `${key} section count`).toBeGreaterThanOrEqual(3);
      expect(pageWordCount(p), `${key} word count`).toBeGreaterThanOrEqual(150);
    }
  });

  it('states the dashboard central disclaimer: scores are own gate results, not certification', () => {
    const termsBodies = en.pages.terms.sections.map((s) => s.body).join(' ');
    expect(termsBodies.toLowerCase()).toMatch(/certification|not a certification/);
    expect(termsBodies.toLowerCase()).toMatch(/gate|score/);
    const privacyBodies = en.pages.privacy.sections.map((s) => s.body).join(' ');
    expect(privacyBodies.toLowerCase()).toMatch(/cloudflare/);
    expect(privacyBodies.toLowerCase()).toMatch(/localstorage|theme/);
  });

  it('renders each content page with multiple h2 sections', () => {
    for (const key of ['about', 'contact', 'privacy', 'terms'] as const) {
      const p = en.pages[key];
      const html = renderToStaticMarkup(
        createElement(ContentSections, {
          intro: p.intro,
          updated: p.updated,
          sections: p.sections
        })
      );
      const h2Count = (html.match(/<h2\b/g) ?? []).length;
      expect(h2Count, `${key} h2 count`).toBeGreaterThanOrEqual(3);
      expect(html).toContain(p.updated);
    }
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
