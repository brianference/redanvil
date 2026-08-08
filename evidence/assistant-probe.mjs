import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.setViewportSize({ width: 1280, height: 900 });
const calls = [];
p.on('request', r => { if (r.url().includes('/api/')) calls.push(`${r.method()} ${new URL(r.url()).pathname}`); });
await p.goto('https://pet-sitter-vz1.pages.dev/', { waitUntil: 'networkidle' });
await p.getByText('Avery Chen').first().waitFor({ timeout: 15000 });

const ctl = p.getByRole('button', { name: /ask about sitters/i }).first();
console.log('control is a button:', await ctl.count());
await ctl.click();
await p.waitForTimeout(1000);
// what appeared?
const state = await p.evaluate(() => ({
  textareas: document.querySelectorAll('textarea').length,
  textInputs: document.querySelectorAll('input[type=text]').length,
  dialogs: document.querySelectorAll('[role=dialog]').length,
  sendBtns: [...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>/send|ask|submit/i.test(t))
}));
console.log('after click:', JSON.stringify(state));
const ta = p.locator('textarea').first();
if (await ta.count()) {
  await ta.fill('who sits for cats?');
  const send = p.getByRole('button', { name: /send|ask/i }).first();
  if (await send.count()) { await send.click(); } else { await ta.press('Enter'); }
  await p.waitForResponse(r => r.url().includes('/api/assistant'), { timeout: 12000 })
    .then(r => console.log('assistant response:', r.status()))
    .catch(() => console.log('NO /api/assistant response within 12s'));
}
console.log('API calls:', [...new Set(calls)].join(' | '));
await b.close();
