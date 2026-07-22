import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { en } from '../i18n/en';
import { KpiStrip } from './KpiStrip';

describe('KpiStrip', () => {
  it('renders total, passed, and average score from summary', () => {
    const html = renderToStaticMarkup(
      createElement(KpiStrip, { summary: { total: 3, passed: 2, avgScore: 90 } })
    );
    expect(html).toContain(en.pages.home.summaryLabel);
    expect(html).toContain(en.pages.home.kpiTotal);
    expect(html).toContain(en.pages.home.kpiPassed);
    expect(html).toContain(en.pages.home.kpiAvgScore);
    expect(html).toContain('>3<');
    expect(html).toContain('>2<');
    expect(html).toContain('>90<');
  });

  it('formats non-integer averages to one decimal place', () => {
    const html = renderToStaticMarkup(
      createElement(KpiStrip, { summary: { total: 2, passed: 1, avgScore: 85.5 } })
    );
    expect(html).toContain('85.5');
  });

  it('shows an em dash for average when total is zero', () => {
    const html = renderToStaticMarkup(
      createElement(KpiStrip, { summary: { total: 0, passed: 0, avgScore: 0 } })
    );
    expect(html).toContain('—');
  });
});
