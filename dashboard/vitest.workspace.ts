import { defineWorkspace } from 'vitest/config';

/**
 * The three vitest lanes u-test-runners runs one at a time, so a green unit
 * lane cannot hide a red browser or VRT lane.
 *
 * Lanes live here, not under `test.projects` in vitest.config.ts: the pinned
 * vitest is 2.x, which ignores that key without a warning. vitest.config.ts
 * keeps the root-level coverage options.
 *
 * `browser.name` + `browser.viewport` are the 2.x keys. The 3.x `instances`
 * list is ignored by 2.1.9, so the VRT specs set 375 / 1280 themselves.
 */
const browserLane = {
  enabled: true,
  headless: true,
  provider: 'playwright',
  name: 'chromium'
} as const;

/**
 * Pre-bundled up front: discovered mid-run, vite re-optimises and reloads the
 * test page, which vitest warns can duplicate or flake a run.
 */
const optimizeDeps = {
  include: ['react', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client', 'react-router-dom']
};

const vrtPattern = 'src/**/*.vrt.test.ts';
const browserPattern = 'src/**/*.browser.test.ts';

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
    optimizeDeps,
    test: {
      name: 'browser',
      // Real focus order and keyboard activation, which a node renderer fakes.
      browser: browserLane,
      include: [browserPattern]
    }
  },
  {
    optimizeDeps,
    test: {
      name: 'vrt',
      // Pixel comparison against committed baselines; see src/test-support/screenshotMatch.ts.
      browser: browserLane,
      include: [vrtPattern]
    }
  }
]);
