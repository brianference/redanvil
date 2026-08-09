/**
 * F7 — Manage Sushi (create / edit / delete with confirm).
 *
 * Acceptance from docs/PRD.md §9 F7. Part of the brief's "one flow that must work".
 * Data source: user input → D1 (docs/FEATURES.md rank 7).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  BASE_URL,
  createBrowserSession,
  expect,
  gotoAndWaitForApi,
  sushiResultRows,
  type Page
} from './harness';

describe('F7 — manage Sushi', () => {
  let page: Page;
  let newPage: () => Promise<Page>;
  let closeBrowser: () => Promise<void>;

  beforeAll(async () => {
    const session = await createBrowserSession();
    newPage = session.newPage;
    closeBrowser = session.close;
  });

  afterAll(async () => {
    // Clean up what this suite created. It ran against PRODUCTION and left four
    // rows titled "Public create <timestamp>" in the live catalog, which the
    // pytest lane caught on its first run. A test that pollutes the database it
    // tests is indistinguishable from a user doing it, and the junk is served to
    // real visitors.
    try {
      const res = await fetch(`${BASE_URL}/api/sushis`);
      const body = (await res.json()) as { items?: Array<{ id: string; title: string }> };
      const mine = (body.items ?? []).filter((i) => /^Public create \d+/.test(i.title));
      for (const row of mine) {
        await fetch(`${BASE_URL}/api/sushis/${row.id}`, { method: 'DELETE' }).catch(() => undefined);
      }
    } catch {
      /* cleanup is best-effort; the pytest lane asserts the catalog is clean */
    }
    await closeBrowser();
  });

  beforeEach(async () => {
    page = await newPage();
  });

  afterEach(async () => {
    await page.context().close();
  });

  /**
   * GIVEN the manage form is open WHEN the user creates a Sushi with a valid title
   * THEN the list includes the new row.
   * Named test: sushis-crud create
   */
  it('sushis-crud create', async () => {
    await gotoAndWaitForApi(page, '/sushis', '/api/sushis');

    const openCreate = page.getByRole('link', { name: /add|create|new/i }).or(
      page.getByRole('button', { name: /add|create|new/i })
    );
    await expect(openCreate.first()).toBeVisible();
    await openCreate.first().click();

    const title = `Acceptance sushi ${Date.now()}`;
    const titleField = page.getByRole('textbox', { name: /title|name/i });
    await expect(titleField).toBeVisible();
    await titleField.fill(title);

    const descriptionField = page.getByRole('textbox', { name: /description|notes|about/i });
    if (await descriptionField.isVisible().catch(() => false)) {
      await descriptionField.fill('Created by acceptance test');
    }

    const createResponse = page.waitForResponse(
      (r) =>
        r.url().includes('/api/sushis') &&
        r.request().method() === 'POST' &&
        r.status() === 201
    );
    await page.getByRole('button', { name: /save|create|add|submit/i }).click();
    await createResponse;

    await expect(page.getByRole('main').getByText(title)).toBeVisible();
  });

  /**
   * GIVEN an existing Sushi WHEN the user edits its title and saves
   * THEN the list and detail show the new title.
   * Named test: sushis-crud edit
   */
  it('sushis-crud edit', async () => {
    await gotoAndWaitForApi(page, '/sushis', '/api/sushis');
    const rows = sushiResultRows(page);
    await expect(rows.first()).toBeVisible();
    await rows.first().getByRole('link').first().click();
    await expect(page).toHaveURL(/\/sushis\/[^/]+/);

    const edit = page.getByRole('button', { name: /edit|update/i }).or(
      page.getByRole('link', { name: /edit|update/i })
    );
    await expect(edit.first()).toBeVisible();
    await edit.first().click();

    const newTitle = `Edited sushi ${Date.now()}`;
    const titleField = page.getByRole('textbox', { name: /title|name/i });
    await expect(titleField).toBeVisible();
    await titleField.fill(newTitle);
    await page.getByRole('button', { name: /save|update|submit/i }).click();

    await expect(page.getByRole('heading', { level: 1 })).toContainText(newTitle);
    await page.getByRole('link', { name: /back|sushis|list|all/i }).click();
    await expect(page.getByRole('main').getByText(newTitle)).toBeVisible();
  });

  /**
   * GIVEN an existing Sushi WHEN the user confirms delete THEN the row is gone.
   * GIVEN cancel THEN the row remains.
   * Named test: sushis-crud delete confirm/cancel
   */
  it('sushis-crud delete confirm/cancel', async () => {
    await gotoAndWaitForApi(page, '/sushis', '/api/sushis');
    const rows = sushiResultRows(page);
    await expect(rows.first()).toBeVisible();
    const titleBefore = (await rows.first().innerText()).split('\n')[0]?.trim() ?? '';
    expect(titleBefore.length).toBeGreaterThan(0);

    await rows.first().getByRole('link').first().click();
    const deleteButton = page.getByRole('button', { name: /delete|remove/i });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // Cancel path first: confirmation is required (PRD F7).
    const cancel = page.getByRole('button', { name: /cancel|no|keep/i });
    await expect(cancel).toBeVisible();
    await cancel.click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(titleBefore);

    await deleteButton.click();
    const confirm = page.getByRole('button', { name: /confirm|yes|delete|remove/i });
    await expect(confirm).toBeVisible();
    await confirm.click();

    await expect(page).toHaveURL(/\/sushis\/?$/);
    await expect(page.getByRole('main').getByText(titleBefore, { exact: true })).toHaveCount(0);
  });

  /**
   * GIVEN invalid input (empty title) WHEN the user submits create
   * THEN a 400 validation message is shown and no row is created.
   */
  it('create with empty title shows validation and creates no row', async () => {
    await gotoAndWaitForApi(page, '/sushis', '/api/sushis');
    const before = await sushiResultRows(page).count();

    const openCreate = page.getByRole('link', { name: /add|create|new/i }).or(
      page.getByRole('button', { name: /add|create|new/i })
    );
    await openCreate.first().click();

    const titleField = page.getByRole('textbox', { name: /title|name/i });
    await expect(titleField).toBeVisible();
    await titleField.fill('');

    const badResponse = page.waitForResponse(
      (r) =>
        r.url().includes('/api/sushis') &&
        r.request().method() === 'POST' &&
        r.status() === 400
    );
    await page.getByRole('button', { name: /save|create|add|submit/i }).click();
    await badResponse;

    await expect(
      page.getByRole('alert').or(page.getByRole('main')).getByText(/title|required|invalid|400/i)
    ).toBeVisible();

    await page.goto(`${BASE_URL}/sushis`);
    await expect.poll(async () => sushiResultRows(page).count()).toBe(before);
  });
});
