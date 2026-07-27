import { defineConfig, devices } from '@playwright/test';

/**
 * Acceptance tests for the dashboard (R27).
 *
 * `BASE_URL` targets a deployment; otherwise these run against a local preview.
 * One fresh page per test — a shared page lets one step's state decide another
 * step's result, which produces confident, wrong failures.
 */
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:4326';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 40_000,
  expect: { timeout: 10_000 },
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } }
    }
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npx vite preview --port 4326 --strictPort',
        url: 'http://127.0.0.1:4326/',
        reuseExistingServer: true,
        timeout: 120_000
      }
});
