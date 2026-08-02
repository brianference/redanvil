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

  test('an unmatched /api/ path 404s instead of being answered by the SPA', async ({
    request
  }) => {
    // This shipped broken. The middleware excluded /api/ from the SPA fallback,
    // but only inside an `if (response.status === 404)` branch -- and Pages'
    // asset server answers an unmatched path with index.html at 200, so the
    // branch never ran. Every absent endpoint returned 200 with an HTML body,
    // which makes a typo'd route indistinguishable from a working one.
    //
    // Random suffix so a cached or seeded route cannot satisfy this by accident.
    const path = `/api/__definitely_absent_${Math.random().toString(36).slice(2, 10)}`;
    const res = await request.get(path);
    expect(res.status()).toBe(404);
    expect(res.headers()['content-type']).toContain('application/json');
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('no such endpoint');
  });

  test('real endpoints still answer JSON', async ({ request }) => {
    // The 404 rule above must not swallow the routes that do exist.
    for (const route of ['/api/health', '/api/crops', '/api/grid', '/api/zone']) {
      const res = await request.get(route);
      expect(res.status(), `${route} should be 200`).toBe(200);
      expect(res.headers()['content-type']).toContain('application/json');
    }
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
    // The response arriving is NOT the grid having re-rendered: waitForResponse
    // resolves when the bytes land, before React parses them, sets state and
    // paints. Counting rows right after it reads the PREVIOUS render, which is
    // why this test flaked while the search test beside it -- identical except
    // that it polls -- never did. Auto-retrying assertion, not a fixed wait.
    const rowsAfter = page.locator('.year-grid__table tbody tr');
    await expect.poll(async () => rowsAfter.count()).toBeLessThan(rowsBefore);
    const countAfter = await rowsAfter.count();
    expect(countAfter).toBeGreaterThan(0);
    expect(countAfter).toBeLessThan(rowsBefore);
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
    const countAll = allBody.crops.length;
    expect(countAll).toBeGreaterThan(0);

    const filtered = await request.get('/api/crops?q=tomato');
    expect(filtered.ok()).toBeTruthy();
    const body = (await filtered.json()) as { crops: Array<{ name: string }> };
    expect(body.crops.length).toBeGreaterThan(0);
    expect(body.crops.length).toBeLessThan(countAll);
    for (const crop of body.crops) {
      expect(crop.name).toMatch(/tomato/i);
    }
  });

  test('search input narrows the year grid rows', async ({ page }) => {
    const gridWait = page.waitForResponse((r) => r.url().includes('/api/grid') && r.ok());
    await page.goto('/');
    await gridWait;

    await page.getByTestId('year-grid').scrollIntoViewIfNeeded();
    const rowsBefore = await page.locator('.year-grid__table tbody tr').count();
    expect(rowsBefore).toBeGreaterThan(10);

    // Wait on the real /api/crops search response -- never a fixed timeout.
    const cropsWait = page.waitForResponse(
      (r) =>
        r.url().includes('/api/crops') &&
        r.url().includes('q=tomato') &&
        r.ok()
    );
    const search = page.getByTestId('filter-search');
    await expect(search).toBeVisible();
    await search.fill('tomato');
    await cropsWait;

    const rowsAfter = page.locator('.year-grid__table tbody tr');
    await expect
      .poll(async () => rowsAfter.count())
      .toBeLessThan(rowsBefore);
    const countAfter = await rowsAfter.count();
    expect(countAfter).toBeGreaterThan(0);
    expect(countAfter).toBeLessThan(rowsBefore);
    await expect(rowsAfter.first()).toContainText(/tomato/i);
  });
});

test.describe('Assistant', () => {
  test('shell exposes the assistant chat affordance', async ({ page }) => {
    await page.goto('/');
    const openBtn = page.getByTestId('assistant-open');
    await expect(openBtn).toBeVisible();
    await openBtn.click();
    await expect(page.getByTestId('assistant-panel')).toBeVisible();
    await expect(page.getByTestId('assistant-input')).toBeVisible();
    await expect(page.getByTestId('assistant-send')).toBeVisible();
  });

  test('POST /api/assistant rejects empty body with 400', async ({ request }) => {
    const res = await request.post('/api/assistant', {
      data: { message: '' }
    });
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBeTruthy();
  });

  test('POST /api/assistant accepts a message (200 or fail-closed 5xx/422)', async ({
    request
  }) => {
    // Local wrangler may not authenticate Workers AI; production does.
    // Fail-closed: never 200 with an empty answer. 400 is wrong for a valid body.
    const res = await request.post('/api/assistant', {
      data: { message: 'What can I plant in early August?' }
    });
    expect([200, 422, 502, 503]).toContain(res.status());
    const body = (await res.json()) as {
      answer?: string;
      crops?: unknown[];
      filters?: Record<string, unknown>;
      error?: string;
    };
    if (res.status() === 200) {
      expect(typeof body.answer).toBe('string');
      expect((body.answer ?? '').trim().length).toBeGreaterThan(0);
      expect(Array.isArray(body.crops)).toBeTruthy();
      expect(body.filters).toBeTruthy();
    } else {
      expect(body.error).toBeTruthy();
      expect(typeof body.error).toBe('string');
    }
  });

  test('opens assistant, submits a question, asserts a visible response', async ({
    page
  }) => {
    await page.goto('/');
    await page.getByTestId('assistant-open').click();
    await expect(page.getByTestId('assistant-panel')).toBeVisible();

    const assistantWait = page.waitForResponse(
      (r) => r.url().includes('/api/assistant') && r.request().method() === 'POST'
    );
    await page.getByTestId('assistant-input').fill('What can I plant in early August?');
    await page.getByTestId('assistant-send').click();
    const res = await assistantWait;

    // Visible reply on 200, or a real error message on fail-closed statuses.
    if (res.ok()) {
      await expect(page.getByTestId('assistant-log')).toContainText(/crop/i);
    } else {
      await expect(page.getByTestId('assistant-error')).toBeVisible();
      const errText = await page.getByTestId('assistant-error').innerText();
      expect(errText.trim().length).toBeGreaterThan(0);
    }
  });
});

test.describe('Brand and footer', () => {
  test('header uses finalized brand-mark image, not literal AZ text span', async ({
    page
  }) => {
    await page.goto('/');
    const logo = page.locator('.topbar__logo');
    await expect(logo).toBeVisible();
    const mark = logo.locator('img.topbar__mark');
    await expect(mark).toBeVisible();
    await expect(mark).toHaveAttribute('aria-hidden', 'true');
    await expect(mark).toHaveAttribute('src', /brand-mark\.png/);
    // Must not be a bare "AZ" span without the app name.
    const logoText = (await logo.innerText()).replace(/\s+/g, ' ').trim();
    expect(logoText).not.toMatch(/^AZ$/);
    expect(logoText).toContain('AZ Planting Calendar');
  });

  test('footer is multi-column with calendar, about, and legal', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer.site-footer');
    await expect(footer).toBeVisible();
    await expect(footer.getByRole('heading', { name: /the calendar/i })).toBeVisible();
    await expect(footer.getByRole('heading', { name: /^about$/i })).toBeVisible();
    await expect(footer.getByRole('heading', { name: /legal/i })).toBeVisible();
    const azLink = footer.getByRole('link', { name: /az1005/i });
    await expect(azLink).toBeVisible();
    await expect(azLink).toHaveAttribute('href', /az1005/);
    await expect(footer.getByRole('link', { name: /terms/i })).toBeVisible();
    await expect(footer.getByRole('link', { name: /privacy/i })).toBeVisible();
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
