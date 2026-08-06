import { test, expect } from '@playwright/test';

/**
 * Scaffold placeholder for the Terms page.
 *
 * Intentionally FAILS until replaced with a real acceptance assertion.
 * Do not delete this file to go green — rewrite it to prove the page works.
 */
test('Terms page — scaffold placeholder (must be replaced)', async ({ page }) => {
  await page.goto('/terms');
  await expect(page.getByRole('heading').first()).toBeVisible();
  // REDANVIL_ACCEPTANCE_PLACEHOLDER: this marker is not on the page. The
  // test fails on purpose so an empty scaffold cannot claim acceptance.
  await expect(
    page.getByText('REDANVIL_ACCEPTANCE_PLACEHOLDER_TERMS'),
    'Replace this placeholder: write a real acceptance assertion for Terms'
  ).toBeVisible();
});
