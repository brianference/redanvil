/// <reference types="@vitest/browser/matchers" />
/**
 * Browser lane: the job status panel driven against a stubbed status API.
 *
 * Every branch a visitor can reach is exercised through what is painted:
 * polling until a terminal status, the deploy link, each failure message,
 * recovery on the next poll, dismiss and start-new. Timers are faked with
 * `shouldAdvanceTime`, so the 15 s poll and 10 s timeout can be jumped while
 * expect.element still polls in real time.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { JobStatusPanel } from './JobStatusPanel';
import { en } from '../i18n/en';
import { FETCH_TIMEOUT_MS } from '../lib/abortableEffect';
import {
  JOB_STATUS_POLL_INTERVAL_MS,
  LAST_JOB_ID_STORAGE_KEY,
  jobStatusUrl,
  writeLastJobId
} from '../lib/jobStatus';
import { mount, type Mounted } from '../testing/render';

const JOB_ID = '5b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d';
/** A live app from the examples catalog, used as the finished build's URL. */
const DEPLOY_URL = 'https://sushi-finder.pages.dev';
/** WCAG 2.5.5 target size the dismiss control must meet. */
const MIN_TOUCH_PX = 44;
const copy = en.jobStatus;

let mounted: Mounted | null = null;

/**
 * A JSON response like the status route sends.
 *
 * @param body - Response body.
 * @param status - HTTP status.
 * @returns The response.
 */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

/**
 * The public status body for this job.
 *
 * @param status - Job status.
 * @param extra - Fields to override.
 * @returns Status body.
 */
function jobBody(status: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: JOB_ID,
    status,
    step: null,
    detail: null,
    updatedAt: '2026-09-24T12:00:00.000Z',
    deployUrl: null,
    ...extra
  };
}

/**
 * Mount the panel with spy callbacks.
 *
 * @returns The dismiss and start-new spies.
 */
function renderPanel(): { onDismiss: () => void; onStartNew: () => void } {
  const onDismiss = vi.fn();
  const onStartNew = vi.fn();
  mounted = mount(<JobStatusPanel jobId={JOB_ID} onDismiss={onDismiss} onStartNew={onStartNew} />);
  return { onDismiss, onStartNew };
}

/**
 * Stub fetch with a sequence of answers, repeating the last one.
 *
 * @param answers - Responses or errors in call order.
 * @returns The fetch spy.
 */
function stubFetch(...answers: Array<Response | Error>): ReturnType<typeof vi.fn> {
  let call = 0;
  const spy = vi.fn(() => {
    const answer = answers[Math.min(call, answers.length - 1)];
    call += 1;
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer?.clone());
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('job status panel (real browser)', () => {
  it('polls the public route until the job is done, then offers the deploy and stops', async () => {
    const fetchSpy = stubFetch(
      json(jobBody('building', { step: 'build' })),
      json(jobBody('done', { deployUrl: DEPLOY_URL }))
    );
    renderPanel();

    await expect
      .element(page.getByText(copy.statusPresentation('building').headline))
      .toBeVisible();
    await expect.element(page.getByRole('progressbar', { name: copy.progressLabel })).toBeVisible();
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(jobStatusUrl(JOB_ID));
    expect(page.getByRole('button', { name: copy.startNew }).elements()).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(JOB_STATUS_POLL_INTERVAL_MS);
    await expect.element(page.getByText(copy.statusPresentation('done').headline)).toBeVisible();
    await expect
      .element(page.getByRole('link', { name: copy.openDeploy }))
      .toHaveAttribute('href', DEPLOY_URL);
    await expect.element(page.getByRole('button', { name: copy.startNew })).toBeVisible();

    await vi.advanceTimersByTimeAsync(JOB_STATUS_POLL_INTERVAL_MS * 3);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('shows the server message on a failed read, and recovers on the next poll', async () => {
    stubFetch(json({ error: 'Could not load job status' }, 500), json(jobBody('queued')));
    renderPanel();

    await expect.element(page.getByRole('alert')).toHaveTextContent('Could not load job status');
    await vi.advanceTimersByTimeAsync(JOB_STATUS_POLL_INTERVAL_MS);
    await expect.element(page.getByText(copy.statusPresentation('queued').headline)).toBeVisible();
    expect(page.getByRole('alert').elements()).toHaveLength(0);
  });

  it('says the network failed when the request never reaches the server', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    renderPanel();
    await expect.element(page.getByRole('alert')).toHaveTextContent(copy.errors.network);
  });

  it('refuses a body that is not the public status shape instead of rendering it', async () => {
    stubFetch(json({ id: 'not-a-job-id', status: 'done', prompt: 'leaked' }));
    renderPanel();
    await expect.element(page.getByRole('alert')).toHaveTextContent(copy.errors.invalid);
    expect(page.getByText('leaked').elements()).toHaveLength(0);
  });

  it('times out a request that never answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          })
      )
    );
    renderPanel();
    await expect.element(page.getByText(copy.loading)).toBeVisible();
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);
    await expect.element(page.getByRole('alert')).toHaveTextContent(copy.errors.timeout);
  });

  it('dismiss forgets the stored job, hides the panel and stops polling', async () => {
    writeLastJobId(JOB_ID);
    const fetchSpy = stubFetch(json(jobBody('awaiting_owner')));
    const { onDismiss } = renderPanel();

    const dismiss = page.getByRole('button', { name: copy.dismiss });
    await expect.element(dismiss).toBeVisible();
    const box = (dismiss.element() as HTMLElement).getBoundingClientRect();
    expect(box.width).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    expect(box.height).toBeGreaterThanOrEqual(MIN_TOUCH_PX);

    await userEvent.click(dismiss);
    await expect
      .element(page.getByRole('region', { name: copy.regionLabel }))
      .not.toBeInTheDocument();
    expect(localStorage.getItem(LAST_JOB_ID_STORAGE_KEY)).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);

    const callsAtDismiss = fetchSpy.mock.calls.length;
    await vi.advanceTimersByTimeAsync(JOB_STATUS_POLL_INTERVAL_MS * 2);
    expect(fetchSpy).toHaveBeenCalledTimes(callsAtDismiss);
  });

  it('start a new app, offered once the job is terminal, hands control back to the builder', async () => {
    writeLastJobId(JOB_ID);
    stubFetch(json(jobBody('rejected', { detail: 'Out of scope for the queue' })));
    const { onStartNew } = renderPanel();

    await expect.element(page.getByText('Out of scope for the queue')).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: copy.startNew }));
    expect(onStartNew).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(LAST_JOB_ID_STORAGE_KEY)).toBeNull();
  });

  it('shows the short id, keeps the full id for screen readers, and copies it', async () => {
    stubFetch(json(jobBody('queued')));
    renderPanel();
    await expect.element(page.getByText(copy.jobId(JOB_ID))).toBeInTheDocument();
    await expect.element(page.getByText(copy.jobId('5b1c2d3e'), { exact: true })).toBeVisible();
    await expect.element(page.getByRole('button', { name: copy.copyJobId })).toBeVisible();
  });
});
