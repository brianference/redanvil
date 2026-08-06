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
      // functions/** are exercised by Playwright + wrangler runtime parity, not
      // V8 unit coverage. Including them without Worker unit tests tanks the
      // ratchet against a prior high-water measured on lib-only scope.
      include: ['src/lib/**', 'src/hooks/**'],
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
