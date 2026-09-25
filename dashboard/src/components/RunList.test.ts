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

/**
 * The one-line summary a card shows for a run, built from the same locale
 * functions a reader sees: score, coverage and iteration count, in order.
 *
 * @param run - Run on the card.
 * @returns The summary text.
 */
function metaLine(run: Run): string {
  return [
    en.runList.scoreValue(run.finalScore),
    en.runList.coverageValue(run.evaluated, run.total),
    en.runList.iterationsValue(run.iterations.length)
  ].join(en.runList.metaSep);
}

describe('RunList', () => {
  it('shows a passing run with its full summary, detail link and deploy link', () => {
    const run = sampleRun();
    const html = renderList([run]);
    expect(html).toContain(en.pages.home.recentHeading);
    expect(html).toContain(en.pages.home.recentMeta(1));
    // The whole summary line, in order: "100 · 41/41 rules · 2 iterations".
    expect(html).toContain(`>${metaLine(run)}<`);
    expect(html).toContain(`aria-label="${en.status.badgeAria(en.status.pass, 100, 90)}"`);
    expect(html).toContain('href="/run/app-builder"');
    expect(html).toContain('href="https://redanvil.pages.dev"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain(en.runList.openDeploy);
  });

  it('shows a failing run as FAIL against its threshold, and None when it has no deploy', () => {
    const run = sampleRun({
      passed: false,
      finalScore: 70,
      deployUrl: null,
      evaluated: 10,
      total: 41
    });
    const html = renderList([run]);
    expect(html).toContain(`aria-label="${en.status.badgeAria(en.status.fail, 70, 90)}"`);
    expect(html).toContain(`>${metaLine(run)}<`);
    expect(html).toContain(`>${en.runList.none}<`);
    expect(html).not.toContain(en.runList.openDeploy);
    expect(html).not.toContain(en.status.pass);
  });

  it('counts the runs it shows in the list header', () => {
    const html = renderList([sampleRun(), sampleRun({ slug: 'dashboard' })]);
    expect(html).toContain(en.pages.home.recentMeta(2));
    expect(html).toContain('href="/run/app-builder"');
    expect(html).toContain('href="/run/dashboard"');
  });
});
