/**
 * Capture the 12-image app matrix (3 views × 2 viewports × 2 themes)
 * and write design-refs/design-options/renders/MANIFEST.json with real sha256.
 *
 * Usage (from pet-sitter/ after build): node scripts/render-app-matrix.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, createReadStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const rendersDir = join(root, 'design-refs', 'design-options', 'renders');
const PORT = 4192;

const SITTERS = [
  {
    id: 'sit-leslieville-01',
    name: 'Avery Chen',
    neighbourhood: 'Leslieville',
    rate_per_night: 55,
    pet_types: 'dogs,cats',
    bio: 'Evening walks and overnight stays for small and medium dogs.',
    verified_reviews: 24,
    available_from: '2026-08-01',
    available_to: '2026-12-31',
    source_url: 'https://www.rover.com/',
    created_at: '2026-08-06T00:00:00.000Z',
    avg_rating: 5
  },
  {
    id: 'sit-annex-02',
    name: 'Jordan Patel',
    neighbourhood: 'The Annex',
    rate_per_night: 65,
    pet_types: 'dogs',
    bio: 'Apartment-based overnight care near Bloor.',
    verified_reviews: 41,
    available_from: '2026-08-01',
    available_to: '2026-11-30',
    source_url: 'https://wagwalking.com/',
    created_at: '2026-08-06T00:00:00.000Z',
    avg_rating: 5
  },
  {
    id: 'sit-riverdale-03',
    name: 'Sam Okonkwo',
    neighbourhood: 'Riverdale',
    rate_per_night: 48,
    pet_types: 'cats,small mammals',
    bio: 'Cat-only drop-ins and multi-day stays.',
    verified_reviews: 18,
    available_from: '2026-08-05',
    available_to: '2026-10-31',
    source_url: 'https://www.petsitters.org/',
    created_at: '2026-08-06T00:00:00.000Z',
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
  if (p.endsWith('.svg')) return 'image/svg+xml';
  if (p.endsWith('.json')) return 'application/json';
  if (p.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

function startServer() {
  const dist = join(root, 'dist');
  const publicDir = join(root, 'public');
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
      if (url.pathname === '/api/sitters') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ sitters: SITTERS, count: SITTERS.length }));
        return;
      }
      const detail = url.pathname.match(/^\/api\/sitters\/([^/]+)$/);
      if (detail) {
        const id = decodeURIComponent(detail[1]);
        const sitter = SITTERS.find((s) => s.id === id);
        if (!sitter) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'not found' }));
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ sitter, reviews: [] }));
        return;
      }
      if (url.pathname === '/api/assistant') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ answer: 'Mock', sitters: [] }));
        return;
      }
      let path = url.pathname === '/' ? '/index.html' : url.pathname;
      let filePath = join(dist, path.replace(/^\//, ''));
      if (!existsSync(filePath) || path.startsWith('/avatars/') || path.startsWith('/fonts/')) {
        const pub = join(publicDir, path.replace(/^\//, ''));
        if (existsSync(pub)) filePath = pub;
      }
      if (!existsSync(filePath) || (existsSync(filePath) && !path.includes('.') && path !== '/')) {
        if (!path.includes('.') || path.endsWith('/')) {
          filePath = join(dist, 'index.html');
        }
      }
      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      const buf = readFileSync(filePath);
      res.writeHead(200, { 'content-type': contentType(filePath) });
      res.end(buf);
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

/**
 * @param {string} filePath
 */
function sha256File(filePath) {
  const hash = createHash('sha256');
  hash.update(readFileSync(filePath));
  return hash.digest('hex');
}

async function main() {
  mkdirSync(rendersDir, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${PORT}/`;
  const views = ['photos', 'map', 'dates'];
  const vps = [
    { w: 375, h: 812, tag: 375 },
    { w: 1280, h: 800, tag: 1280 }
  ];
  const themes = ['light', 'dark'];
  /** @type {Array<{file:string,viewport:number,theme:string,view:string,sha256:string}>} */
  const renders = [];

  try {
    for (const view of views) {
      for (const vp of vps) {
        for (const theme of themes) {
          const page = await browser.newPage({
            viewport: { width: vp.w, height: vp.h },
            colorScheme: theme === 'dark' ? 'dark' : 'light'
          });
          const q = view === 'photos' ? '' : `?view=${view}`;
          await page.goto(`${base}${q}`, { waitUntil: 'networkidle', timeout: 60000 });
          await page.evaluate((t) => {
            document.documentElement.setAttribute('data-theme', t);
            try {
              localStorage.setItem('theme', t);
            } catch {
              /* ignore */
            }
          }, theme);
          // Ensure view switch is applied (query may already set it)
          const testId =
            view === 'photos' ? 'view-photos' : view === 'map' ? 'view-map' : 'view-dates';
          const btn = page.getByTestId(testId);
          if (await btn.count()) {
            await btn.click();
          }
          await page.waitForSelector(
            '[data-testid="search-results"], [data-layout], [data-testid="view-switch"]',
            { timeout: 15000 }
          );
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(500);
          const file = `app_${view}_${vp.tag}_${theme}.png`;
          const path = join(rendersDir, file);
          await page.screenshot({ path, fullPage: false });
          const digest = sha256File(path);
          renders.push({
            file,
            viewport: vp.tag,
            theme,
            view,
            sha256: digest
          });
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  const hashes = renders.map((r) => r.sha256);
  const unique = new Set(hashes);
  const manifest = {
    generatedAt: new Date().toISOString(),
    renders,
    distinctSha256Count: unique.size
  };
  writeFileSync(join(rendersDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
  if (unique.size !== 12) {
    console.error(`FAIL: expected 12 distinct hashes, got ${unique.size}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
