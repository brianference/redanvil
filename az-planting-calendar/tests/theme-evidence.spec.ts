import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../evidence/screenshots'
);

const viewports = [
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 }
] as const;

/**
 * Capture theme proof screenshots and assert toggle + hero inversion.
 * Saves under evidence/screenshots/ for human review.
 */
test.describe('Theme evidence (screenshots)', () => {
  test('toggle is visible; hero inverts; screenshots for light and dark', async ({
    page
  }) => {
    // Desktop-ish project still resizes; we set viewport explicitly per shot.
    const plantableWait = page.waitForResponse(
      (r) => r.url().includes('/api/plantable') && r.url().includes('2026-03-01') && r.ok()
    );
    await page.goto('/?date=2026-03-01');
    await plantableWait;

    const toggle = page.getByTestId('theme-toggle');
    await expect(toggle).toBeVisible();
    const box = await toggle.boundingBox();
    expect(box, 'theme toggle must have a box').not.toBeNull();
    expect(box!.width, 'hit area width >= 44').toBeGreaterThanOrEqual(44);
    expect(box!.height, 'hit area height >= 44').toBeGreaterThanOrEqual(44);

    // Force light: cycle until data-theme-mode=light (system → light → dark → system)
    await forceThemeMode(page, 'light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem('theme')))
      .toBe('light');

    const lightHero = await samplePaintedSurface(page, 'half-month-timeline');
    expect(
      lightHero.dark,
      `light hero should not be near-black, got luma=${lightHero.luma} from ${lightHero.css}`
    ).toBe(false);

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await expect(toggle).toBeVisible();
      await page.screenshot({
        path: path.join(evidenceDir, `theme-light-${vp.name}.png`),
        fullPage: false
      });
    }

    await forceThemeMode(page, 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem('theme')))
      .toBe('dark');

    const darkHero = await samplePaintedSurface(page, 'half-month-timeline');
    expect(
      darkHero.dark,
      `dark hero should be dark, got luma=${darkHero.luma} from ${darkHero.css}`
    ).toBe(true);
    expect(lightHero.css).not.toBe(darkHero.css);
    expect(lightHero.luma).not.toBe(darkHero.luma);

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await expect(toggle).toBeVisible();
      await page.screenshot({
        path: path.join(evidenceDir, `theme-dark-${vp.name}.png`),
        fullPage: false
      });
    }

    // System still reachable and persisted
    await forceThemeMode(page, 'system');
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem('theme')))
      .toBe('system');
  });
});

/**
 * Click the theme control until data-theme-mode matches the target.
 *
 * @param page - Playwright page.
 * @param mode - Desired stored mode.
 */
async function forceThemeMode(
  page: import('@playwright/test').Page,
  mode: 'light' | 'dark' | 'system'
): Promise<void> {
  const toggle = page.getByTestId('theme-toggle');
  for (let i = 0; i < 4; i += 1) {
    const current = await toggle.getAttribute('data-theme-mode');
    if (current === mode) return;
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute('data-theme-mode', mode);
}

/**
 * Sample a painted surface by letting the browser engine resolve its background
 * colour to sRGB bytes via canvas (handles hex, rgb(), rgba(), color(srgb...),
 * color-mix(), named colours). Never hand-parses CSS colour strings.
 *
 * @param page - Playwright page.
 * @param testId - data-testid of the element to sample.
 */
async function samplePaintedSurface(
  page: import('@playwright/test').Page,
  testId: string
): Promise<{ dark: boolean; css: string; r: number; g: number; b: number; luma: number }> {
  return page.getByTestId(testId).evaluate((el) => {
    const css = getComputedStyle(el).backgroundColor;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('2d canvas context unavailable');
    }
    // Sentinel so a failed fillStyle assignment is detectable (engine keeps prior style).
    ctx.fillStyle = 'rgb(1, 2, 3)';
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    // Luma on engine-resolved sRGB bytes (not a regex over the CSS string).
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // Light hero (~#f4f6f8) is high; dark hero (~#06090c) is low.
    return { dark: luma < 40, css, r, g, b, luma };
  });
}
