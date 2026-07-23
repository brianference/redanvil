import { describe, it, expect } from 'vitest';
import { en, type Locale } from './en';

describe('en locale bundle', () => {
  it('exposes typed app shell copy', () => {
    const locale: Locale = en;
    expect(locale.app.name).toBe('RedAnvil');
    expect(locale.app.primaryNav).toBe('Primary');
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
    expect(en.wizard.stepTitles).toHaveLength(3);
    expect(en.templates.sectionLabel.length).toBeGreaterThan(2);
    expect(en.templates.sectionCount(5)).toBe('5 templates');
    expect(en.templates.emptyTitle.length).toBeGreaterThan(2);
  });

  it('exposes real legal/info page content (title, intro, sections)', () => {
    expect(en.pages.home.title.length).toBeGreaterThan(2);
    expect(en.chat.greetingBody.length).toBeGreaterThan(20);
    expect(en.templates.items.length).toBeGreaterThanOrEqual(5);
    for (const key of ['about', 'contact', 'privacy', 'terms'] as const) {
      const p = en.pages[key];
      expect(p.title.length).toBeGreaterThan(2);
      expect(p.intro.length).toBeGreaterThan(20);
      expect(p.sections.length).toBeGreaterThan(0);
      for (const s of p.sections) {
        expect(s.heading.length).toBeGreaterThan(2);
        expect(s.body.length).toBeGreaterThan(20);
      }
    }
  });

  it('formats wizard interpolations without any', () => {
    expect(en.wizard.stepOf(2)).toBe('Step 2 of 3');
    expect(en.wizard.promptHint(8)).toContain('8');
    expect(en.wizard.errors.submitFailed(500)).toBe('Submit failed (500)');
    expect(en.wizard.errors.timeout).toBe('Request timed out');
    expect(en.wizard.jobReadyHeading('my-app')).toBe('Job ready: my-app');
  });
});
