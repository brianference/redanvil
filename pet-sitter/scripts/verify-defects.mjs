/**
 * Measure theme cold-start + assistant POST + error state + axe contrast.
 * Usage: node scripts/verify-defects.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? 'http://127.0.0.1:8788';
const outDir = join(__dir, '..', 'evidence', 'defect-verify');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const results = {};

// --- 1. Theme probe: OS emulation, localStorage untouched ---
for (const scheme of ['dark', 'light']) {
  const ctx = await browser.newContext({ colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60_000 });
  const r = await page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    bgVar: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
    stored: localStorage.getItem('theme')
  }));
  console.log(`OS=${scheme}: data-theme=${r.attr} --bg=${r.bgVar} stored=${r.stored}`);
  results[`theme_${scheme}`] = r;
  await ctx.close();
}

// stored light + OS dark
{
  const ctx = await browser.newContext({ colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'light');
  });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60_000 });
  const r = await page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    bgVar: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
    stored: localStorage.getItem('theme')
  }));
  console.log(
    `stored 'light' + OS dark: data-theme=${r.attr} --bg=${r.bgVar} stored=${r.stored}`
  );
  results.theme_stored_light_os_dark = r;
  await ctx.close();
}

// toggle + persist
{
  const ctx = await browser.newContext({ colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60_000 });
  const before = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme')
  );
  await page.getByTestId('theme-toggle').click();
  const afterClick = await page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    stored: localStorage.getItem('theme')
  }));
  await page.reload({ waitUntil: 'networkidle' });
  const afterReload = await page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    stored: localStorage.getItem('theme')
  }));
  console.log(
    `toggle: before=${before} afterClick=${JSON.stringify(afterClick)} afterReload=${JSON.stringify(afterReload)}`
  );
  results.toggle = { before, afterClick, afterReload };
  await ctx.close();
}

// --- 2. Assistant network ---
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const api = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/')) {
      api.push(`${req.method()} ${new URL(req.url()).pathname}`);
    }
  });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page
    .getByRole('button', { name: /open the sitters assistant|ask about sitters/i })
    .click();
  await page.getByTestId('assistant-input').fill('who sits for cats?');
  const postWait = page.waitForResponse(
    (r) => r.url().includes('/api/assistant') && r.request().method() === 'POST',
    { timeout: 60_000 }
  );
  await page.getByTestId('assistant-submit').click();
  const res = await postWait;
  await page.waitForSelector(
    '[data-testid=assistant-answer], [data-testid=assistant-error]',
    { timeout: 60_000 }
  );
  const answer = await page
    .locator('[data-testid=assistant-answer]')
    .textContent()
    .catch(() => null);
  const error = await page
    .locator('[data-testid=assistant-error]')
    .textContent()
    .catch(() => null);
  console.log('ASSISTANT API calls:', JSON.stringify(api));
  console.log('POST status', res.status());
  console.log('answer snippet:', (answer || error || '').slice(0, 300));
  results.assistant = {
    api,
    status: res.status(),
    answer: answer?.slice(0, 400) ?? null,
    error
  };
  await page.screenshot({ path: join(outDir, 'assistant-success.png'), fullPage: true });
  await ctx.close();
}

// --- 3. Error state: failing URL ---
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route('**/api/assistant', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'The assistant model failed. Try again in a moment.'
      })
    });
  });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page
    .getByRole('button', { name: /open the sitters assistant|ask about sitters/i })
    .click();
  await page.getByTestId('assistant-input').fill('who sits for cats?');
  await page.getByTestId('assistant-submit').click();
  await page.waitForSelector('[data-testid=assistant-error]', { timeout: 15_000 });
  const errText = await page.locator('[data-testid=assistant-error]').textContent();
  console.log('ERROR STATE:', errText);
  await page.locator('[data-testid=assistant-error]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(outDir, 'assistant-error.png'), fullPage: false });
  results.errorState = errText;
  await ctx.close();
}

// --- 4. axe both themes ---
// Strip CSP only for this measurement so axe-core can inject; the app CSP is
// not changed in production. Contrast is what we score.
const axePath = join(__dir, '..', 'node_modules', 'axe-core', 'axe.min.js');
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ colorScheme: theme });
  const page = await ctx.newPage();
  await page.route('**/*', async (route) => {
    const response = await route.fetch();
    const headers = { ...response.headers() };
    delete headers['content-security-policy'];
    delete headers['Content-Security-Policy'];
    await route.fulfill({ response, headers });
  });
  await page.addInitScript((t) => {
    localStorage.setItem('theme', t);
  }, theme);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
  await page.addScriptTag({ path: axePath });
  const axeResult = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2aa', 'wcag21aa'] }
    });
    const contrast = r.violations.filter(
      (v) => v.id === 'color-contrast' || /contrast/i.test(v.id)
    );
    return {
      violations: r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length
      })),
      contrastCount: contrast.length,
      contrast
    };
  });
  console.log(
    `AXE theme=${theme} contrastViolations=${axeResult.contrastCount} all=${axeResult.violations.length}`
  );
  if (axeResult.violations.length) {
    console.log(JSON.stringify(axeResult.violations, null, 2));
  }
  results[`axe_${theme}`] = axeResult;
  writeFileSync(join(outDir, `axe-${theme}.json`), JSON.stringify(axeResult, null, 2));
  await ctx.close();
}

writeFileSync(join(outDir, 'results.json'), JSON.stringify(results, null, 2));
console.log('WROTE', outDir);
await browser.close();

// Fail closed on hard requirements
const darkOk =
  results.theme_dark?.attr === 'dark' && results.theme_dark?.bgVar === '#0e0c16';
const lightOk =
  results.theme_light?.attr === 'light' && results.theme_light?.bgVar === '#f4f2f9';
const storedOk = results.theme_stored_light_os_dark?.attr === 'light';
const postOk = (results.assistant?.api ?? []).some((x) => x === 'POST /api/assistant');
const axeOk =
  results.axe_light?.contrastCount === 0 && results.axe_dark?.contrastCount === 0;
if (!darkOk || !lightOk || !storedOk || !postOk || !axeOk) {
  console.error('VERIFY FAIL', { darkOk, lightOk, storedOk, postOk, axeOk });
  process.exit(1);
}
console.log('VERIFY PASS');
