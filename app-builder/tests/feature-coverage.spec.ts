import { test, expect, type Page } from '@playwright/test';

/**
 * Coverage for interactive controls the rest of the suite does not already
 * exercise. `scripts/feature-audit.mjs` crawls the running app and fails when
 * a control is not claimed in `tests/features.manifest.json`; this file holds
 * the claims that are not the wizard happy-path.
 */

const ROUTES = ['/', '/examples', '/about', '/terms', '/privacy', '/contact', '/saved'] as const;

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

  // Header primary nav uses .ra-nav-link — one structural class, many items.
  await page.locator('.ra-nav-link', { hasText: /^About$/i }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/about/i);
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();

  await page.getByRole('link', { name: /^App Builder$/i }).first().click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole('link', { name: /^Saved$/i }).first().click();
  await expect(page).toHaveURL(/\/saved/);

  await page.getByRole('link', { name: /^Contact$/i }).first().click();
  await expect(page).toHaveURL(/\/contact/);

  await page.getByRole('link', { name: /^Terms$/i }).first().click();
  await expect(page).toHaveURL(/\/terms/);

  await page.getByRole('link', { name: /^Privacy$/i }).first().click();
  await expect(page).toHaveURL(/\/privacy/);
});

test('the brand logo is an operable home link', async ({ page }) => {
  await page.goto('/about');
  await page.getByRole('link', { name: /redanvil/i }).first().click();
  // Logo href is the absolute production origin; accept either SPA home or full URL.
  await expect(page).toHaveURL(/redanvil|\/$/i);
});

test('breadcrumb Home returns to the builder', async ({ page }) => {
  await page.goto('/about');
  await page.getByRole('navigation', { name: /breadcrumb/i }).getByRole('link', { name: /^Home$/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
});

test('outbound links carry rel=noopener or noreferrer', async ({ page }) => {
  for (const route of ['/about', '/terms', '/privacy', '/contact', '/examples'] as const) {
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

  // Header/footer Dashboard + GitHub are also external.
  await page.goto('/');
  const dash = page.getByRole('link', { name: /^Dashboard$/i }).first();
  await expect(dash).toHaveAttribute('href', /redanvil-dashboard/);
  const gh = page.getByRole('link', { name: /^GitHub$/i }).first();
  await expect(gh).toHaveAttribute('href', /github\.com/);
});

test('examples page exposes live app and source links', async ({ page }) => {
  await page.goto('/examples');
  const live = page.getByRole('link', { name: /open the live app/i }).first();
  const source = page.getByRole('link', { name: /read the source/i }).first();
  await expect(live).toBeVisible();
  await expect(source).toBeVisible();
  await expect(live).toHaveAttribute('href', /^https?:\/\//);
  await expect(source).toHaveAttribute('href', /^https?:\/\//);
  await expect(live).toBeInViewport();
});

test('start from a template opens the template gallery', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /start from a template/i }).click();
  await expect(page.getByRole('heading', { level: 1, name: /template/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
  await expect
    .poll(async () => isOnScreen(page, page.getByRole('heading', { level: 1 })))
    .toBe(true);
});

test('saved New build returns to the composer', async ({ page }) => {
  await page.goto('/saved');
  await page.getByRole('link', { name: /new build/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('textbox', { name: /describe your app/i })).toBeInViewport();
});

test('saved Retry is present when the list fails to load', async ({ page }) => {
  // Induce the failure, do not depend on the server lacking a backend. The
  // original version relied on `vite preview` having no Pages Functions, so it
  // passed only while the harness was wrong: booting the real Workers runtime
  // made /api/prds succeed and the error state it asserts stopped existing.
  // A test that needs the environment broken is testing the environment.
  await page.route('**/api/prds*', (route) => route.fulfill({ status: 500, body: '{}' }));
  await page.goto('/saved');
  const retry = page.getByRole('button', { name: /^retry$/i });
  await expect(retry).toBeVisible({ timeout: 15_000 });
  await expect(retry).toBeInViewport();
});

test('navigating between pages starts at the top', async ({ page }) => {
  await page.goto('/examples');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

  await page.goto('/about');
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
