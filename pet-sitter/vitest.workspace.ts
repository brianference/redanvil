import { defineWorkspace } from 'vitest/config';

/**
 * Independent vitest lanes for u-test-runners (unit / browser / vrt).
 * Playwright acceptance stays under tests/ and is not swallowed here.
 */
export default defineWorkspace([
  {
    test: {
      name: 'unit',
      environment: 'node',
      include: ['src/**/*.test.ts', 'functions/**/*.test.ts'],
      exclude: [
        '**/*.browser.test.ts',
        '**/*.{vrt,visual}.test.{ts,tsx}',
        'tests/**',
        'node_modules/**',
        'dist/**'
      ]
    }
  },
  {
    test: {
      name: 'browser',
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
      include: ['**/*.{vrt,visual}.test.{ts,tsx}'],
      exclude: ['tests/**', 'node_modules/**', 'dist/**']
    }
  }
]);
