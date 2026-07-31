import { defineConfig } from 'vitest/config';

/** Vitest unit tests for src and functions (node env). */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'functions/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      // json-summary writes coverage/coverage-summary.json, which u-test-presence
      // and u-test-coverage-ratchet read.
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      // Not 'src/**': components and pages are Playwright's surface and vitest's
      // V8 provider cannot see a browser it did not launch, so including them
      // would report 0% for files that are in fact tested.
      include: ['src/lib/**', 'src/hooks/**', 'functions/**'],
      exclude: ['**/*.test.ts']
    }
  }
});
