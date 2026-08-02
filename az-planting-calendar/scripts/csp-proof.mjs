/**
 * Load the local app with CSP applied, capture console + CSP violations,
 * and write a 1280 screenshot. Exit non-zero if CSP or page errors appear.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'evidence', 'screenshots');
mkdirSync(outDir, { recursive: true });
const screenshotPath = join(outDir, 'csp-proof-1280.png');
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:8788';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

/** @type {{ type: string, text: string }[]} */
const consoleMsgs = [];
/** @type {string[]} */
const pageErrors = [];

page.on('console', (msg) => {
  consoleMsgs.push({ type: msg.type(), text: msg.text() });
});
page.on('pageerror', (err) => {
  pageErrors.push(String(err));
});

await page.addInitScript(() => {
  // @ts-expect-error injected
  window.__cspViolations = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    // @ts-expect-error injected
    window.__cspViolations.push({
      violatedDirective: e.violatedDirective,
      blockedURI: e.blockedURI,
      effectiveDirective: e.effectiveDirective,
      disposition: e.disposition
    });
  });
});

const nav = await page.goto(baseURL + '/', { waitUntil: 'networkidle', timeout: 60_000 });
const headers = nav ? nav.headers() : {};

await page.waitForSelector('[data-testid="plantable-hero"]', { timeout: 30_000 });
await page.waitForSelector('[data-testid="year-grid"]', { timeout: 30_000 });
// Let late console noise settle.
await page.waitForTimeout(1500);

const cspViolations = await page.evaluate(() => {
  // @ts-expect-error injected
  return window.__cspViolations ?? [];
});

const title = await page.title();
const heroVisible = await page.locator('[data-testid="plantable-hero"]').isVisible();
const gridVisible = await page.locator('[data-testid="year-grid"]').isVisible();

await page.screenshot({ path: screenshotPath, fullPage: false });

const cspRelatedConsole = consoleMsgs.filter((m) =>
  /content security policy|refused to|csp/i.test(m.text)
);
const consoleErrors = consoleMsgs.filter((m) => m.type === 'error');

const report = {
  baseURL,
  title,
  heroVisible,
  gridVisible,
  screenshot: screenshotPath,
  securityHeaders: {
    'content-security-policy': headers['content-security-policy'] ?? null,
    'strict-transport-security': headers['strict-transport-security'] ?? null,
    'x-frame-options': headers['x-frame-options'] ?? null,
    'permissions-policy': headers['permissions-policy'] ?? null,
    'x-content-type-options': headers['x-content-type-options'] ?? null,
    'referrer-policy': headers['referrer-policy'] ?? null
  },
  cspViolations,
  pageErrors,
  consoleErrors,
  cspRelatedConsole,
  allConsole: consoleMsgs
};

console.log(JSON.stringify(report, null, 2));

await browser.close();

const failed =
  cspViolations.length > 0 ||
  pageErrors.length > 0 ||
  consoleErrors.length > 0 ||
  cspRelatedConsole.length > 0 ||
  !heroVisible ||
  !gridVisible ||
  !headers['content-security-policy'];

if (failed) {
  process.exit(1);
}
