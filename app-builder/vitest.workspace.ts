import { fileURLToPath } from 'node:url';
import { defineWorkspace } from 'vitest/config';
import { vrtBaseline } from './test-support/vrtCommands';

/**
 * Three vitest lanes, each runnable alone so u-test-runners can fail one
 * without a green lane hiding it.
 *
 * Lanes live here and not under `test.projects` in vitest.config.ts: that is a
 * vitest 3 key, and the pinned 2.1.9 ignores it without a warning.
 */

/** Real-browser behaviour jsdom fakes: focus, keyboard, the drawer trap. */
const browserPattern = 'src/**/*.browser.test.{ts,tsx}';
/** Pixel comparison against committed per-platform baselines. */
const vrtPattern = 'src/**/*.vrt.test.{ts,tsx}';
/** Tall enough that no component under test is clipped by the frame. */
const FRAME_HEIGHT = 900;

export default defineWorkspace([
  {
    test: {
      name: 'unit',
      environment: 'node',
      include: ['src/**/*.test.ts', 'functions/**/*.test.ts'],
      exclude: [browserPattern, vrtPattern, 'tests/**', 'node_modules/**', 'dist/**']
    }
  },
  {
    extends: './vite.config.ts',
    test: {
      name: 'browser',
      include: [browserPattern],
      browser: {
        enabled: true,
        headless: true,
        provider: 'playwright',
        name: 'chromium',
        viewport: { width: 375, height: FRAME_HEIGHT },
        screenshotFailures: false
      }
    }
  },
  {
    extends: './vite.config.ts',
    test: {
      name: 'vrt',
      include: [vrtPattern],
      browser: {
        enabled: true,
        headless: true,
        provider: 'playwright',
        name: 'chromium',
        viewport: { width: 1280, height: FRAME_HEIGHT },
        screenshotFailures: false,
        // Captures go to a gitignored folder, never next to the test in src/.
        screenshotDirectory: fileURLToPath(new URL('./.vrt-output', import.meta.url)),
        commands: { vrtBaseline }
      }
    }
  }
]);
