import { describe, it, expect } from 'vitest';
import { en, type Locale } from './en';

describe('en locale bundle', () => {
  it('exposes typed app shell copy', () => {
    const locale: Locale = en;
    expect(locale.app.name).toBe('app-builder');
    expect(locale.app.primaryNav).toBe('Primary');
    expect(locale.app.footerCopyright).toContain('app-builder');
  });

  it('exposes page titles and bodies', () => {
    expect(en.pages.home.title).toBe('Build an app');
    expect(en.pages.about.title).toBe('About');
    expect(en.pages.contact.body).toBe('Contact content.');
    expect(en.pages.privacy.title).toBe('Privacy');
    expect(en.pages.terms.body).toBe('Terms content.');
  });

  it('formats wizard interpolations without any', () => {
    expect(en.wizard.stepOf(2)).toBe('Step 2 of 3');
    expect(en.wizard.promptHint(8)).toContain('8');
    expect(en.wizard.errors.submitFailed(500)).toBe('Submit failed (500)');
    expect(en.wizard.errors.timeout).toBe('Request timed out');
    expect(en.pages.home.jobReady('my-app', 90)).toBe('Job ready: my-app (threshold 90)');
  });
});
