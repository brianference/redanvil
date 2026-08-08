import { defineConfig } from 'vitest/config';

/**
 * Unit tests under src/ and functions/.
 * Acceptance tests (Playwright) use vitest.acceptance.config.ts.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'functions/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'test'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/lib/**', 'src/theme.ts', 'functions/**'],
      exclude: ['**/*.test.ts']
    }
  }
});
