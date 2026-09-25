import { defineConfig } from 'vitest/config';

/**
 * Root vitest config: coverage only. The unit, browser and vrt lanes are
 * defined in vitest.workspace.ts, which vitest 2.x reads in place of a
 * `test.projects` block here.
 */
export default defineConfig({
  test: {
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
      exclude: ['**/*.test.ts', '**/*.browser.test.tsx', '**/*.vrt.test.tsx']
    }
  }
});
