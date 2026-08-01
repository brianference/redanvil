import { test, expect, type Page } from '@playwright/test';

/**
 * Coverage for interactive controls the rest of the suite does not already
 * exercise. `scripts/feature-audit.mjs` crawls the running app and fails when
 * a control is not claimed in `tests/features.manifest.json`; this file holds
 * the claims that are not the run-list happy-path.
 */

const ROUTES = ['/', '/about', '/terms', '/privacy', '/contact'] as const;

/**
 * True when the element's box overlaps the visible viewport.
 *
 * @param page - Playwright page.
 * @param locator - Locator for the element that must be on screen.
 * @returns Whether the box intersects the viewport vertically.
 */
async function isOnScreen(
  page: Page,
  locator: ReturnType<Page['locator']>
): Promise<boolean> {
  const box = await locator.first().boundingBox();
  if (box === null) return false;
  const height = await page.evaluate(() => window.innerHeight);
  return box.y + box.height > 0 && box.y < height;
}

test('theme toggle flips and persists', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByTestId('theme-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeInViewport();

  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await toggle.click();
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.dataset.theme))
    .not.toBe(before);

  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.reload();
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe(after);
});

test('every header and footer link navigates', async ({ page }) => {
  await page.goto('/');

  await page.locator('.ra-nav-link', { hasText: /^About$/i }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/about/i);
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();

  await page.getByRole('link', { name: /^Runs$/i }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();

  await page.getByRole('link', { name: /^Contact$/i }).first().click();
  await expect(page).toHaveURL(/\/contact/);
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();

  await page.getByRole('link', { name: /^Terms$/i }).first().click();
  await expect(page).toHaveURL(/\/terms/);
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();

  await page.getByRole('link', { name: /^Privacy$/i }).first().click();
  await expect(page).toHaveURL(/\/privacy/);
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
});

test('the brand logo is an operable home-or-builder link', async ({ page }) => {
  await page.goto('/about');
  const logo = page.getByRole('link', { name: /redanvil/i }).first();
  await expect(logo).toBeVisible();
  await expect(logo).toBeInViewport();
  const href = await logo.getAttribute('href');
  expect(href).toMatch(/redanvil|^\//i);
});

test('breadcrumb Home returns to runs', async ({ page }) => {
  await page.goto('/about');
  await page
    .getByRole('navigation', { name: /breadcrumb/i })
    .getByRole('link', { name: /^Home$/i })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
});

test('outbound links carry rel=noopener or noreferrer', async ({ page }) => {
  for (const route of ['/about', '/terms', '/privacy', '/contact'] as const) {
    await page.goto(route);
    const external = page.locator('a[href^="http"]');
    const count = await external.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const rel = ((await external.nth(i).getAttribute('rel')) ?? '').toLowerCase();
      const target = await external.nth(i).getAttribute('target');
      if (target === '_blank') {
        expect(rel.includes('noopener') || rel.includes('noreferrer')).toBe(true);
      }
    }
  }

  await page.goto('/');
  const builder = page.getByRole('link', { name: /^App Builder$/i }).first();
  await expect(builder).toHaveAttribute('href', /redanvil/);
  const gh = page.getByRole('link', { name: /^GitHub$/i }).first();
  await expect(gh).toHaveAttribute('href', /github\.com/);
});

test('opening a run puts its detail heading on screen', async ({ page }) => {
  await page.goto('/');
  await page.locator('.ra-run-card').first().waitFor({ timeout: 20_000 });
  await page.locator('.ra-run-card').first().getByRole('link').first().click();
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toBeVisible();
  await expect(heading).toBeInViewport();
  await expect
    .poll(async () => isOnScreen(page, heading))
    .toBe(true);
});

test('navigating between pages starts at the top', async ({ page }) => {
  await page.goto('/about');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

  await page.goto('/terms');
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(20);
});

// Every route, not just the flow ones. The defect this guards is content that
// renders correctly and lands below the fold, so a route whose heading is off
// screen on arrival reads as a blank page to the person who opened it.
for (const route of ROUTES) {
  test(`landing on ${route} puts its heading on screen`, async ({ page }) => {
    await page.goto(route);
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toBeInViewport();
  });
}
