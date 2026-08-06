import { defineConfig, devices } from '@playwright/test';

/**
 * Acceptance tests run against a real server (R27).
 * BASE_URL targets a deployment; otherwise a local preview is started.
 */
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } }
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npx vite preview --port 4173 --strictPort',
        url: 'http://127.0.0.1:4173/',
        reuseExistingServer: true,
        timeout: 120_000
      }
});
