/// <reference types="@vitest/browser/matchers" />
/**
 * Browser lane: the generated PRD's save and copy actions, with fetch mocked
 * at POST /api/prds and the clipboard stubbed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { PrdResult } from './PrdResult';
import { en } from '../i18n/en';
import type { Prd } from '../lib/prd';
import { mount, type Mounted } from '../testing/render';

const copy = en.prdResult;

/** Poll budget for the first assertion after a mocked response lands. */
const AFTER_LOAD = { timeout: 5000 };

/** The browser's fetch, kept so the runner's own requests are never intercepted. */
const realFetch = window.fetch.bind(window);

/** Fields of the PRD seeded by migrations/0002_seed_prd.sql, body trimmed. */
const PRD: Prd = {
  slug: 'tesla-driving-stats',
  title: 'Tesla Driving Stats',
  prompt: 'Track my Tesla drives',
  markdown: '# Product Requirements Document — Tesla Driving Stats'
};

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

/**
 * Answer POST /api/prds with `body`; anything else goes to the network.
 *
 * @param body - Save response body.
 */
function mockSave(body: unknown): void {
  vi.spyOn(window, 'fetch').mockImplementation((input, init) =>
    input === '/api/prds' ? Promise.resolve(Response.json(body)) : realFetch(input, init)
  );
}

describe('PRD result actions (real browser)', () => {
  it('links to the saved PRD after a save', async () => {
    mockSave({ id: 'abc-123', url: '/prd/abc-123' });
    mounted = mount(<PrdResult prd={PRD} onReset={() => undefined} />);

    await userEvent.click(page.getByRole('button', { name: copy.saveToSite }));
    const link = page.getByRole('link', { name: copy.savedViewAt('/prd/abc-123') });
    await expect.element(link, AFTER_LOAD).toHaveAttribute('href', '/prd/abc-123');
  });

  it('reports a saved PRD whose returned link is unsafe instead of showing nothing', async () => {
    mockSave({ id: 'abc-123', url: 'javascript:alert(1)' });
    mounted = mount(<PrdResult prd={PRD} onReset={() => undefined} />);

    await userEvent.click(page.getByRole('button', { name: copy.saveToSite }));
    await expect.element(page.getByRole('alert'), AFTER_LOAD).toHaveTextContent(copy.errors.unsafeLink);
    expect(page.getByRole('link', { name: /Saved/ }).elements()).toHaveLength(0);
  });

  it('says so on the button when the clipboard refuses the copy', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    mounted = mount(<PrdResult prd={PRD} onReset={() => undefined} />);

    await userEvent.click(page.getByRole('button', { name: copy.copy, exact: true }));
    await expect.element(page.getByRole('button', { name: copy.copyFailed })).toBeVisible();
  });
});
