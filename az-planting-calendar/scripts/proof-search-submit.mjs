/**
 * Prove Search button and Enter reach the same state without navigation races.
 */
import { chromium } from '@playwright/test';

const base = 'http://127.0.0.1:8788';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

page.on('console', (msg) => console.log('CONSOLE', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('PAGEERROR', err.message));
page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) console.log('NAV', frame.url());
});

/**
 * @param {'button' | 'enter'} how
 */
async function runPath(how) {
  console.log('\n=== path', how, '===');
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const cropsWait = page.waitForResponse(
    (r) => r.url().includes('/api/crops') && r.url().includes('q=tomato') && r.ok(),
    { timeout: 15000 }
  );
  const search = page.getByTestId('filter-search');
  await search.waitFor({ state: 'visible', timeout: 10000 });
  await search.fill('tomato');
  await cropsWait;
  await page.getByTestId('search-result-list').waitFor({ state: 'visible', timeout: 10000 });
  console.log('before submit', page.url());

  if (how === 'button') {
    await page.getByTestId('search-submit').click();
  } else {
    await search.focus();
    await search.press('Enter');
  }

  await page.waitForTimeout(500);
  console.log('after submit', page.url());
  const count = await page.getByTestId('search-result-count').innerText();
  const first = await page.getByTestId('search-result-item').first().innerText();
  const pathname = new URL(page.url()).pathname;
  console.log({ count, first, pathname });
  return { count, first, pathname, url: page.url() };
}

try {
  const a = await runPath('button');
  const b = await runPath('enter');
  console.log('\nMATCH', a.count === b.count && a.first === b.first && a.pathname === '/');
} catch (err) {
  console.error('FAIL', err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
