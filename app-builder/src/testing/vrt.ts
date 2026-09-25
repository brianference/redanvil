/**
 * Browser-side half of the VRT lane: capture, decode, and pixel-compare.
 *
 * This is the lane's toHaveScreenshot. vitest 2.1.9 ships `page.screenshot()`
 * but no baseline matcher, so the comparison is done here on a canvas against
 * the committed baseline the vrtBaseline command returns.
 */
import { commands, page } from '@vitest/browser/context';
import type { VrtBaselineResult } from '../../test-support/vrtCommands';

declare module '@vitest/browser/context' {
  interface BrowserCommands {
    vrtBaseline: (name: string, actualBase64: string) => Promise<VrtBaselineResult>;
  }
}

/**
 * A channel may drift by this much (of 255) before the pixel counts as changed.
 * Absorbs sub-pixel anti-aliasing jitter; a colour or token change moves far more.
 */
const CHANNEL_TOLERANCE = 16;

/**
 * Share of pixels allowed to change. 0.1% of a 1280x400 capture is ~500 pixels:
 * less than one word re-flowing, far less than a changed colour, border or gap.
 */
const MAX_CHANGED_RATIO = 0.001;

/** RGBA channels per pixel in ImageData. */
const CHANNELS = 4;

/**
 * Decode a base64 PNG into raw RGBA pixels.
 *
 * @param base64 - PNG bytes, base64-encoded.
 * @returns Decoded pixels.
 */
async function decodePng(base64: string): Promise<ImageData> {
  // Decoded in place rather than fetched from a data: URL: nothing leaves the
  // page, so there is no request that needs a timeout.
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'image/png' });
  const bitmap = await createImageBitmap(blob, {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none'
  });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) throw new Error('VRT: 2d canvas context unavailable');
  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, bitmap.width, bitmap.height);
}

/**
 * Count pixels whose largest channel difference exceeds CHANNEL_TOLERANCE.
 *
 * @param actual - Captured pixels.
 * @param expected - Baseline pixels of the same size.
 * @returns Number of changed pixels.
 */
function countChangedPixels(actual: ImageData, expected: ImageData): number {
  let changed = 0;
  for (let i = 0; i < actual.data.length; i += CHANNELS) {
    for (let c = 0; c < CHANNELS; c += 1) {
      const delta = Math.abs((actual.data[i + c] ?? 0) - (expected.data[i + c] ?? 0));
      if (delta > CHANNEL_TOLERANCE) {
        changed += 1;
        break;
      }
    }
  }
  return changed;
}

/**
 * Screenshot an element and fail unless it matches its committed baseline.
 *
 * @param element - The rendered component root.
 * @param name - Baseline slug, unique per component, viewport and theme.
 * @throws Error when the baseline is missing, differs in size, or too many pixels changed.
 */
export async function expectToMatchBaseline(element: Element, name: string): Promise<void> {
  await document.fonts.ready;
  const shot = await page.screenshot({ element, base64: true });
  const baseline = await commands.vrtBaseline(name, shot.base64);
  if (baseline.status === 'recorded') return;
  if (baseline.status === 'missing') {
    throw new Error(
      `VRT: no baseline at ${baseline.path}. Record it with VRT_UPDATE=1 npm run test:vrt, ` +
        `then open the PNG and check it before committing.`
    );
  }
  const [actual, expected] = await Promise.all([decodePng(shot.base64), decodePng(baseline.baseline)]);
  if (actual.width !== expected.width || actual.height !== expected.height) {
    throw new Error(
      `VRT ${name}: size ${actual.width}x${actual.height} differs from baseline ` +
        `${expected.width}x${expected.height} (actual saved at ${shot.path})`
    );
  }
  const changed = countChangedPixels(actual, expected);
  const ratio = changed / (actual.width * actual.height);
  if (ratio > MAX_CHANGED_RATIO) {
    throw new Error(
      `VRT ${name}: ${changed} pixels (${(ratio * 100).toFixed(2)}%) differ from ${baseline.path} ` +
        `(actual saved at ${shot.path})`
    );
  }
}
