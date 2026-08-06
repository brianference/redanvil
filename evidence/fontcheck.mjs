import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
const fontReqs = [];
p.on('response', r => { if (/\.(woff2?|ttf)$/i.test(r.url())) fontReqs.push(`${r.status()} ${r.url().split('/').pop()}`); });
await p.goto('https://pet-sitter-vz1.pages.dev', { waitUntil: 'networkidle' });
const info = await p.evaluate(async () => {
  await document.fonts.ready;
  const h1 = document.querySelector('h1');
  return {
    family: getComputedStyle(h1).fontFamily,
    loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family} ${f.weight}`),
    dmSansUsable: document.fonts.check('700 32px "DM Sans"')
  };
});
console.log('font requests:', fontReqs.join(', ') || '(none)');
console.log('h1 font-family:', info.family);
console.log('DM Sans usable:', info.dmSansUsable);
console.log('loaded faces:', [...new Set(info.loaded)].slice(0,6).join(' | '));
await b.close();
