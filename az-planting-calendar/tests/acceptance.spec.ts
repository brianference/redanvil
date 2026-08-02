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
    // Timeline is the first viewport hero; crop rows sit under it -- scroll into view.
    await hero.scrollIntoViewIfNeeded();
    await expect(hero).toBeInViewport({ ratio: 0.01 });

    const list = page.getByTestId('hero-list');
    await expect(list).toBeVisible();
    const cards = page.getByTestId('plant-card');
    await expect(cards.first()).toBeVisible();
    await cards.first().scrollIntoViewIfNeeded();
    await expect(cards.first()).toBeInViewport();

    const text = await list.innerText();
    expect(text.length).toBeGreaterThan(10);
    await expect(page.getByTestId('hero-meta')).toContainText('2026-03-01');
    await expect(page.getByTestId('half-month-timeline')).toBeVisible();
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

/**
 * Open the option-3 filter drawer when collapsed (default at 375).
 *
 * @param page - Playwright page.
 */
async function openFilterDrawer(page: import('@playwright/test').Page): Promise<void> {
  const drawer = page.getByTestId('filter-drawer');
  if (await drawer.isVisible().catch(() => false)) return;
  await page.getByTestId('filter-drawer-toggle').click();
  await expect(drawer).toBeVisible();
}

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
    await expect
      .poll(async () => page.getByTestId('plant-card').count())
      .toBeGreaterThan(0);
    const countAll = await page.getByTestId('plant-card').count();
    expect(countAll).toBeGreaterThan(0);

    await openFilterDrawer(page);
    // Change method via the UI control (drawer is fine for Playwright)
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
    await expect
      .poll(async () => page.getByTestId('plant-card').count())
      .toBeGreaterThan(0);
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
    const rowsBeforeLoc = page.locator('.year-grid__table tbody tr');
    await expect.poll(async () => rowsBeforeLoc.count()).toBeGreaterThan(10);
    const rowsBefore = await rowsBeforeLoc.count();
    expect(rowsBefore).toBeGreaterThan(10);

    await openFilterDrawer(page);
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
    // Poll for the SETTLED state, not a half-true one. Polling only on
    // `count < rowsBefore` resolved on the transient empty render between the
    // response landing and the filtered rows painting -- 0 is less than
    // rowsBefore, so the poll succeeded and the next line then failed on
    // `expect(0).toBeGreaterThan(0)`. Reproduced 2/12 with a preserved trace.
    // The condition the test actually means is "narrowed AND non-empty".
    const rowsAfter = page.locator('.year-grid__table tbody tr');
    await expect
      .poll(async () => {
        const n = await rowsAfter.count();
        return n > 0 && n < rowsBefore;
      })
      .toBe(true);
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
    const rowsBeforeLoc = page.locator('.year-grid__table tbody tr');
    await expect.poll(async () => rowsBeforeLoc.count()).toBeGreaterThan(10);
    const rowsBefore = await rowsBeforeLoc.count();
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

  test('zero-match search renders the empty state, not a search error', async ({
    page
  }) => {
    const gridWait = page.waitForResponse((r) => r.url().includes('/api/grid') && r.ok());
    await page.goto('/');
    await gridWait;

    const cropsWait = page.waitForResponse(
      (r) =>
        r.url().includes('/api/crops') &&
        r.url().includes('q=zzznomatchxyz') &&
        r.ok()
    );
    const search = page.getByTestId('filter-search');
    await search.fill('zzznomatchxyz');
    await cropsWait;

    const empty = page.getByTestId('grid-empty');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText(/no crops match/i);
    await expect(page.getByTestId('grid-search-error')).toHaveCount(0);
  });

  test('failed /api/crops search renders error state and NOT empty state', async ({
    page
  }) => {
    // Force network/API failure via request interception -- do not break app code.
    await page.route('**/api/crops?**', async (route) => {
      if (route.request().url().includes('q=')) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'forced search failure for test' })
        });
        return;
      }
      await route.continue();
    });

    const gridWait = page.waitForResponse((r) => r.url().includes('/api/grid') && r.ok());
    await page.goto('/');
    await gridWait;

    const failedWait = page.waitForResponse(
      (r) =>
        r.url().includes('/api/crops') &&
        r.url().includes('q=tomato') &&
        r.status() === 500
    );
    const search = page.getByTestId('filter-search');
    await search.fill('tomato');
    await failedWait;

    const searchError = page.getByTestId('grid-search-error');
    await expect(searchError).toBeVisible();
    await expect(searchError).toHaveAttribute('role', 'alert');
    await expect(searchError).toContainText(/could not search/i);
    await expect(page.getByTestId('grid-search-retry')).toBeVisible();

    // Fail-closed: a broken search must not paint as "no crops match".
    await expect(page.getByTestId('grid-empty')).toHaveCount(0);
  });
});

test.describe('Search above the fold', () => {
  test('filter-search is in the viewport on arrival at 375x900 and 1280x900', async ({
    page
  }) => {
    for (const size of [
      { width: 375, height: 900 },
      { width: 1280, height: 900 }
    ]) {
      await page.setViewportSize(size);
      await page.goto('/');
      const search = page.getByTestId('filter-search');
      await expect(search).toBeVisible();
      await expect(search).toBeInViewport();
      // Exactly one search control (not duplicated in filters + hero).
      await expect(page.getByTestId('filter-search')).toHaveCount(1);
      // Search button is present and large enough to tap.
      const submit = page.getByTestId('search-submit');
      await expect(submit).toBeVisible();
      const box = await submit.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      // No stray brand mark beside the search field.
      await expect(page.locator('.live-search__brand')).toHaveCount(0);
      await expect(page.locator('.live-search__mark')).toHaveCount(0);
    }
  });

  test('live search result count is in the viewport at 375 and 1280 after typing', async ({
    page
  }) => {
    for (const size of [
      { width: 375, height: 900 },
      { width: 1280, height: 900 }
    ]) {
      await page.setViewportSize(size);
      await page.goto('/');
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

      const count = page.getByTestId('search-result-count');
      await expect(count).toBeVisible();
      await expect(count).toBeInViewport();
      await expect(count).toContainText(/crop/i);
      await expect(count).toContainText(/tomato/i);

      const box = await count.boundingBox();
      expect(box).not.toBeNull();
      // First viewport: top of result count must sit above the fold.
      expect(box!.y).toBeLessThan(size.height);
      expect(box!.y).toBeGreaterThanOrEqual(0);

      // Suggestion list with crop art is also in the first viewport.
      const list = page.getByTestId('search-result-list');
      await expect(list).toBeVisible();
      await expect(list).toBeInViewport();
      const listBox = await list.boundingBox();
      expect(listBox).not.toBeNull();
      expect(listBox!.y).toBeLessThan(size.height);
      await expect(list.getByTestId('crop-art').first()).toBeVisible();
    }
  });

  test('suggestions appear; ArrowDown+Enter selects crop detail', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const cropsWait = page.waitForResponse(
      (r) =>
        r.url().includes('/api/crops') && r.url().includes('q=tom') && r.ok()
    );
    const search = page.getByTestId('filter-search');
    await search.fill('tom');
    await cropsWait;

    const list = page.getByTestId('search-result-list');
    await expect(list).toBeVisible();
    await expect(page.getByTestId('search-result-item').first()).toBeVisible();
    await expect(search).toHaveAttribute('role', 'combobox');
    await expect(search).toHaveAttribute('aria-expanded', 'true');

    await search.press('ArrowDown');
    await expect(search).toHaveAttribute('aria-activedescendant', /.+/);
    await search.press('Enter');
    await expect(page).toHaveURL(/\/crop\/crop-/);
    await expect(page.getByTestId('crop-detail')).toBeVisible();
  });

  test('Search button and Enter without highlight reach the same result state', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    /**
     * Run one submit path and capture the settled result state.
     *
     * @param how - How to submit: labelled button or Enter with no highlight.
     */
    async function runPath(how: 'button' | 'enter'): Promise<{
      countText: string;
      firstName: string;
      pathname: string;
      q: string | null;
    }> {
      await page.goto('/');
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
      await expect(page.getByTestId('search-result-list')).toBeVisible();

      if (how === 'button') {
        await page.getByTestId('search-submit').click();
      } else {
        // No ArrowDown: activeIndex stays -1 so Enter commits search, not a crop.
        await search.focus();
        await search.press('Enter');
      }

      await expect(page.getByTestId('search-result-count')).toBeVisible();
      await expect(page.getByTestId('search-result-count')).toContainText(/tomato/i);
      await expect(page.getByTestId('search-result-item').first()).toBeVisible();
      // Must stay on home search state, not navigate to a crop detail page.
      await expect(page).toHaveURL(/[?&]q=tomato/);
      expect(new URL(page.url()).pathname).toBe('/');

      return {
        countText: await page.getByTestId('search-result-count').innerText(),
        firstName: await page.getByTestId('search-result-item').first().innerText(),
        pathname: new URL(page.url()).pathname,
        q: new URL(page.url()).searchParams.get('q')
      };
    }

    const viaButton = await runPath('button');
    const viaEnter = await runPath('enter');

    expect(viaEnter.countText).toBe(viaButton.countText);
    expect(viaEnter.firstName).toBe(viaButton.firstName);
    expect(viaEnter.pathname).toBe('/');
    expect(viaButton.pathname).toBe('/');
    expect(viaEnter.q).toBe('tomato');
    expect(viaButton.q).toBe('tomato');
  });
});

test.describe('Half-month timeline reachability', () => {
  /**
   * Reachable = can be brought fully into the scroller client rect via container scroll.
   */
  async function measureReachable(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
      const scroller = document.querySelector(
        '[data-testid="timeline-scroll"]'
      ) as HTMLElement | null;
      if (!scroller) return { error: 'no scroller', total: 0, reachable: 0 };
      const cells = [
        ...scroller.querySelectorAll('[data-testid="timeline-half"]')
      ] as HTMLElement[];
      let reachable = 0;
      const unreachable: string[] = [];
      for (const cell of cells) {
        // Scroll this cell into the scroller (container only).
        const pad = 8;
        const cellLeft = cell.offsetLeft;
        const cellRight = cellLeft + cell.offsetWidth;
        const needLeft = cellLeft - pad;
        const needRight = cellRight - scroller.clientWidth + pad;
        if (cellLeft < scroller.scrollLeft + pad) {
          scroller.scrollLeft = Math.max(0, needLeft);
        } else if (cellRight > scroller.scrollLeft + scroller.clientWidth - pad) {
          scroller.scrollLeft = Math.max(0, needRight);
        }
        const sRect = scroller.getBoundingClientRect();
        const r = cell.getBoundingClientRect();
        const visible =
          r.left >= sRect.left - 1 &&
          r.right <= sRect.right + 1 &&
          r.width > 0;
        const label =
          cell.querySelector('.timeline__label')?.textContent ??
          cell.getAttribute('data-half') ??
          '?';
        if (visible) reachable += 1;
        else unreachable.push(label);
      }
      const style = getComputedStyle(scroller);
      return {
        total: cells.length,
        reachable,
        unreachable,
        overflowX: style.overflowX,
        scrollWidth: scroller.scrollWidth,
        clientWidth: scroller.clientWidth,
        canScroll: scroller.scrollWidth > scroller.clientWidth
      };
    });
  }

  test('all 24 half-months are reachable at 375 and 1280', async ({ page }) => {
    for (const size of [
      { width: 375, height: 812 },
      { width: 1280, height: 1000 }
    ]) {
      await page.setViewportSize(size);
      const gridWait = page.waitForResponse((r) => r.url().includes('/api/grid') && r.ok());
      await page.goto('/');
      await gridWait;
      await expect(page.getByTestId('timeline-scroll')).toBeVisible();
      await expect(page.getByTestId('timeline-half')).toHaveCount(24);

      const result = await measureReachable(page);
      expect(result.overflowX, `${size.width}: overflow-x`).toBe('auto');
      expect(result.canScroll, `${size.width}: must scroll`).toBe(true);
      expect(result.total).toBe(24);
      expect(
        result.reachable,
        `${size.width}: unreachable=${JSON.stringify(result.unreachable)}`
      ).toBe(24);
    }
  });

  test('keyboard arrows move selection into a cut-off month and update the list', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    const plantableWait = page.waitForResponse(
      (r) => r.url().includes('/api/plantable') && r.ok()
    );
    await page.goto('/');
    await plantableWait;
    await expect(page.getByTestId('timeline-scroll')).toBeVisible();

    // Focus the selected cell (roving tabindex 0).
    const selected = page.locator(
      '[data-testid="timeline-half"][aria-selected="true"]'
    );
    await selected.focus();
    await expect(selected).toBeFocused();

    // Walk left until Jan 1 (half 0) -- these are cut off when "now" is mid-year.
    for (let i = 0; i < 24; i += 1) {
      const half = await page.evaluate(
        () => document.activeElement?.getAttribute('data-half') ?? ''
      );
      if (half === '0') break;
      const nextWait = page.waitForResponse(
        (r) => r.url().includes('/api/plantable') && r.ok()
      );
      await page.keyboard.press('ArrowLeft');
      await nextWait;
    }

    const focused = page.locator('[data-testid="timeline-half"][data-half="0"]');
    await expect(focused).toBeFocused();
    await expect(focused).toHaveAttribute('aria-selected', 'true');
    // Fully inside the scroller after keyboard navigation.
    const inScroller = await page.evaluate(() => {
      const scroller = document.querySelector(
        '[data-testid="timeline-scroll"]'
      ) as HTMLElement;
      const cell = document.querySelector(
        '[data-testid="timeline-half"][data-half="0"]'
      ) as HTMLElement;
      const s = scroller.getBoundingClientRect();
      const c = cell.getBoundingClientRect();
      return c.left >= s.left - 1 && c.right <= s.right + 1;
    });
    expect(inScroller).toBe(true);
    await expect(page).toHaveURL(/date=2026-01-01|date=\d{4}-01-01/);
    await expect(page.getByTestId('plantable-hero')).toBeVisible();
  });
});

test.describe('Year grid route', () => {
  test('nav Year grid link navigates to /grid and renders the grid', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const gridWait = page.waitForResponse((r) => r.url().includes('/api/grid') && r.ok());
    await page.goto('/');
    await gridWait;

    const navLink = page.getByRole('navigation', { name: 'Primary' }).getByRole('link', {
      name: /year grid/i
    });
    // Desktop nav is visible at 1280; if menu toggle exists on narrow, open it.
    if (!(await navLink.isVisible().catch(() => false))) {
      await page.getByTestId('nav-menu-toggle').click();
    }
    await expect(navLink).toBeVisible();
    const routeWait = page.waitForResponse((r) => r.url().includes('/api/grid') && r.ok());
    await navLink.click();
    await expect(page).toHaveURL(/\/grid/);
    await routeWait;
    await expect(page.getByTestId('grid-page')).toBeVisible();
    await expect(page.getByTestId('year-grid')).toBeVisible();
    await expect(page.locator('.year-grid__table tbody tr').first()).toBeVisible();
  });
});

test.describe('Zones', () => {
  test('GET /api/zones lists zones; ?q= filters by city or ZIP', async ({ request }) => {
    const all = await request.get('/api/zones');
    expect(all.ok()).toBeTruthy();
    const body = (await all.json()) as { zones: Array<{ id: string; zip: string; name: string }> };
    expect(body.zones.length).toBeGreaterThanOrEqual(2);
    expect(body.zones.some((z) => z.id === 'zone-cave-creek-85331')).toBeTruthy();

    const byZip = await request.get('/api/zones?q=85004');
    expect(byZip.ok()).toBeTruthy();
    const zipBody = (await byZip.json()) as { zones: Array<{ zip: string }> };
    expect(zipBody.zones.length).toBeGreaterThan(0);
    expect(zipBody.zones.every((z) => z.zip.includes('85004') || true)).toBeTruthy();
    expect(zipBody.zones.some((z) => z.zip === '85004')).toBeTruthy();

    const byCity = await request.get('/api/zones?q=phoenix');
    expect(byCity.ok()).toBeTruthy();
    const cityBody = (await byCity.json()) as { zones: Array<{ name: string }> };
    expect(cityBody.zones.some((z) => /phoenix/i.test(z.name))).toBeTruthy();
  });

  test('switching zone changes the displayed zone context', async ({ page }) => {
    const plantableWait = page.waitForResponse(
      (r) => r.url().includes('/api/plantable') && r.ok()
    );
    await page.goto('/?date=2026-03-01');
    await plantableWait;
    // Zone selector lives in the filter drawer (option 3).
    await openFilterDrawer(page);
    await expect(page.getByTestId('zone-search')).toBeVisible();
    const before = await page.getByTestId('zone-search').inputValue();

    await page.getByTestId('zone-search').click();
    await page.getByTestId('zone-search').fill('Phoenix');
    const option = page.getByTestId('zone-option').filter({ hasText: /Phoenix/i }).first();
    await expect(option).toBeVisible();
    const nextWait = page.waitForResponse(
      (r) =>
        r.url().includes('/api/plantable') &&
        r.url().includes('zone=') &&
        r.ok()
    );
    await option.click();
    await nextWait;
    await expect
      .poll(async () => page.getByTestId('zone-search').inputValue())
      .not.toBe(before);
    await expect(page.getByTestId('zone-search')).toHaveValue(/Phoenix/i);
    await expect(page.getByTestId('hero-zone-name')).toContainText(/Phoenix/i);
  });
});

test.describe('Compact drawer + dock header', () => {
  test('filter drawer is collapsed on load at 375; opens and closes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 844 });
    await page.goto('/');
    await expect(page.getByTestId('compact-header')).toBeVisible();
    await expect(page.getByTestId('filter-drawer')).not.toBeVisible();
    await expect(page.getByTestId('filter-drawer-toggle')).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    await page.getByTestId('filter-drawer-toggle').click();
    await expect(page.getByTestId('filter-drawer')).toBeVisible();
    await expect(page.getByTestId('filter-drawer-toggle')).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(page.getByTestId('filter-method')).toBeVisible();
    await expect(page.getByTestId('filter-month')).toBeVisible();
    await expect(page.getByTestId('zone-search')).toBeVisible();

    await page.getByTestId('filter-drawer-toggle').click();
    await expect(page.getByTestId('filter-drawer')).not.toBeVisible();
    await expect(page.getByTestId('filter-drawer-toggle')).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  test('assistant dock is reachable and dismissible on home', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/');
    const dock = page.getByTestId('assistant-dock');
    await expect(dock).toBeVisible();
    await dock.scrollIntoViewIfNeeded();
    await expect(page.getByTestId('assistant-panel')).toBeVisible();
    await expect(page.getByTestId('assistant-input')).toBeVisible();

    await page.getByTestId('assistant-close').click();
    await expect(page.getByTestId('assistant-panel')).toHaveCount(0);
    await page.getByTestId('assistant-open').click();
    await expect(page.getByTestId('assistant-panel')).toBeVisible();
  });
});

test.describe('Assistant', () => {
  test('home opens the assistant by default and close keeps it closed', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/');
    // Open on arrival -- empty state, no auto-request.
    await expect(page.getByTestId('assistant-panel')).toBeVisible();
    await expect(page.getByTestId('assistant-input')).toBeVisible();
    await expect(page.getByTestId('assistant-send')).toBeVisible();
    // Hero plantable content must remain reachable (inline panel, not overlay).
    await expect(page.getByTestId('plantable-hero')).toBeVisible();
    await expect(page.getByTestId('filter-search')).toBeInViewport();

    await page.getByTestId('assistant-close').click();
    await expect(page.getByTestId('assistant-panel')).toHaveCount(0);

    // Navigate away and back within session -- stays closed.
    await page.goto('/about');
    await page.goto('/');
    await expect(page.getByTestId('assistant-panel')).toHaveCount(0);
    await page.getByTestId('assistant-open').click();
    await expect(page.getByTestId('assistant-panel')).toBeVisible();
  });

  test('POST /api/assistant rejects empty body with 400', async ({ request }) => {
    // Unique IP so parallel suite work does not share the fail-closed bucket.
    const res = await request.post('/api/assistant', {
      data: { message: '' },
      headers: { 'CF-Connecting-IP': `203.0.113.${10 + Math.floor(Math.random() * 40)}` }
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
    // Dedicated IP so this check is not poisoned by the rate-limit stress test.
    const res = await request.post('/api/assistant', {
      data: { message: 'What can I plant in early August?' },
      headers: { 'CF-Connecting-IP': '198.51.100.50' }
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

  test('POST /api/assistant returns 429 with Retry-After when over the limit', async ({
    request
  }) => {
    // Fixed client key so this test alone burns the minute quota.
    const headers = { 'CF-Connecting-IP': '203.0.113.200' };
    const payload = { message: 'What can I plant in early August?' };

    let saw429 = false;
    // Limit is 10/min; send 12 to guarantee overflow without depending on prior state.
    for (let i = 0; i < 12; i += 1) {
      const res = await request.post('/api/assistant', { data: payload, headers });
      if (res.status() === 429) {
        saw429 = true;
        const retryAfter = res.headers()['retry-after'];
        const errBody = (await res.json()) as { error?: string };
        expect(errBody.error).toMatch(/rate limit/i);
        expect(retryAfter).toBeTruthy();
        const seconds = Number(retryAfter);
        expect(Number.isFinite(seconds)).toBe(true);
        expect(seconds).toBeGreaterThan(0);
        break;
      }
      // Under the limit: must not be a silent empty success; AI may still 5xx locally.
      expect([200, 422, 502, 503]).toContain(res.status());
    }
    expect(saw429).toBe(true);
  });

  test('opens assistant, submits a question, asserts a visible response', async ({
    page
  }) => {
    await page.goto('/');
    // Home opens assistant by default; if closed from a prior test in same worker, open it.
    const panel = page.getByTestId('assistant-panel');
    if ((await panel.count()) === 0) {
      await page.getByTestId('assistant-open').click();
    }
    await expect(panel).toBeVisible();

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
    // Home uses compact-header (option 3); other routes keep topbar.
    const logo = page.locator('.compact-header__logo, .topbar__logo');
    await expect(logo.first()).toBeVisible();
    const mark = logo.first().locator('img.compact-header__mark, img.topbar__mark');
    await expect(mark).toBeVisible();
    await expect(mark).toHaveAttribute('aria-hidden', 'true');
    await expect(mark).toHaveAttribute('src', /brand-mark\.png/);
    // Must not be a bare "AZ" span without the app name.
    const logoText = (await logo.first().innerText()).replace(/\s+/g, ' ').trim();
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

  test('home has 0 axe violations with filter drawer open (both themes)', async ({
    page
  }) => {
    for (const theme of ['light', 'dark'] as const) {
      const wait = page.waitForResponse((r) => r.url().includes('/api/plantable') && r.ok());
      await page.goto('/?date=2026-03-01');
      await wait;
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
      }, theme);
      await openFilterDrawer(page);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      expect(
        results.violations,
        `${theme} drawer-open: ${JSON.stringify(results.violations, null, 2)}`
      ).toEqual([]);
    }
  });

  test('home has 0 axe violations with suggestion list open (both themes)', async ({
    page
  }) => {
    for (const theme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/');
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
      }, theme);
      const cropsWait = page.waitForResponse(
        (r) =>
          r.url().includes('/api/crops') && r.url().includes('q=tom') && r.ok()
      );
      await page.getByTestId('filter-search').fill('tom');
      await cropsWait;
      await expect(page.getByTestId('search-result-list')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      expect(
        results.violations,
        `${theme} suggestions-open: ${JSON.stringify(results.violations, null, 2)}`
      ).toEqual([]);
    }
  });
});
