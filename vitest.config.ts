import { defineConfig } from 'vitest/config';

/**
 * The gate's own test suite.
 *
 * Scoped to `orchestrator/test/` deliberately. The previous include was
 * `**\/test/**\/*.test.ts`, which reached past every subproject's own config and
 * adopted sushi-finder's Playwright acceptance suite into this lane — a suite
 * that requires a Pages serve on 127.0.0.1:8788 which this lane never starts.
 * CI failed on it for five days while the reported error named the wrong cause.
 *
 * A subproject's vitest config constrains only runs launched from that
 * subproject, so isolation there does not protect it from a broad root glob.
 * Adding a new app must not silently enlist its tests here; app suites get their
 * own CI lane, with whatever server they need actually running.
 */
export default defineConfig({
  test: { include: ['orchestrator/test/**/*.test.ts'], environment: 'node' }
});
