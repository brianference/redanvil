/// <reference types="@vitest/browser/matchers" />
/**
 * Browser lane: the build status panel's polling, driven with fetch mocked at
 * the status endpoint and the poll interval under fake timers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { JobStatusPanel } from './JobStatusPanel';
import { en } from '../i18n/en';
import { JOB_STATUS_POLL_INTERVAL_MS, jobStatusUrl } from '../lib/jobStatus';
import { mount, type Mounted } from '../testing/render';

const copy = en.jobStatus;

/** A job id in the shape submit mints. */
const JOB_ID = '11111111-1111-4111-8111-111111111111';

/** Poll budget for the first assertion after a mocked response lands. */
const AFTER_LOAD = { timeout: 5000 };

/** The WCAG 2.5.5 touch target the dismiss control must meet. */
const MIN_TOUCH_PX = 44;

/** The browser's fetch, kept so the runner's own requests are never intercepted. */
const realFetch = window.fetch.bind(window);

/** Public status bodies, as GET /api/jobs/:id/status sends them. */
const BUILDING = {
  id: JOB_ID,
  status: 'building',
  step: 'palette',
  detail: null,
  updatedAt: '2026-09-24T12:00:00.000Z',
  deployUrl: null
};
const DONE = { ...BUILDING, status: 'done', step: null, deployUrl: 'https://recipe-box.pages.dev' };

let mounted: Mounted | null = null;

beforeEach(() => {
  // Only the poll interval is faked; fetch promises and React still run for real.
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/**
 * Answer status polls with `responses` in order; anything else goes to the network.
 *
 * @param responses - One response (or rejection) per poll.
 * @returns The fetch spy.
 */
function mockPolls(...responses: (Response | Error)[]) {
  const queue = [...responses];
  return vi.spyOn(window, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url !== jobStatusUrl(JOB_ID)) return realFetch(input, init);
    const next = queue.shift();
    if (next === undefined) return Promise.reject(new Error('unexpected extra poll'));
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
}

/**
 * Mount the panel for {@link JOB_ID}.
 */
function openPanel(): void {
  mounted = mount(<JobStatusPanel jobId={JOB_ID} onDismiss={() => undefined} onStartNew={() => undefined} />);
}

describe('build status panel (real browser)', () => {
  it('shows the running build with its step, a short id and a full-size dismiss', async () => {
    mockPolls(Response.json(BUILDING));
    openPanel();

    await expect.element(page.getByText(copy.statusPresentation('building').headline), AFTER_LOAD).toBeVisible();
    await expect.element(page.getByRole('progressbar', { name: copy.progressLabel })).toBeVisible();
    await expect.element(page.getByText(copy.jobId('11111111'), { exact: true })).toBeVisible();
    await expect.element(page.getByText(copy.ownerApproval)).toBeVisible();
    expect(page.getByRole('button', { name: copy.startNew }).elements()).toHaveLength(0);

    const dismiss = page.getByRole('button', { name: copy.dismiss }).element().getBoundingClientRect();
    expect(dismiss.width).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    expect(dismiss.height).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
  });

  it('keeps the last status under a warning when a later poll fails', async () => {
    mockPolls(Response.json(BUILDING), Response.json({ error: 'Could not load job status' }, { status: 500 }));
    openPanel();
    await expect.element(page.getByText(copy.statusPresentation('building').headline), AFTER_LOAD).toBeVisible();

    vi.advanceTimersByTime(JOB_STATUS_POLL_INTERVAL_MS);

    await expect
      .element(page.getByRole('alert'), AFTER_LOAD)
      .toHaveTextContent(copy.staleWarning('Could not load job status'));
    await expect.element(page.getByText(copy.statusPresentation('building').headline)).toBeVisible();
  });

  it('shows an error, not an empty panel, when the first poll cannot reach the server', async () => {
    mockPolls(new TypeError('Failed to fetch'));
    openPanel();

    await expect.element(page.getByRole('alert'), AFTER_LOAD).toHaveTextContent(copy.errors.network);
  });

  it('rejects a payload that is not the public status shape', async () => {
    mockPolls(Response.json({ id: 'job-1', status: 'building' }));
    openPanel();

    await expect.element(page.getByRole('alert'), AFTER_LOAD).toHaveTextContent(copy.errors.invalid);
  });

  it('offers the deployed app at a terminal status and stops polling', async () => {
    const fetchSpy = mockPolls(Response.json(DONE));
    openPanel();

    const deploy = page.getByRole('link', { name: copy.openDeploy });
    await expect.element(deploy, AFTER_LOAD).toHaveAttribute('href', DONE.deployUrl);
    await expect.element(page.getByRole('button', { name: copy.startNew })).toBeVisible();

    vi.advanceTimersByTime(JOB_STATUS_POLL_INTERVAL_MS * 2);
    const statusCalls = fetchSpy.mock.calls.filter(([input]) => input === jobStatusUrl(JOB_ID));
    expect(statusCalls).toHaveLength(1);
  });

  it('says so on the button when the clipboard refuses the copy', async () => {
    mockPolls(Response.json(BUILDING));
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    openPanel();

    await userEvent.click(page.getByRole('button', { name: copy.copyJobId }));
    await expect.element(page.getByRole('button', { name: copy.copyFailed })).toBeVisible();
  });
});
