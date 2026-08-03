import { defineConfig } from 'vitest/config';

/**
 * Unit tests under src/ and functions/. Playwright specs in tests/ run only via
 * `npx playwright test`.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'functions/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'tests'],
    coverage: {
      provider: 'v8',
      // json-summary writes coverage/coverage-summary.json, which u-test-presence
      // and u-test-coverage-ratchet read.
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      // Not 'src/**': components and pages are Playwright's surface and vitest's
      // V8 provider cannot see a browser it did not launch, so including them
      // would report 0% for files that are in fact tested.
      include: ['src/lib/**', 'src/theme.ts', 'functions/**'],
      exclude: ['**/*.test.ts']
    }
  }
});
