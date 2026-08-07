import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.setViewportSize({ width: 1280, height: 900 });
const calls = [];
p.on('request', r => { if (r.url().includes('/api/')) calls.push(`${r.method()} ${new URL(r.url()).pathname}`); });
await p.goto('https://pet-sitter-vz1.pages.dev/', { waitUntil: 'networkidle' });
await p.getByText('Avery Chen').first().waitFor({ timeout: 15000 });

// 1. does typing in search hit the API and change results?
const before = await p.getByText('sitters found').first().textContent();
const box = p.getByRole('searchbox').or(p.locator('input[type=search]')).first();
await box.fill('leslieville');
await box.press('Enter');
await p.waitForTimeout(1500);
const after = await p.getByText('sitters found').first().textContent();
console.log('search:', JSON.stringify(before), '->', JSON.stringify(after));

// 2. does the assistant affordance actually talk to the worker?
const assist = p.getByText(/ask about sitters/i).first();
console.log('assistant control present:', await assist.count() > 0);
if (await assist.count() > 0) { await assist.click(); await p.waitForTimeout(1200); }
const ta = p.locator('textarea, input[type=text]').last();
if (await ta.count() > 0) { await ta.fill('who sits for cats?'); await ta.press('Enter'); await p.waitForTimeout(4000); }

// 3. is there any booking affordance at all?
const booking = await p.getByRole('button', { name: /book|request|contact|message/i }).count();
console.log('booking-ish controls on home:', booking);
console.log('API calls made by the UI:', [...new Set(calls)].join(' | ') || 'NONE');
await b.close();
