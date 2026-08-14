import { defineWorkspace } from 'vitest/config';

/** VRT specs: layout checks at the project viewports. */
const vrtPattern = '**/*.{vrt,visual}.test.{ts,tsx}';

/**
 * Three named lanes, in the WORKSPACE file rather than a `test.projects` block.
 * vitest is pinned at 2.x here, which reads this file and silently ignores a
 * `projects` key in vitest.config.ts — that inert key is what left every
 * scaffolded app running its Playwright specs and DOM tests in the node
 * environment. Named lanes also mean a failure says WHICH lane failed, so
 * "tests passed" can never mean "unit passed and nobody ran the rest".
 */
export default defineWorkspace([
  {
    test: {
      name: 'unit',
      environment: 'node',
      include: ['src/**/*.test.ts', 'functions/**/*.test.ts'],
      exclude: ['**/*.browser.test.ts', vrtPattern, 'tests/**', 'node_modules/**', 'dist/**']
    }
  },
  {
    test: {
      name: 'browser',
      // Real-DOM behaviour jsdom fakes badly: focus order, scroll containers,
      // and measured box geometry.
      browser: {
        enabled: true,
        headless: true,
        provider: 'playwright',
        name: 'chromium',
        instances: [{ browser: 'chromium' }]
      },
      include: ['**/*.browser.test.ts'],
      exclude: ['tests/**', 'node_modules/**', 'dist/**']
    }
  },
  {
    test: {
      name: 'vrt',
      browser: {
        enabled: true,
        headless: true,
        provider: 'playwright',
        name: 'chromium',
        instances: [
          { browser: 'chromium', viewport: { width: 375, height: 900 } },
          { browser: 'chromium', viewport: { width: 1280, height: 900 } }
        ]
      },
      include: [vrtPattern],
      exclude: ['tests/**', 'node_modules/**', 'dist/**']
    }
  }
]);
