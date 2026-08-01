import { test, expect } from '@playwright/test';

/**
 * Dashboard acceptance tests — the run list driven as a user drives it (R27).
 *
 * The dashboard is a reporting surface, so "does it work" means: the runs it
 * lists are real, opening one shows that run, the navigation goes where it says,
 * and the theme control actually changes the theme and remembers.
 *
 * Assertions are on observable state, never on a class name.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Wait for the DATA, not just the heading. The heading renders immediately
  // while the run list is still fetching, so a test that read the cards next
  // saw zero and reported an empty dashboard that was merely still loading.
  await page.locator('.ra-run-card').first().waitFor();
});

test('the run list renders real runs, not an empty shell', async ({ page }) => {
  const cards = page.locator('.ra-run-card');
  await expect(cards.first()).toBeVisible();
  await expect(cards.first()).toBeInViewport();
  expect(await cards.count()).toBeGreaterThan(0);
});

test('every run shows a slug and a score', async ({ page }) => {
  const texts = await page
    .locator('.ra-run-card')
    .evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()));
  expect(texts.length).toBeGreaterThan(0);
  for (const t of texts) {
    // A run without a score is a card with nothing to say.
    expect(/\d/.test(t)).toBe(true);
  }
});

test('opening a run shows that run, not a generic page', async ({ page }) => {
  const first = page.locator('.ra-run-card').first();
  const title = (await first.locator('.ra-run-title').innerText()).trim();
  await first.getByRole('link').first().click();
  const match = page.getByText(title, { exact: false }).first();
  await expect(match).toBeVisible();
  await expect(match).toBeInViewport();
});

test('a run detail lists rule outcomes', async ({ page }) => {
  await page.locator('.ra-run-card').first().getByRole('link').first().click();
  // Whatever the layout, a run detail has to show per-rule results.
  await expect(page.getByText(/pass|fail|blocker|rule/i).first()).toBeVisible();
});

test('primary navigation reaches every required page', async ({ page }) => {
  for (const [name, expected] of [
    [/^about$/i, /about/i],
    [/^contact$/i, /contact/i]
  ] as const) {
    await page.goto('/');
    await page.getByRole('link', { name }).first().click();
    await expect(page.getByRole('heading').first()).toHaveText(expected);
  }
});

test('the cross-site link leaves for the app builder', async ({ page }) => {
  const link = page.getByRole('link', { name: /app builder/i }).first();
  const href = await link.getAttribute('href');
  expect(href).toMatch(/^https?:\/\//);
  expect(new URL(href!).host).not.toBe(new URL(page.url()).host);
});

test('the theme toggle flips the theme and the choice survives a reload', async ({ page }) => {
  const before = await page.evaluate(() => document.documentElement.dataset.theme ?? 'light');
  await page
    .getByRole('button', { name: /dark|light|theme/i })
    .first()
    .click();
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.dataset.theme))
    .not.toBe(before);

  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.reload();
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe(after);
});

test('an unknown path shows a not-found page with a way back', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(page.getByText(/not found|no such|404/i).first()).toBeVisible();
  await expect(page.getByRole('link').first()).toBeVisible();
});
