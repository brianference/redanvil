import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { LegalPage } from '../components/LegalPage';
import { en, type Locale } from './en';

/** Count whitespace-separated words in legal page copy (R30 floor). */
function pageWordCount(page: {
  title: string;
  intro: string;
  updated: string;
  sections: readonly { heading: string; body: string; items?: readonly string[] }[];
}): number {
  const parts = [
    page.title,
    page.updated,
    page.intro,
    ...page.sections.flatMap((s) => [s.heading, s.body, ...(s.items ?? [])])
  ];
  return parts.join(' ').trim().split(/\s+/).filter(Boolean).length;
}

describe('en locale bundle', () => {
  it('names the shell links and formats the footer year', () => {
    const locale: Locale = en;
    expect(locale.app.name).toBe('RedAnvil');
    expect(locale.app.footerCopyright(2026)).toContain('RedAnvil');
    expect(locale.app.footerCopyright(2026)).toContain('2026');
    expect(locale.app.breadcrumbHome).toBe('Home');
    expect(locale.app.navAbout).toBe('About');
    expect(locale.app.navContact).toBe('Contact');
    expect(locale.app.navBuilder).toBe('App Builder');
    expect(locale.app.footerTerms).toBe('Terms');
  });

  it('formats saved dashboard and template gallery interpolations', () => {
    expect(en.pages.saved.itemMeta('meal-planner')).toContain('meal-planner');
    expect(en.pages.saved.countMeta(4)).toBe('4 shown');
    expect(en.templates.sectionCount(5)).toBe('5 templates');
    expect(en.wizard.stepTitles).toHaveLength(4);
  });

  it('gives every legal/info page real headed sections, not a stub paragraph', () => {
    for (const key of ['about', 'contact', 'privacy', 'terms'] as const) {
      const p = en.pages[key];
      // R30: several headed sections, each with a body longer than a stub line.
      expect(p.sections.length, `${key} sections`).toBeGreaterThanOrEqual(3);
      for (const s of p.sections) {
        expect(s.body.split(/\s+/).length, `${key}: ${s.heading}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('meets fe-legal-substance floor on Terms and Privacy (>=1400 words, >=14 sections)', () => {
    for (const key of ['terms', 'privacy'] as const) {
      const p = en.pages[key];
      expect(p.sections.length, `${key} section count`).toBeGreaterThanOrEqual(14);
      expect(pageWordCount(p), `${key} word count`).toBeGreaterThanOrEqual(1400);
    }
  });

  it('states the app-builder central disclaimer: PRD is a start, saves are public', () => {
    const termsBodies = en.pages.terms.sections.map((s) => s.body).join(' ');
    expect(termsBodies.toLowerCase()).toMatch(/public/);
    expect(termsBodies.toLowerCase()).toMatch(/starting specification|not verified/);
    const privacyBodies = en.pages.privacy.sections.map((s) => s.body).join(' ');
    expect(privacyBodies.toLowerCase()).toMatch(/d1|cloudflare/);
    expect(privacyBodies.toLowerCase()).toMatch(/public/);
  });

  it('renders each legal page with multiple h2 sections', () => {
    for (const key of ['about', 'contact', 'privacy', 'terms'] as const) {
      const p = en.pages[key];
      const html = renderToStaticMarkup(
        createElement(
          MemoryRouter,
          null,
          createElement(LegalPage, {
            title: p.title,
            updated: p.updated,
            intro: p.intro,
            sections: p.sections
          })
        )
      );
      const h2Count = (html.match(/<h2\b/g) ?? []).length;
      expect(h2Count, `${key} h2 count`).toBeGreaterThanOrEqual(3);
      expect(html).toContain(p.updated);
    }
  });

  it('formats wizard interpolations without any', () => {
    expect(en.wizard.stepOf(2)).toBe('Step 2 of 4');
    expect(en.wizard.promptHint(8)).toContain('8');
    expect(en.wizard.errors.submitFailed(500)).toBe('Submit failed (500)');
    expect(en.wizard.jobReadyHeading('my-app')).toBe('Job ready: my-app');
  });
});
