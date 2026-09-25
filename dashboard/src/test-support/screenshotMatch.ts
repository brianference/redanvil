import { commands, page, server } from '@vitest/browser/context';

/**
 * Visual regression for the VRT lane.
 *
 * The pinned vitest 2.1.9 and @vitest/browser 2.1.9 ship no screenshot
 * matcher (neither package contains `toHaveScreenshot` or `toMatchScreenshot`), and the
 * scaffold's placeholder asserted on the DOM instead of on pixels. This takes a
 * real element screenshot through Playwright and compares it pixel by pixel to
 * a committed baseline, so a visual change fails the lane.
 *
 * Baselines are per platform: system fonts rasterise differently on Windows
 * and Linux, and a baseline that only matches one OS would be a false failure
 * on the other. A missing baseline FAILS; it is never written implicitly.
 * Record one on purpose with `vitest run --project vrt -u`, then open the PNG.
 */

/** A channel may drift this much (0-255) before the pixel counts as changed. Absorbs AA noise. */
const CHANNEL_TOLERANCE = 8;
/**
 * Pixels allowed past CHANNEL_TOLERANCE. Zero, on purpose: a 0.1% ratio let a
 * changed score digit (0 -> 7) through, which is exactly the regression this
 * lane exists to catch. Headless Chromium rasterises identically run to run.
 */
const MAX_CHANGED_PIXELS = 0;

/** Bound on decoding a PNG through fetch, ms. A data: URL resolves locally; this keeps it explicit. */
const DECODE_TIMEOUT_MS = 10_000;

/** Decoded RGBA pixels of one PNG. */
interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * Decode a base64 PNG into RGBA pixels in the browser.
 *
 * @param base64 - PNG bytes, base64-encoded.
 * @returns Width, height and pixel data.
 */
async function decodePng(base64: string): Promise<Pixels> {
  const res = await fetch(`data:image/png;base64,${base64}`, {
    signal: AbortSignal.timeout(DECODE_TIMEOUT_MS)
  });
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('screenshotMatch: no 2d canvas context');
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return { width: bitmap.width, height: bitmap.height, data };
}

/**
 * Count pixels whose largest channel difference exceeds CHANNEL_TOLERANCE.
 *
 * @param actual - Pixels just captured.
 * @param baseline - Committed pixels.
 * @returns Number of changed pixels.
 */
function changedPixels(actual: Pixels, baseline: Pixels): number {
  let changed = 0;
  for (let i = 0; i < actual.data.length; i += 4) {
    for (let channel = 0; channel < 4; channel += 1) {
      const a = actual.data[i + channel] ?? 0;
      const b = baseline.data[i + channel] ?? 0;
      if (Math.abs(a - b) > CHANNEL_TOLERANCE) {
        changed += 1;
        break;
      }
    }
  }
  return changed;
}

/**
 * Screenshot `element` and fail unless it matches the committed baseline.
 *
 * @param element - Element to capture.
 * @param name - Baseline name, unique within the calling test file.
 */
export async function expectScreenshotToMatch(element: Element, name: string): Promise<void> {
  const baselinePath = `__vrt__/${name}-${server.platform}.png`;
  const actualPath = `__screenshots__/${name}-${server.platform}.actual.png`;
  const shot = await page.screenshot({ element, path: actualPath, base64: true });

  if (server.config.snapshotOptions.updateSnapshot === 'all') {
    await commands.writeFile(baselinePath, shot.base64, 'base64');
    await commands.removeFile(actualPath);
    return;
  }

  let baselineBase64: string;
  try {
    baselineBase64 = await commands.readFile(baselinePath, 'base64');
  } catch (_err: unknown) {
    throw new Error(
      `VRT: no baseline at ${baselinePath}. Record it with \`vitest run --project vrt -u\` ` +
        `and open the PNG before committing it. Captured: ${actualPath}`
    );
  }

  const [actual, baseline] = await Promise.all([decodePng(shot.base64), decodePng(baselineBase64)]);
  if (actual.width !== baseline.width || actual.height !== baseline.height) {
    throw new Error(
      `VRT ${name}: size ${actual.width}x${actual.height} != baseline ` +
        `${baseline.width}x${baseline.height}. Captured: ${actualPath}`
    );
  }
  const changed = changedPixels(actual, baseline);
  if (changed > MAX_CHANGED_PIXELS) {
    throw new Error(
      `VRT ${name}: ${changed} pixels differ from ` + `${baselinePath}. Captured: ${actualPath}`
    );
  }
  await commands.removeFile(actualPath);
}
