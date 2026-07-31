import { test, expect, type Page } from '@playwright/test';

/**
 * App-builder acceptance tests — the wizard driven as a user drives it.
 *
 * These exist for the same reason as QuickFlight's (R27): every static check
 * this repo runs can pass on a product whose controls do nothing. The repo-level
 * `e2e_smoke_app_builder.mjs` covers the happy path against production; this covers the
 * behaviour of the individual controls, and lives in the app so the app's own
 * gate can require it.
 *
 * Assertions are on what the user observes — which step is shown, whether the
 * action is enabled, what the PRD contains — never on a class name.
 *
 * Viewport checks (toBeInViewport / boundingBox vs innerHeight) are required
 * because toBeVisible() passes for content far below the fold (R34).
 */

const PROMPT =
  'a mobile-first app that finds the lowest cost airline flight with nonstop only and a maximum layover';

/**
 * True when the element's box overlaps the visible viewport.
 *
 * @param page - Playwright page.
 * @param locator - Element that must be on screen after an action.
 * @returns Whether the box intersects the viewport vertically.
 */
async function isOnScreen(page: Page, locator: ReturnType<Page['locator']>): Promise<boolean> {
  const box = await locator.first().boundingBox();
  if (box === null) return false;
  const height = await page.evaluate(() => window.innerHeight);
  return box.y + box.height > 0 && box.y < height;
}

/** Send the opening description and land on Scope. */
async function startWizard(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('textbox', { name: /describe your app/i }).fill(PROMPT);
  await page.getByRole('button', { name: /send description/i }).click();
  const next = page.getByRole('button', { name: /^next$/i });
  await expect(next).toBeVisible();
  // The primary result of Send is the Scope step controls — on screen, not
  // merely present somewhere in a tall document.
  await expect(next).toBeInViewport();
  await expect.poll(async () => isOnScreen(page, next)).toBe(true);
}

test('the composer refuses a description that is too short', async ({ page }) => {
  await page.goto('/');
  const send = page.getByRole('button', { name: /send description/i });
  await page.getByRole('textbox', { name: /describe your app/i }).fill('hi');
  await expect(send).toBeDisabled();
});

test('a real description enables the send action', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: /describe your app/i }).fill(PROMPT);
  await expect(page.getByRole('button', { name: /send description/i })).toBeEnabled();
});

test('an example chip fills the composer', async ({ page }) => {
  await page.goto('/');
  const box = page.getByRole('textbox', { name: /describe your app/i });
  await expect(box).toHaveValue('');
  // Scope to the examples list. A bare getByRole('listitem') matched the
  // "How this works" instruction steps, which are also <li> and are not
  // clickable — so this failed against a working control (R27 test hygiene).
  await page
    .getByRole('list', { name: /example/i })
    .getByRole('listitem')
    .first()
    .click();
  await expect(box).not.toHaveValue('');
});

test('Scope opens with the default app type already chosen', async ({ page }) => {
  await startWizard(page);
  await expect(page.getByRole('button', { name: /^mobile app$/i })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(page.getByRole('button', { name: /^next$/i })).toBeEnabled();
});

test('clearing the app type blocks progress, and re-picking restores it', async ({ page }) => {
  await startWizard(page);
  const next = page.getByRole('button', { name: /^next$/i });
  const appType = page.getByRole('textbox', { name: /^app type$/i });

  await appType.fill('');
  await expect(next).toBeDisabled();

  await page.getByRole('button', { name: /^mobile app$/i }).click();
  await expect(next).toBeEnabled();
});

test('choosing an app-type chip writes it into the field', async ({ page }) => {
  await startWizard(page);
  await page.getByRole('button', { name: /^saas$/i }).click();
  await expect(page.getByRole('textbox', { name: /^app type$/i })).toHaveValue(/saas/i);
});

test('the Features step blocks when nothing is selected', async ({ page }) => {
  await startWizard(page);
  await page.getByRole('button', { name: /^next$/i }).click();

  const boxes = page.locator('input[type=checkbox]');
  await expect(boxes.first()).toBeVisible();
  const total = await boxes.count();
  expect(total).toBeGreaterThan(0);

  for (let i = 0; i < total; i += 1) {
    const b = boxes.nth(i);
    if (await b.isChecked()) await b.uncheck();
  }
  await expect(page.getByRole('button', { name: /^next$/i })).toBeDisabled();

  await boxes.first().check();
  await expect(page.getByRole('button', { name: /^next$/i })).toBeEnabled();
});

test('Back returns to the previous step with answers intact', async ({ page }) => {
  await startWizard(page);
  await page.getByRole('textbox', { name: /^app type$/i }).fill('Marketplace');
  await page.getByRole('button', { name: /^next$/i }).click();
  await page.getByRole('button', { name: /^back$/i }).click();
  await expect(page.getByRole('textbox', { name: /^app type$/i })).toHaveValue('Marketplace');
});

test('Review shows the answers that were actually given', async ({ page }) => {
  await startWizard(page);
  await page.getByRole('textbox', { name: /main entities/i }).fill('flight');
  await page.getByRole('button', { name: /^next$/i }).click();
  await page.getByRole('button', { name: /^next$/i }).click();

  await expect(page.getByRole('button', { name: /forge prd/i })).toBeVisible();
  await expect(page.getByText('flight', { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/mobile app/i).first()).toBeVisible();
});

test('Forge PRD produces a document containing the prompt', async ({ page }) => {
  await startWizard(page);
  await page.getByRole('textbox', { name: /main entities/i }).fill('flight');
  await page.getByRole('button', { name: /^next$/i }).click();
  await page.getByRole('button', { name: /^next$/i }).click();

  const forge = page.getByRole('button', { name: /forge prd/i });
  await expect(forge).toBeInViewport();

  const submit = page.waitForResponse(
    (r) => r.url().includes('/api/submit') && r.request().method() === 'POST',
    { timeout: 20_000 }
  );
  await forge.click();
  await submit;

  // The generated document must reflect what was typed, not a template — and
  // that primary result must be ON SCREEN (R34), not 300px below the fold.
  const prdText = page.getByText(/lowest cost airline flight/i).first();
  await expect(prdText).toBeVisible({ timeout: 20_000 });
  await expect(prdText).toBeInViewport({ timeout: 20_000 });
  await expect.poll(async () => isOnScreen(page, prdText), { timeout: 10_000 }).toBe(true);

  const ready = page.getByText(/prd ready/i).first();
  await expect(ready).toBeVisible();
  await expect(ready).toBeInViewport();
});
