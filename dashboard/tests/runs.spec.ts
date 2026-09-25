import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Dashboard acceptance tests — the run list driven as a user drives it (R27).
 *
 * The dashboard is a reporting surface, so "does it work" means: the runs it
 * lists are real, opening one shows that run, the navigation goes where it says,
 * and the theme control actually changes the theme and remembers.
 *
 * Assertions are on observable state, never on a class name.
 */

/**
 * Every run card, found by role rather than class: the articles in the run list.
 *
 * @param page - Playwright page.
 * @returns Locator for the cards.
 */
function runCards(page: Page): Locator {
  return page.getByRole('list', { name: /recent builds/i }).getByRole('article');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Wait for the DATA, not just the heading. The heading renders immediately
  // while the run list is still fetching, so a test that read the cards next
  // saw zero and reported an empty dashboard that was merely still loading.
  await runCards(page).first().waitFor();
});

test('the run list shows every run the feed returned, and counts them', async ({ page }) => {
  const cards = runCards(page);
  await expect(cards.first()).toBeInViewport();
  // The header's "N shown" and the cards under it must agree: a count written
  // separately from its list can drift from it.
  const shown = await page.getByText(/^\d+ shown$/).innerText();
  await expect(cards).toHaveCount(Number.parseInt(shown, 10));
});

test('every run shows its slug, verdict, and score summary', async ({ page }) => {
  for (const card of await runCards(page).all()) {
    await expect(card.getByRole('link').first()).toHaveText(/^[a-z0-9][a-z0-9-]*$/);
    await expect(card.getByText(/^(pass|fail)$/i)).toBeVisible();
    // "0 · 84/84 rules · 1 iteration": score, coverage, iteration count.
    await expect(card.getByText(/^\d+(\.\d+)? · \d+\/\d+ rules · \d+ iterations?$/)).toBeVisible();
  }
});

test('opening a run shows that run, not a generic page', async ({ page }) => {
  const titleLink = runCards(page).first().getByRole('link').first();
  const slug = (await titleLink.innerText()).trim();
  await titleLink.click();
  await expect(page).toHaveURL(new RegExp(`/run/${slug}$`));
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText(slug);
  await expect(heading).toBeInViewport();
});

test('a run detail lists each rule with its outcome', async ({ page }) => {
  await runCards(page).first().getByRole('link').first().click();
  const rules = page.getByRole('region', { name: /per-rule breakdown/i }).getByRole('listitem');
  await expect(rules.first()).toBeVisible();
  for (const rule of await rules.all()) {
    await expect(rule.locator('code')).toHaveText(/^[a-z0-9]+(-[a-z0-9]+)+$/);
    await expect(rule.getByText(/^(pass|fail)$/i)).toBeVisible();
  }
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

test('an unknown path shows a not-found page whose way back works', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/page not found/i);
  await page
    .getByRole('main')
    .getByRole('link', { name: /back to home/i })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(runCards(page).first()).toBeVisible();
});
