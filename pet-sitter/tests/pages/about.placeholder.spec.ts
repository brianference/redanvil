import { test, expect } from '@playwright/test';

/**
 * Scaffold placeholder for the About page.
 *
 * Intentionally FAILS until replaced with a real acceptance assertion.
 * Do not delete this file to go green — rewrite it to prove the page works.
 */
test('About page — scaffold placeholder (must be replaced)', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading').first()).toBeVisible();
  // REDANVIL_ACCEPTANCE_PLACEHOLDER: this marker is not on the page. The
  // test fails on purpose so an empty scaffold cannot claim acceptance.
  await expect(
    page.getByText('REDANVIL_ACCEPTANCE_PLACEHOLDER_ABOUT'),
    'Replace this placeholder: write a real acceptance assertion for About'
  ).toBeVisible();
});
