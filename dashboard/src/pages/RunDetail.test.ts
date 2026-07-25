import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { en } from '../i18n/en';
import { RunDetailBody } from './RunDetail';
import { sampleRun } from '../lib/runFixture';

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
