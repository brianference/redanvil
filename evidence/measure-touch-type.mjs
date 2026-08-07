import { chromium } from 'playwright';
const b = await chromium.launch();
for (const view of ['photos','map','dates']) {
  const p = await b.newPage();
  await p.setViewportSize({ width: 375, height: 812 });
  await p.goto(`https://pet-sitter-vz1.pages.dev/?view=${view}`, { waitUntil: 'networkidle' });

  // Wait on a real ready signal per view, never a fixed sleep. A 400ms
  // waitForTimeout here measured the dates view mid-render and reported 49
  // calendar cells at 49x34 -- the exact pre-fix numbers -- while the deployed
  // CSS already said min-height:44px. That nearly became a report that a
  // correct fix had failed.
  const ready = {
    photos: () => p.getByText('Avery Chen', { exact: false }).first(),
    map: () => p.getByText('Avery Chen', { exact: false }).first(),
    dates: () => p.locator('.cal-day').nth(20)
  }[view];
  await ready().waitFor({ state: 'visible', timeout: 15000 });
  const r = await p.evaluate(() => {
    const small = [], tiny = [];
    for (const el of document.querySelectorAll('button, a, input, select, [role=button]')) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      if (b.height < 44 || b.width < 44) small.push(`${el.tagName}.${(el.className||'').toString().split(' ')[0]}"${(el.textContent||'').trim().slice(0,18)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    for (const el of document.querySelectorAll('body *')) {
      if (!el.childNodes.length) continue;
      const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (!hasText) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 16) tiny.push(`${el.tagName}.${(el.className||'').toString().split(' ')[0]} ${fs}px "${(el.textContent||'').trim().slice(0,22)}"`);
    }
    return { small: [...new Set(small)].slice(0,6), tiny: [...new Set(tiny)].slice(0,8), tinyCount: tiny.length, smallCount: small.length };
  });
  console.log(`--- ${view}: ${r.smallCount} target(s) <44px, ${r.tinyCount} text node(s) <16px`);
  r.small.forEach(s => console.log('   TARGET', s));
  r.tiny.slice(0,4).forEach(s => console.log('   TYPE  ', s));
  await p.close();
}
await b.close();
