import { defineConfig } from 'vitest/config';

/** Vitest unit tests for src (node env). */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
});
