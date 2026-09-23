import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { JobStatusPanel } from './JobStatusPanel';

const JOB_ID = '11111111-1111-4111-8111-111111111111';

/**
 * Render the loading panel. Effects do not run, so this is the first paint only.
 *
 * @returns Static HTML.
 */
function renderPanel(): string {
  return renderToStaticMarkup(
    createElement(JobStatusPanel, {
      jobId: JOB_ID,
      onDismiss: () => undefined,
      onStartNew: () => undefined
    })
  );
}

describe('job status panel markup', () => {
  it('shows a short job id, keeps the full id for screen readers, and offers a 44px dismiss', () => {
    const html = renderPanel();
    const copy = en.jobStatus;

    expect(html).toContain(copy.ownerApproval);
    expect(html).toContain(copy.heading);
    expect(html).toContain(`aria-label="${copy.dismiss}"`);
    expect(html).toContain(`aria-label="${copy.copyJobId}"`);
    expect(html).toContain(copy.jobId(JOB_ID));
    expect(html).toContain(copy.jobId('11111111'));
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('Current step:');
    expect(html).not.toContain(copy.startNew);

    const dismissAt = html.indexOf(`aria-label="${copy.dismiss}"`);
    expect(dismissAt).toBeGreaterThan(-1);
    const tagStart = html.lastIndexOf('<button', dismissAt);
    const tagEnd = html.indexOf('>', dismissAt);
    const tag = html.slice(tagStart, tagEnd);
    expect(tag).toContain('min-height:44px');
    expect(tag).toContain('min-width:44px');
  });
});
