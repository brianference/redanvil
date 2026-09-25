/// <reference types="@vitest/browser/matchers" />
/**
 * Browser lane: the shared GET hook's state, driven through a probe component
 * with fetch mocked per URL.
 */
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { useAbortableJsonGet } from './useAbortableJsonGet';
import { mount, type Mounted } from '../testing/render';

/** Poll budget for the first assertion after a mocked response lands. */
const AFTER_LOAD = { timeout: 5000 };

/** The browser's fetch, kept so the runner's own requests are never intercepted. */
const realFetch = window.fetch.bind(window);

const FIRST_URL = '/api/probe/first';
const SECOND_URL = '/api/probe/second';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

/**
 * Accept only `{ name: string }`.
 *
 * @param payload - Parsed JSON.
 * @returns The name, or null.
 */
function parseName(payload: unknown): string | null {
  return typeof payload === 'object' && payload !== null && typeof (payload as { name?: unknown }).name === 'string'
    ? (payload as { name: string }).name
    : null;
}

/**
 * Renders the hook's state as text, with a button that switches to the second URL.
 */
function Probe(): JSX.Element {
  const [url, setUrl] = useState(FIRST_URL);
  const { state } = useAbortableJsonGet({ url, parse: parseName, errorMessage: 'Could not load' });
  const text =
    state.status === 'success'
      ? `success ${state.data}`
      : state.status === 'error'
        ? `error ${state.message} ${state.httpStatus ?? 'none'}`
        : 'loading';
  return (
    <>
      <output aria-label="probe state">{text}</output>
      <button type="button" onClick={() => setUrl(SECOND_URL)}>
        Switch
      </button>
    </>
  );
}

describe('useAbortableJsonGet (real browser)', () => {
  it('ignores a superseded response that lands after the newer one', async () => {
    let answerFirst: (response: Response) => void = () => undefined;
    vi.spyOn(window, 'fetch').mockImplementation((input, init) => {
      if (input === FIRST_URL) {
        return new Promise<Response>((resolve) => {
          answerFirst = resolve;
        });
      }
      if (input === SECOND_URL) return Promise.resolve(Response.json({ name: 'second' }));
      return realFetch(input, init);
    });
    mounted = mount(<Probe />);
    const state = page.getByRole('status', { name: 'probe state' });
    await expect.element(state).toHaveTextContent('loading');

    await userEvent.click(page.getByRole('button', { name: 'Switch' }));
    await expect.element(state, AFTER_LOAD).toHaveTextContent('success second');

    const late = Response.json({ name: 'first' });
    answerFirst(late);
    // The hook has read the late body once it is used; only then is "it did
    // not overwrite the newer state" a claim about the hook, not about timing.
    await expect.poll(() => late.bodyUsed, AFTER_LOAD).toBe(true);
    await expect.element(state).toHaveTextContent('success second');
  });

  it('keeps the status of a non-JSON error, so a plain-text 404 can read as not found', async () => {
    vi.spyOn(window, 'fetch').mockImplementation((input, init) =>
      input === FIRST_URL ? Promise.resolve(new Response('Not Found', { status: 404 })) : realFetch(input, init)
    );
    mounted = mount(<Probe />);
    await expect
      .element(page.getByRole('status', { name: 'probe state' }), AFTER_LOAD)
      .toHaveTextContent('error Could not load 404');
  });

  it("uses the server's error text for a JSON non-2xx", async () => {
    vi.spyOn(window, 'fetch').mockImplementation((input, init) =>
      input === FIRST_URL
        ? Promise.resolve(Response.json({ error: 'Too many requests' }, { status: 429 }))
        : realFetch(input, init)
    );
    mounted = mount(<Probe />);
    await expect
      .element(page.getByRole('status', { name: 'probe state' }), AFTER_LOAD)
      .toHaveTextContent('error Too many requests 429');
  });
});
