import { defineConfig, devices } from '@playwright/test';

/**
 * Acceptance tests for the app builder (R27).
 *
 * `BASE_URL` targets a deployment; otherwise these run against a local preview.
 * One fresh page per test — a shared page lets one step's state decide another
 * step's result, which produces confident, wrong failures.
 */
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:4325';

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
        // `wrangler pages dev`, not `vite preview`. vite serves the static build
        // and nothing under functions/, so /api/submit 404s and the Forge PRD
        // step — the app's whole purpose — cannot complete. That failure was
        // invisible while the suite died on startup (vite bound ::1 while `url`
        // below polls 127.0.0.1, so readiness never arrived and every run ended
        // in a 120s webServer timeout with zero tests executed).
        //
        // This is lg-runtime-parity applied to the acceptance suite: a passing
        // run against static assets does not prove the Worker runs.
        command: 'npx wrangler pages dev dist --port 4325 --ip 127.0.0.1',
        url: 'http://127.0.0.1:4325/',
        reuseExistingServer: true,
        timeout: 120_000
      }
});
