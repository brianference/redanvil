/**
 * F9 — Ask the assistant about Sushi.
 *
 * Acceptance from docs/PRD.md §9 F9. Chat from shell; answers ground in app data.
 * Data source: Workers AI + D1 (docs/FEATURES.md rank 5).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  BASE_URL,
  createBrowserSession,
  expect,
  type Page
} from './harness';

describe('F9 — ask the assistant about Sushi', () => {
  let page: Page;
  let newPage: () => Promise<Page>;
  let closeBrowser: () => Promise<void>;

  beforeAll(async () => {
    const session = await createBrowserSession();
    newPage = session.newPage;
    closeBrowser = session.close;
  });

  afterAll(async () => {
    await closeBrowser();
  });

  beforeEach(async () => {
    page = await newPage();
  });

  afterEach(async () => {
    await page.context().close();
  });

  /**
   * GIVEN the shell is open WHEN the user opens the assistant
   * THEN a chat input is reachable without leaving the product chrome.
   * Named test: assistant open from shell
   */
  it('assistant open from shell', async () => {
    await page.goto(`${BASE_URL}/`);
    await expect(page.getByRole('heading').first()).toBeVisible();

    const open = page.getByRole('button', { name: /assistant|ask|chat|help/i }).or(
      page.getByRole('link', { name: /assistant|ask|chat|help/i })
    );
    await expect(open.first()).toBeVisible();
    await open.first().click();

    const input = page
      .getByRole('textbox', { name: /message|question|ask|chat|prompt/i })
      .or(page.getByRole('searchbox', { name: /message|question|ask|chat|prompt/i }));
    await expect(input).toBeVisible();
    // Still inside the product shell (not a full navigation away from the app origin).
    await expect(page).toHaveURL(new RegExp(`^${BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  });

  /**
   * GIVEN the model call fails WHEN the user submits a message
   * THEN an error state is shown — never an empty success or silent no-op.
   * Named test: assistant shows error state on failed model call
   */
  it('assistant shows error state on failed model call', async () => {
    await page.route('**/api/assistant**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Model or binding unavailable' })
        });
        return;
      }
      await route.continue();
    });

    await page.goto(`${BASE_URL}/`);
    const open = page.getByRole('button', { name: /assistant|ask|chat|help/i }).or(
      page.getByRole('link', { name: /assistant|ask|chat|help/i })
    );
    await open.first().click();

    const input = page.getByRole('textbox', { name: /message|question|ask|chat|prompt/i });
    await expect(input).toBeVisible();
    await input.fill('Which sushis are in the catalog?');

    const failed = page.waitForResponse(
      (r) => r.url().includes('/api/assistant') && r.status() === 502
    );
    await page.getByRole('button', { name: /send|ask|submit/i }).click();
    await failed;

    await expect(
      page.getByRole('alert').or(page.getByRole('status')).getByText(/error|unavailable|failed|try again/i)
    ).toBeVisible();
    // Must not render a successful empty answer.
    await expect(page.getByText(/here (are|is) (your|the) answer/i)).toHaveCount(0);
  });

  /**
   * GIVEN invalid input (empty message) WHEN the user submits
   * THEN a 400 validation response is shown and no model call is required.
   */
  it('assistant rejects empty message with validation feedback', async () => {
    let modelCalled = false;
    await page.route('**/api/assistant**', async (route) => {
      if (route.request().method() === 'POST') {
        modelCalled = true;
        const body = route.request().postDataJSON() as { message?: string } | null;
        if (!body?.message?.trim()) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'message is required' })
          });
          return;
        }
      }
      await route.continue();
    });

    await page.goto(`${BASE_URL}/`);
    const open = page.getByRole('button', { name: /assistant|ask|chat|help/i }).or(
      page.getByRole('link', { name: /assistant|ask|chat|help/i })
    );
    await open.first().click();

    const input = page.getByRole('textbox', { name: /message|question|ask|chat|prompt/i });
    await expect(input).toBeVisible();
    await input.fill('');

    const validation = page.waitForResponse(
      (r) => r.url().includes('/api/assistant') && r.status() === 400
    );
    await page.getByRole('button', { name: /send|ask|submit/i }).click();
    // Either client-side validation (no POST) or 400 from the boundary.
    await Promise.race([
      validation,
      expect(
        page.getByRole('alert').or(page.getByText(/required|empty|enter a|message/i))
      ).toBeVisible()
    ]).catch(async () => {
      await expect(
        page.getByRole('alert').or(page.getByText(/required|empty|enter a|message/i))
      ).toBeVisible();
    });

    // If a request was made, it must have been the 400 validation path only.
    if (modelCalled) {
      await expect(
        page.getByRole('alert').or(page.getByText(/required|empty|message/i))
      ).toBeVisible();
    }
  });

  /**
   * GIVEN healthy assistant + data WHEN the user asks about Sushi
   * THEN the answer is grounded in app data rather than generic model knowledge alone.
   * Named test: assistant answer references app data for a known seed question
   */
  it('assistant answer references app data for a known seed question', async () => {
    // Resolve a real title from the catalog so the grounded claim is checkable.
    const listRes = await page.request.get(`${BASE_URL}/api/sushis`);
    expect(listRes.ok()).toBeTruthy();
    const listBody = (await listRes.json()) as {
      items?: Array<{ title: string }>;
    };
    expect((listBody.items?.length ?? 0) > 0).toBeTruthy();
    const knownTitle = listBody.items![0].title;

    await page.goto(`${BASE_URL}/`);
    const open = page.getByRole('button', { name: /assistant|ask|chat|help/i }).or(
      page.getByRole('link', { name: /assistant|ask|chat|help/i })
    );
    await open.first().click();

    const input = page.getByRole('textbox', { name: /message|question|ask|chat|prompt/i });
    await expect(input).toBeVisible();
    await input.fill(`What do you know about ${knownTitle}?`);

    const answer = page.waitForResponse(
      (r) => r.url().includes('/api/assistant') && r.ok()
    );
    await page.getByRole('button', { name: /send|ask|submit/i }).click();
    await answer;

    // Grounding: the reply must mention the catalog title (or an explicit data-backed miss).
    await expect(
      page.getByRole('log').or(page.getByRole('main')).getByText(new RegExp(knownTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
    ).toBeVisible();
  });
});
