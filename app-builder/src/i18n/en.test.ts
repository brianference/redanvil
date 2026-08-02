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
  it('exposes typed app shell copy', () => {
    const locale: Locale = en;
    expect(locale.app.name).toBe('RedAnvil');
    expect(locale.app.footerCopyright(2026)).toContain('RedAnvil');
    expect(locale.app.footerCopyright(2026)).toContain('2026');
    expect(locale.app.themeToLight.length).toBeGreaterThan(2);
    expect(locale.app.themeToDark.length).toBeGreaterThan(2);
    expect(locale.app.menuOpen.length).toBeGreaterThan(2);
    expect(locale.app.breadcrumbHome).toBe('Home');
    expect(locale.app.navAbout).toBe('About');
    expect(locale.app.navContact).toBe('Contact');
    expect(locale.app.sidebarLabel.length).toBeGreaterThan(2);
    expect(locale.app.navBuilder).toBe('App Builder');
    expect(locale.app.footerTerms).toBe('Terms');
  });

  it('exposes saved dashboard KPI and card copy', () => {
    expect(en.pages.saved.kpiTotal.length).toBeGreaterThan(2);
    expect(en.pages.saved.kpiSaved.length).toBeGreaterThan(2);
    expect(en.pages.saved.kpiThisWeek.length).toBeGreaterThan(2);
    expect(en.pages.saved.openAction.length).toBeGreaterThan(1);
    expect(en.pages.saved.itemMeta('meal-planner')).toContain('meal-planner');
    expect(en.pages.saved.countMeta(4)).toBe('4 shown');
  });

  it('exposes wizard pillbox and template gallery copy', () => {
    expect(en.wizard.comingUp.length).toBeGreaterThan(2);
    expect(en.wizard.stepTitles).toHaveLength(4);
    expect(en.templates.sectionLabel.length).toBeGreaterThan(2);
    expect(en.templates.sectionCount(5)).toBe('5 templates');
    expect(en.templates.emptyTitle.length).toBeGreaterThan(2);
    expect(en.templates.variantsLabel.length).toBeGreaterThan(2);
    expect(en.wizard.dataStorageLabel.length).toBeGreaterThan(2);
    expect(en.wizard.realtimeLabel.length).toBeGreaterThan(2);
    expect(en.wizard.integrationsLabel.length).toBeGreaterThan(2);
    expect(en.wizard.reviewDataStorage.length).toBeGreaterThan(2);
    expect(en.wizard.reviewRealtime.length).toBeGreaterThan(2);
    expect(en.wizard.reviewIntegrations.length).toBeGreaterThan(2);
  });

  it('exposes real legal/info page content (title, intro, sections)', () => {
    expect(en.pages.home.title.length).toBeGreaterThan(2);
    expect(en.chat.greetingBody.length).toBeGreaterThan(20);
    expect(en.templates.items.length).toBeGreaterThanOrEqual(5);
    for (const item of en.templates.items) {
      expect(item.variants.length).toBeGreaterThanOrEqual(3);
      expect(item.variants.length).toBeLessThanOrEqual(4);
      for (const variant of item.variants) {
        expect(variant.label.length).toBeGreaterThan(2);
        expect(variant.prompt.length).toBeGreaterThan(20);
        expect(variant.appType.length).toBeGreaterThan(2);
      }
    }
    for (const key of ['about', 'contact', 'privacy', 'terms'] as const) {
      const p = en.pages[key];
      expect(p.title.length).toBeGreaterThan(2);
      expect(p.intro.length).toBeGreaterThan(20);
      expect(p.updated.length).toBeGreaterThan(2);
      // R30: real headed sections, not a single stub paragraph.
      expect(p.sections.length).toBeGreaterThanOrEqual(3);
      for (const s of p.sections) {
        expect(s.heading.length).toBeGreaterThan(2);
        expect(s.body.length).toBeGreaterThan(20);
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
    expect(en.wizard.errors.timeout).toBe('Request timed out');
    expect(en.wizard.jobReadyHeading('my-app')).toBe('Job ready: my-app');
  });
});
