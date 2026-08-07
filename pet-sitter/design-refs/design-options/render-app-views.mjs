/**
 * Render the 12 live-app view captures (3 views × 2 vp × 2 themes).
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '../..');
const dist = join(root, 'dist');
const publicDir = join(root, 'public');
const rendersDir = join(__dir, 'renders');
mkdirSync(rendersDir, { recursive: true });

const sitters = [
  {
    id: 'sit-leslieville-01',
    name: 'Avery Chen',
    neighbourhood: 'Leslieville',
    rate_per_night: 55,
    pet_types: 'dogs,cats',
    bio: 'x',
    verified_reviews: 24,
    available_from: '2026-08-01',
    available_to: '2026-12-31',
    source_url: null,
    created_at: '2026-08-06',
    avg_rating: 5
  },
  {
    id: 'sit-annex-02',
    name: 'Jordan Patel',
    neighbourhood: 'The Annex',
    rate_per_night: 65,
    pet_types: 'dogs',
    bio: 'x',
    verified_reviews: 41,
    available_from: '2026-08-01',
    available_to: '2026-11-30',
    source_url: null,
    created_at: '2026-08-06',
    avg_rating: 5
  },
  {
    id: 'sit-riverdale-03',
    name: 'Sam Okonkwo',
    neighbourhood: 'Riverdale',
    rate_per_night: 48,
    pet_types: 'cats,small mammals',
    bio: 'x',
    verified_reviews: 18,
    available_from: '2026-08-05',
    available_to: '2026-10-31',
    source_url: null,
    created_at: '2026-08-06',
    avg_rating: 4
  },
  {
    id: 'sit-beaches-04',
    name: 'Riley Ng',
    neighbourhood: 'The Beaches',
    rate_per_night: 70,
    pet_types: 'dogs',
    bio: 'x',
    verified_reviews: 33,
    available_from: '2026-08-10',
    available_to: '2026-12-15',
    source_url: null,
    created_at: '2026-08-06',
    avg_rating: 5
  },
  {
    id: 'sit-liberty-05',
    name: 'Morgan Ellis',
    neighbourhood: 'Liberty Village',
    rate_per_night: 58,
    pet_types: 'dogs,cats',
    bio: 'x',
    verified_reviews: 12,
    available_from: '2026-08-01',
    available_to: '2026-09-30',
    source_url: null,
    created_at: '2026-08-06',
    avg_rating: null
  },
  {
    id: 'sit-highpark-06',
    name: 'Casey Brooks',
    neighbourhood: 'High Park',
    rate_per_night: 62,
    pet_types: 'dogs',
    bio: 'x',
    verified_reviews: 29,
    available_from: '2026-08-01',
    available_to: '2026-12-31',
    source_url: null,
    created_at: '2026-08-06',
    avg_rating: null
  },
  {
    id: 'sit-distillery-07',
    name: 'Taylor Kim',
    neighbourhood: 'Distillery District',
    rate_per_night: 75,
    pet_types: 'cats',
    bio: 'x',
    verified_reviews: 9,
    available_from: '2026-08-15',
    available_to: '2026-11-15',
    source_url: null,
    created_at: '2026-08-06',
    avg_rating: null
  },
  {
    id: 'sit-yorkville-08',
    name: 'Alex Rivera',
    neighbourhood: 'Yorkville',
    rate_per_night: 80,
    pet_types: 'dogs,cats',
    bio: 'x',
    verified_reviews: 52,
    available_from: '2026-08-01',
    available_to: '2026-12-31',
    source_url: null,
    created_at: '2026-08-06',
    avg_rating: 4
  }
];

/**
 * @param {string} p
 */
function contentType(p) {
  if (p.endsWith('.html')) return 'text/html; charset=utf-8';
  if (p.endsWith('.js')) return 'text/javascript';
  if (p.endsWith('.css')) return 'text/css';
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
  if (p.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === '/api/sitters') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ sitters, count: sitters.length }));
    return;
  }
  let path = url.pathname === '/' ? '/index.html' : url.pathname;
  let filePath = join(dist, path.replace(/^\//, ''));
  if (!existsSync(filePath)) filePath = join(publicDir, path.replace(/^\//, ''));
  if (!existsSync(filePath) || !path.includes('.')) filePath = join(dist, 'index.html');
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': contentType(filePath) });
  res.end(readFileSync(filePath));
});

await new Promise((resolve) => server.listen(4198, '127.0.0.1', resolve));

const browser = await chromium.launch();
const views = ['photos', 'map', 'dates'];
const vps = [
  { w: 375, h: 780, tag: '375' },
  { w: 1280, h: 820, tag: '1280' }
];
const themes = ['light', 'dark'];
const written = [];

for (const view of views) {
  for (const vp of vps) {
    for (const theme of themes) {
      const page = await browser.newPage({
        viewport: { width: vp.w, height: vp.h },
        colorScheme: theme === 'dark' ? 'dark' : 'light'
      });
      const q = view === 'photos' ? '' : `?view=${view}`;
      await page.goto(`http://127.0.0.1:4198/${q}`, {
        waitUntil: 'networkidle',
        timeout: 60000
      });
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('theme', t);
      }, theme);
      await page.waitForSelector('[data-testid="search-results"], [data-layout]', {
        timeout: 15000
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
      const name = `app_${view}_${vp.tag}_${theme}.png`;
      await page.screenshot({ path: join(rendersDir, name), fullPage: false });
      written.push(name);
      await page.close();
    }
  }
}

await browser.close();
server.close();
writeFileSync(
  join(rendersDir, 'MANIFEST.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), appViews: written }, null, 2)
);
console.log('wrote', written.length, written.join(', '));
