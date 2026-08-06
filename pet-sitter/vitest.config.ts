import { defineConfig } from 'vitest/config';

/**
 * Root vitest config: coverage + workspace projects (unit / browser / vrt).
 * Projects live in vitest.workspace.ts so each lane can fail independently.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/lib/**', 'src/hooks/**', 'functions/lib/**'],
      exclude: [
        '**/*.test.ts',
        '**/*.browser.test.ts',
        '**/*.{vrt,visual}.test.ts',
        // fetch wrappers are covered by Playwright acceptance + u-api-real-output
        'src/lib/api.ts'
      ]
    }
  }
});
