import { defineConfig, devices } from '@playwright/test';

/**
 * Acceptance tests against wrangler pages dev (Pages Functions + D1).
 * vite preview does not serve Functions and may bind ::1 only.
 */
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:8788';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } }
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' }
    }
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command:
          'npx wrangler d1 migrations apply az-planting-calendar --local && npx wrangler pages dev dist --port 8788 --ip 127.0.0.1',
        url: 'http://127.0.0.1:8788/api/health',
        reuseExistingServer: true,
        timeout: 180_000
      }
});
