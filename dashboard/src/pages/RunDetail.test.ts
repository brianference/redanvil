import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { sampleRun } from '../lib/runFixture';
import type { RunsState } from '../lib/useRuns';
import { RunDetailBody, RunDetailView } from './RunDetail';

describe('RunDetailBody', () => {
  it('renders score, coverage, iteration history, and per-rule breakdown', () => {
    // The lane assertions below need one rule per lane, so the rules are stated
    // here rather than taken from the shared fixture: this test is specifically
    // about the per-lane grouping, and a lane heading only renders when a rule
    // in that lane exists. Dropping to the fixture's two rules made the `hyg`
    // assertion fail, which is the test doing its job.
    const run = sampleRun({
      rules: [
        { ruleId: 'u-typing-strict', passed: true },
        { ruleId: 'fe-responsive-375', passed: true },
        { ruleId: 'hyg-env-ignored', passed: false }
      ]
    });
    const html = renderToStaticMarkup(createElement(RunDetailBody, { run }));

    expect(html).toContain(en.runDetail.scoreValue(100, 90));
    expect(html).toContain(en.runDetail.coverageValue(41, 41));
    expect(html).toContain(en.runDetail.iterationsHeading);
    expect(html).toContain(en.runDetail.iterationsSummary(2));
    expect(html).toContain(en.runDetail.iterationIndex(1));
    expect(html).toContain('fe-responsive-375');
    expect(html).toContain(en.runDetail.noBlockers);
    expect(html).toContain(en.runDetail.rulesHeading);
    expect(html).toContain(en.runDetail.laneHeading('fe'));
    expect(html).toContain(en.runDetail.laneHeading('u'));
    expect(html).toContain(en.runDetail.laneHeading('hyg'));
    expect(html).toContain('u-typing-strict');
    expect(html).toContain(en.status.pass);
    expect(html).toContain(en.status.fail);
    expect(html).toContain('href="https://redanvil.pages.dev"');
    expect(html).toContain('target="_blank"');
  });

  it('shows empty states when iterations and rules are empty', () => {
    const html = renderToStaticMarkup(
      createElement(RunDetailBody, {
        run: sampleRun({ iterations: [], rules: [], evaluated: 0, total: 0 })
      })
    );
    expect(html).toContain(en.runDetail.iterationsEmpty);
    expect(html).toContain(en.runDetail.rulesEmpty);
  });
});

/**
 * Render RunDetailView inside a MemoryRouter (Page + BackToRuns Link).
 *
 * @param slug - Route slug (empty string → missing-slug branch).
 * @param state - Injected runs feed state.
 * @returns Static HTML string.
 */
function renderDetail(slug: string, state: RunsState): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(RunDetailView, { slug, state })
    )
  );
}

/**
 * RunDetailView composing states (loading / error / missing-slug / not-found).
 *
 * RunDetail() fetches on mount via useRuns, so these branches are unreachable
 * from a unit test without a network mock. RunDetailView is the pure view:
 * inject each branch and assert the user-visible i18n copy.
 */
describe('RunDetailView', () => {
  it('shows loading copy while the feed is in flight', () => {
    const html = renderDetail('app-builder', { status: 'loading' });
    expect(html).toContain(en.runDetail.loading);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain(en.runDetail.notFound);
  });

  it('shows the error message from the feed with a recovery link', () => {
    const message = 'HTTP 503';
    const html = renderDetail('app-builder', { status: 'error', message });
    expect(html).toContain(en.runDetail.error(message));
    expect(html).toContain('role="alert"');
    expect(html).toContain(en.runDetail.backToRuns);
    expect(html).toContain('href="/"');
    expect(html).not.toContain(en.runDetail.notFound);
  });

  it('shows not-found when the slug param is missing', () => {
    const html = renderDetail('', { status: 'ready', runs: [sampleRun()] });
    expect(html).toContain(en.runDetail.notFound);
    expect(html).toContain(en.runDetail.missingSlug);
    expect(html).toContain(en.runDetail.backToRuns);
    expect(html).not.toContain(en.runDetail.loading);
  });

  it('shows not-found when no run matches the slug', () => {
    const html = renderDetail('does-not-exist', {
      status: 'ready',
      runs: [sampleRun()]
    });
    expect(html).toContain(en.runDetail.notFound);
    expect(html).toContain('does-not-exist');
    expect(html).toContain(en.runDetail.backToRuns);
    expect(html).not.toContain(en.runDetail.scoreValue(100, 90));
  });
});
