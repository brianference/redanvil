import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { en } from '../i18n/en';
import type { Run } from '../lib/summary';
import { RunDetailBody } from './RunDetail';

/** Full sample run matching the live feed shape. */
function sampleRun(overrides: Partial<Run> = {}): Run {
  return {
    slug: 'app-builder',
    finalScore: 100,
    threshold: 90,
    passed: true,
    evaluated: 41,
    total: 41,
    rules: [
      { ruleId: 'u-typing-strict', passed: true },
      { ruleId: 'fe-responsive-375', passed: true },
      { ruleId: 'hyg-env-ignored', passed: false }
    ],
    iterations: [
      { index: 1, score: 0, blockers: ['fe-responsive-375'] },
      { index: 2, score: 100, blockers: [] }
    ],
    deployUrl: 'https://redanvil.pages.dev',
    finishedAt: '2026-07-21T16:40:00.000Z',
    ...overrides
  };
}

describe('RunDetailBody', () => {
  it('renders score, coverage, iteration history, and per-rule breakdown', () => {
    const html = renderToStaticMarkup(createElement(RunDetailBody, { run: sampleRun() }));

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
