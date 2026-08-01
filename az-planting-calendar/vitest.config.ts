import { defineConfig } from 'vitest/config';

/**
 * Unit tests under src/ and functions/. Playwright specs in tests/ run only via
 * `npx playwright test`.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'functions/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'tests']
  }
});
