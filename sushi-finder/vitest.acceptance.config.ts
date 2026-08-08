import { defineConfig } from 'vitest/config';

/**
 * PRD-derived acceptance tests. Require a local Pages serve on BASE_URL
 * (default http://127.0.0.1:8788).
 */
export default defineConfig({
  test: {
    include: ['test/acceptance/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    sequence: { concurrent: false }
  }
});
