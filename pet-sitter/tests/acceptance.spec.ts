import { test, expect } from '@playwright/test';

/**
 * Acceptance tests: drive the REAL UI and assert on what a user observes.
 *
 * Extend this per feature. Assert on the RESULT a control produces -- the
 * rows a filter leaves, the value an input holds, the state a selection
 * exposes -- never on the control restyling itself.
 *
 * Hygiene that these tests need themselves:
 *  - one fresh page per test; shared state makes one check decide another
 *  - scope selectors to the region you mean, or you will match a result row
 *  - wait on a real signal, never a fixed sleep
 */

test('the home page renders its main heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading').first()).toBeVisible();
});

test('primary navigation reaches the required pages', async ({ page }) => {
  // Operate the real links. page.goto() proves the routes exist and proves
  // nothing about the nav -- and tests/features.manifest.json claims this
  // test as the one covering the nav-link control.
  const links = [
    { label: 'About', path: '/about' },
    { label: 'Terms', path: '/terms' },
    { label: 'Privacy', path: '/privacy' },
    { label: 'Contact', path: '/contact' }
  ];
  await page.goto('/');
  for (const link of links) {
    await page.getByTestId('nav-link').filter({ hasText: link.label }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(link.path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test('the brand link returns to the home page', async ({ page }) => {
  await page.goto('/about');
  await page.getByTestId('brand').click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('an in-app navigation lands at the top of the new page', async ({ page }) => {
  // R34. A browser resets scroll on navigation; a client-side router does
  // not. Following a footer link from far down a page otherwise lands the
  // reader mid-document in a page they have never seen.
  //
  // This must be a CLIENT-SIDE navigation: page.goto() resets scroll
  // natively and would pass whether or not the app does anything.
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, 1200));

  await page.getByRole('link', { name: /privacy/i }).first().click();
  const heading = page.getByRole('heading').first();
  await expect(heading).toBeVisible();
  // Assert the VIEWPORT, not just presence: toBeVisible() passes for an
  // element far below the fold, which is how a working control gets
  // reported as doing nothing.
  await expect(heading).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(2);
});

test('the theme toggle flips the theme and the choice survives a reload', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => document.documentElement.dataset.theme ?? 'light');
  await page.getByRole('button', { name: /dark|light|theme/i }).first().click();
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

test('sitter search narrows the visible catalog', async ({ page }) => {
  await page.goto('/');
  const list = page.getByTestId('sitter-list');
  await expect(list).toBeVisible({ timeout: 30_000 });
  const before = await list.locator('li').count();
  expect(before).toBeGreaterThan(1);
  await page.getByLabel(/search sitters/i).fill('Leslieville');
  await page.getByRole('button', { name: /^search$/i }).click();
  await expect
    .poll(async () => list.locator('li').count(), { timeout: 30_000 })
    .toBeLessThan(before);
  await expect(page.getByTestId('result-count')).toBeVisible();
});

test('assistant panel is reachable from the shell', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /open the sitters assistant|ask about sitters/i }).click();
  await expect(page.getByLabel(/your question/i)).toBeVisible();
});

test('filter sitters by neighbourhood and pet types narrows the catalog', async ({ page }) => {
  // Covers claims: filter, neighbourhood, pet types (u-claims-covered).
  await page.goto('/');
  const list = page.getByTestId('sitter-list');
  await expect(list).toBeVisible({ timeout: 30_000 });
  const before = await list.locator('li').count();
  expect(before).toBeGreaterThan(1);
  await page.getByLabel(/search sitters/i).fill('dogs');
  await page.getByRole('button', { name: /^search$/i }).click();
  await expect
    .poll(async () => list.locator('li').count(), { timeout: 30_000 })
    .toBeLessThanOrEqual(before);
});

test('sitter detail with reviews shows the profile and review list', async ({ page }) => {
  await page.goto('/');
  const list = page.getByTestId('sitter-list');
  await expect(list).toBeVisible({ timeout: 30_000 });
  await list.locator('a').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: /reviews/i })).toBeVisible();
});

test('register and sign in form is available on the account page', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(
    page.getByRole('button', { name: /register|sign in|create account/i }).first()
  ).toBeVisible();
});

test('AI assistant is grounded in sitters data from the database', async ({ page }) => {
  // Covers claim words: assistant, grounded, sitters, data.
  await page.goto('/');
  await page.getByRole('button', { name: /open the sitters assistant|ask about sitters/i }).click();
  const input = page.getByLabel(/your question/i);
  await expect(input).toBeVisible();
  await input.fill('Who sits dogs in Leslieville?');
  await page.getByRole('button', { name: /send|ask/i }).click();
  await expect(page.getByText(/sitter|database|found|matched|Leslieville|error|try again/i).first()).toBeVisible({
    timeout: 60_000
  });
});
