import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { ContentSections } from './ContentSections';

/**
 * Render a content page body exactly as the About page does.
 *
 * @returns Static HTML of the About sections.
 */
function renderAbout(): string {
  const page = en.pages.about;
  return renderToStaticMarkup(
    createElement(ContentSections, {
      intro: page.intro,
      updated: page.updated,
      sections: page.sections
    })
  );
}

describe('ContentSections', () => {
  it('turns a bare URL in section copy into a new-tab anchor, leaving the full stop outside', () => {
    const html = renderAbout();
    expect(html).toMatch(
      /<a href="https:\/\/redanvil\.pages\.dev" target="_blank" rel="noreferrer"[^>]*>https:\/\/redanvil\.pages\.dev<\/a>\./
    );
    expect(html).toMatch(/<a href="https:\/\/github\.com\/brianference\/redanvil"[^>]*>/);
  });

  it('renders each section heading as an h2 and leaves URL-free copy as plain text', () => {
    const html = renderAbout();
    const headings = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((match) => match[1]);
    expect(headings).toEqual(en.pages.about.sections.map((section) => section.heading));
    const gateSection = html.split('How the gate actually works')[1]?.split('</section>')[0] ?? '';
    expect(gateSection).toContain('Unknown means fail');
    expect(gateSection).not.toContain('<a ');
  });

  it('linkifies URLs inside bullet items', () => {
    const html = renderToStaticMarkup(
      createElement(ContentSections, {
        intro: en.pages.contact.intro,
        sections: [{ heading: 'Where', body: '', items: [en.pages.contact.sections[0]?.body ?? ''] }]
      })
    );
    expect(html).toMatch(
      /<li[^>]*>[^<]*<span><a href="https:\/\/github\.com\/brianference\/redanvil\/issues" target="_blank" rel="noreferrer"/
    );
  });
});
