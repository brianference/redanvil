import { describe, it, expect } from 'vitest';
import { en, type Locale } from './en';

describe('en locale bundle', () => {
  it('exposes typed app shell copy', () => {
    const locale: Locale = en;
    expect(locale.app.name).toBe('RedAnvil');
    expect(locale.app.primaryNav).toBe('Primary');
    expect(locale.app.footerCopyright).toContain('RedAnvil');
    expect(locale.app.themeToLight.length).toBeGreaterThan(2);
    expect(locale.app.themeToDark.length).toBeGreaterThan(2);
    expect(locale.app.menuOpen.length).toBeGreaterThan(2);
    expect(locale.app.breadcrumbHome).toBe('Home');
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
    expect(en.pages.home.jobReady('my-app', 90)).toBe('Job ready: my-app (threshold 90)');
  });
});
