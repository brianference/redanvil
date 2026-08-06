import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'functions/**/*.test.ts'],
    exclude: ['tests/**', 'node_modules/**', 'dist/**'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      // json-summary is what writes coverage/coverage-summary.json, which is
      // the file u-test-presence and u-test-coverage-ratchet read. Removing
      // it leaves both rules with nothing to measure.
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      // Deliberately NOT 'src/**'. Components and pages are exercised by
      // Playwright, and vitest's V8 provider cannot see a browser it did not
      // launch -- including them reports 0% for files that are in fact tested
      // and turns the gate into a false-positive machine. That surface is
      // owned by u-test-acceptance and u-test-feature-audit instead. Widen
      // this only alongside merged Playwright coverage.
      include: ['src/lib/**', 'src/hooks/**', 'functions/**'],
      exclude: ['**/*.test.ts']
    }
  }
});
