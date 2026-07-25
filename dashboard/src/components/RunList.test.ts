import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { en } from '../i18n/en';
import type { Run } from '../lib/summary';
import { RunList } from './RunList';
import { sampleRun } from '../lib/runFixture';

/**
 * Render RunList inside a MemoryRouter (required for Link / useNavigate).
 */
function renderList(runs: readonly Run[]): string {
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(RunList, { runs })));
}

describe('RunList', () => {
  it('shows empty state when there are no runs', () => {
    const html = renderList([]);
    expect(html).toContain(en.runList.empty);
  });

  it('renders card rows with coverage, iterations, detail link, and deploy link', () => {
    const html = renderList([sampleRun()]);
    // Cards, not a table
    expect(html).not.toContain('<table');
    expect(html).toContain('<article');
    expect(html).toContain(en.pages.home.recentHeading);
    expect(html).toContain(en.runList.coverageValue(41, 41));
    expect(html).toContain(en.runList.iterationsValue(2));
    expect(html).toContain('100');
    expect(html).toContain('href="/run/app-builder"');
    expect(html).toContain(en.runList.openDeploy);
    expect(html).toContain('href="https://redanvil.pages.dev"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain(en.status.pass);
    expect(html).toContain('✓');
  });

  it('shows fail badge with ! and none when deploy is missing', () => {
    const html = renderList([
      sampleRun({ passed: false, finalScore: 70, deployUrl: null, evaluated: 10, total: 41 })
    ]);
    expect(html).toContain(en.status.fail);
    expect(html).toContain('!');
    expect(html).toContain(en.runList.none);
    expect(html).toContain(en.runList.coverageValue(10, 41));
  });
});
