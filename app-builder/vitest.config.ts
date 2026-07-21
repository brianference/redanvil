import { defineConfig } from 'vitest/config';

/** Vitest unit tests for src and functions (node env). */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'functions/**/*.test.ts'],
    environment: 'node'
  }
});
