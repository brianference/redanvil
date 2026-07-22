import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ThemeToggle } from '../components/ThemeToggle';
import { en, type Locale } from './en';

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
    expect(locale.app.navGitHub).toBe('GitHub');
  });

  it('exposes page titles used for breadcrumbs', () => {
    expect(en.pages.about.title.length).toBeGreaterThan(2);
    expect(en.pages.contact.title.length).toBeGreaterThan(2);
    expect(en.pages.terms.title.length).toBeGreaterThan(2);
    expect(en.pages.privacy.title.length).toBeGreaterThan(2);
    expect(en.pages.home.title.length).toBeGreaterThan(2);
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
