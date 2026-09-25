import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { en } from '../i18n/en';
import { formatAverage, KpiStrip } from './KpiStrip';

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

  it('shows an average as a whole number, or to one decimal place when it is not one', () => {
    expect(formatAverage({ total: 2, passed: 2, avgScore: 90 })).toBe('90');
    expect(formatAverage({ total: 2, passed: 1, avgScore: 85.5 })).toBe('85.5');
    expect(formatAverage({ total: 3, passed: 1, avgScore: 200 / 3 })).toBe('66.7');
  });

  it('shows a dash, not a zero average, when there are no runs to average', () => {
    // A 0 here would read as "every run scored zero".
    expect(formatAverage({ total: 0, passed: 0, avgScore: 0 })).toBe('—');
    const html = renderToStaticMarkup(
      createElement(KpiStrip, { summary: { total: 0, passed: 0, avgScore: 0 } })
    );
    expect(html).toContain('>—<');
  });
});
