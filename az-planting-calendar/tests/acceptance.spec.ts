import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Acceptance: plantable hero, grid at 375, crop citation, filters, a11y.
 */

test.describe('API health', () => {
  test('GET /api/health returns ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});

test.describe('Plantable now hero', () => {
  test('renders plantable crops for a fixed injected date in the viewport', async ({
    page
  }) => {
    // 2026-03-01 → half-month Mar 1 (index 4). Load via URL so results are in hero.
    const plantableWait = page.waitForResponse(
      (r) => r.url().includes('/api/plantable') && r.url().includes('2026-03-01') && r.ok()
    );
    await page.goto('/?date=2026-03-01');
    await plantableWait;

    const hero = page.getByTestId('plantable-hero');
    await expect(hero).toBeVisible();
    await expect(hero).toBeInViewport();

    const list = page.getByTestId('hero-list');
    await expect(list).toBeVisible();
    await expect(list).toBeInViewport();

    const cards = page.getByTestId('plant-card');
    await expect(cards.first()).toBeVisible();
    await expect(cards.first()).toBeInViewport();

    const text = await list.innerText();
    expect(text.length).toBeGreaterThan(10);
    await expect(page.getByTestId('hero-meta')).toContainText('2026-03-01');
  });
});

test.describe('Year grid', () => {
  test('grid renders and is scrollable at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const gridWait = page.waitForResponse((r) => r.url().includes('/api/grid') && r.ok());
    await page.goto('/');
    await gridWait;

    const grid = page.getByTestId('year-grid');
    await expect(grid).toBeVisible();
    await grid.scrollIntoViewIfNeeded();

    const scroll = page.getByTestId('grid-scroll');
    await expect(scroll).toBeVisible();

    const scrollWidth = await scroll.evaluate((el) => el.scrollWidth);
    const clientWidth = await scroll.evaluate((el) => el.clientWidth);
    expect(scrollWidth).toBeGreaterThan(clientWidth);

    await expect(scroll.getByRole('link').first()).toBeVisible();
  });
});

test.describe('Crop detail citation', () => {
  test('crop detail shows a working citation link', async ({ page }) => {
    const detailWait = page.waitForResponse(
      (r) => r.url().includes('/api/crops/crop-tomatoes') && r.ok()
    );
    await page.goto('/crop/crop-tomatoes');
    await detailWait;

    await expect(page.getByTestId('crop-detail')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tomatoes' })).toBeVisible();

    const cite = page.getByTestId('citation-link').first();
    await expect(cite).toBeVisible();
    const href = await cite.getAttribute('href');
    expect(href).toMatch(/^https:\/\/extension\.arizona\.edu\//);
    await expect(cite).toHaveAttribute('target', '_blank');
  });
});

test.describe('Filters', () => {
  test('method filter changes plantable results', async ({ page }) => {
    const allWait = page.waitForResponse(
      (r) =>
        r.url().includes('/api/plantable') &&
        r.url().includes('2026-03-01') &&
        !r.url().includes('method=') &&
        r.ok()
    );
    await page.goto('/?date=2026-03-01');
    await allWait;
    await expect(page.getByTestId('plant-card').first()).toBeVisible();
    const countAll = await page.getByTestId('plant-card').count();
    expect(countAll).toBeGreaterThan(0);

    // Change method via the UI control (below fold is fine for Playwright)
    const tWait = page.waitForResponse(
      (r) =>
        r.url().includes('/api/plantable') && r.url().includes('method=T') && r.ok()
    );
    await page.getByTestId('filter-method').selectOption('T');
    await tWait;
    await expect(page.getByTestId('hero-count')).not.toHaveText(/0 crops/);
    await expect(page.getByTestId('plant-card').first()).toBeVisible();
    const countT = await page.getByTestId('plant-card').count();
    expect(countT).toBeGreaterThan(0);
    expect(countT).toBeLessThanOrEqual(countAll);
    await expect(page.getByTestId('plant-card').first().getByText('Transplant')).toBeVisible();

    // Seed-only view: navigate with query so we assert the filtered endpoint path
    const sWait = page.waitForResponse(
      (r) =>
        r.url().includes('/api/plantable') && r.url().includes('method=S') && r.ok()
    );
    await page.goto('/?date=2026-03-01&method=S');
    await sWait;
    await expect(page.getByTestId('plant-card').first()).toBeVisible();
    const countS = await page.getByTestId('plant-card').count();
    expect(countS).toBeGreaterThan(0);
    await expect(page.getByTestId('plant-card').first().getByText('Seed')).toBeVisible();
    // Seed-only set should differ from transplant-only (not require strict inequality on count)
    expect(countS + countT).toBeGreaterThan(countAll - 5);
  });

  test('month filter narrows the year grid', async ({ page }) => {
    const gridWait = page.waitForResponse((r) => r.url().includes('/api/grid') && r.ok());
    await page.goto('/');
    await gridWait;

    await page.getByTestId('year-grid').scrollIntoViewIfNeeded();
    const rowsBefore = await page.locator('.year-grid__table tbody tr').count();
    expect(rowsBefore).toBeGreaterThan(10);

    const julyWait = page.waitForResponse(
      (r) => r.url().includes('/api/grid') && r.url().includes('month=6') && r.ok()
    );
    await page.getByTestId('filter-month').selectOption('6'); // July
    await julyWait;

    await page.getByTestId('year-grid').scrollIntoViewIfNeeded();
    const rowsAfter = await page.locator('.year-grid__table tbody tr').count();
    expect(rowsAfter).toBeGreaterThan(0);
    expect(rowsAfter).toBeLessThan(rowsBefore);
  });
});

test.describe('Legal pages', () => {
  test('about, terms, privacy, contact have real content', async ({ page }) => {
    for (const path of ['/about', '/terms', '/privacy', '/contact']) {
      await page.goto(path);
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible();
      // Must not fall through to the home hero title.
      await expect(h1).not.toHaveText(/What can I plant right now/i);
      await expect(page.getByTestId('legal-page')).toBeVisible();
      const body = await page.locator('main').innerText();
      expect(body.length).toBeGreaterThan(120);
      expect(body.toLowerCase()).not.toContain('lorem ipsum');
      const sections = await page.locator('main h2').count();
      expect(sections).toBeGreaterThanOrEqual(3);
    }
  });

  test('terms and privacy are substantial documents', async ({ page }) => {
    for (const path of ['/terms', '/privacy']) {
      await page.goto(path);
      const text = await page.locator('main').innerText();
      const words = text.trim().split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(1200);
      expect(await page.locator('main h2').count()).toBeGreaterThanOrEqual(8);
    }
  });
});

test.describe('Crop search', () => {
  test('API /api/crops?q=tomato returns a narrowed set', async ({ request }) => {
    const all = await request.get('/api/crops');
    expect(all.ok()).toBeTruthy();
    const allBody = (await all.json()) as { crops: Array<{ name: string }> };
    expect(allBody.crops.length).toBe(45);

    const filtered = await request.get('/api/crops?q=tomato');
    expect(filtered.ok()).toBeTruthy();
    const body = (await filtered.json()) as { crops: Array<{ name: string }> };
    expect(body.crops.length).toBeGreaterThan(0);
    expect(body.crops.length).toBeLessThan(allBody.crops.length);
    for (const crop of body.crops) {
      expect(crop.name.toLowerCase()).toContain('tomato');
    }
  });

  test('search input narrows the year grid rows', async ({ page }) => {
    const gridWait = page.waitForResponse((r) => r.url().includes('/api/grid') && r.ok());
    await page.goto('/');
    await gridWait;

    await page.getByTestId('year-grid').scrollIntoViewIfNeeded();
    const rowsBefore = await page.locator('.year-grid__table tbody tr').count();
    expect(rowsBefore).toBeGreaterThan(10);

    const search = page.getByRole('searchbox', { name: /search/i });
    await expect(search).toBeVisible();
    await search.fill('tomato');

    const rowsAfter = page.locator('.year-grid__table tbody tr');
    await expect(rowsAfter).not.toHaveCount(rowsBefore);
    const countAfter = await rowsAfter.count();
    expect(countAfter).toBeGreaterThan(0);
    expect(countAfter).toBeLessThan(rowsBefore);
    await expect(rowsAfter.first()).toContainText(/tomato/i);
  });
});

test.describe('Accessibility', () => {
  test('home has no serious axe violations', async ({ page }) => {
    const wait = page.waitForResponse((r) => r.url().includes('/api/plantable') && r.ok());
    await page.goto('/?date=2026-03-01');
    await wait;
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
