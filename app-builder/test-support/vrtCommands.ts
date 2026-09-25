/**
 * Node-side half of the VRT lane: owns the committed baseline files.
 *
 * Decoding and pixel comparison happen in the browser (canvas), so the lane
 * needs no image library. This command only reads or writes PNG bytes.
 *
 * Baselines are per platform (`<name>-<platform>.png`) because text rasterises
 * differently on Windows, macOS and Linux; comparing across them would either
 * fail every time or need a tolerance loose enough to hide real regressions.
 * They live under a `screenshots/` directory outside src/, which is where
 * hyg-no-binaries allows committed images.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { BrowserCommand } from 'vitest/node';

/** Committed baselines, relative to the app root. */
const BASELINE_DIR = join('test-support', 'screenshots');

/** Set to 1 to record (or re-record) baselines instead of comparing. */
const UPDATE_ENV = 'VRT_UPDATE';

/** Screenshot names are code-chosen slugs; refuse anything that could escape the directory. */
const SAFE_NAME = /^[a-z0-9][a-z0-9-]{0,80}$/;

/** What the browser should do next with its screenshot. */
export type VrtBaselineResult =
  | { status: 'recorded'; path: string }
  | { status: 'missing'; path: string }
  | { status: 'compare'; path: string; baseline: string };

/**
 * Resolve, record, or return the committed baseline for one screenshot.
 *
 * @param ctx - Vitest browser command context (supplies the project root).
 * @param name - Screenshot slug, e.g. `stack-references-375-light`.
 * @param actualBase64 - The PNG the browser just captured, base64-encoded.
 * @returns `recorded` in update mode, `missing` when no baseline exists, else the baseline bytes.
 */
export const vrtBaseline: BrowserCommand<[name: string, actualBase64: string]> = (
  ctx,
  name,
  actualBase64
): VrtBaselineResult => {
  if (!SAFE_NAME.test(name)) throw new Error(`unsafe VRT screenshot name: ${name}`);
  const path = join(ctx.project.config.root, BASELINE_DIR, `${name}-${process.platform}.png`);
  if (process.env[UPDATE_ENV] === '1') {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(actualBase64, 'base64'));
    return { status: 'recorded', path };
  }
  if (!existsSync(path)) return { status: 'missing', path };
  return { status: 'compare', path, baseline: readFileSync(path).toString('base64') };
};
