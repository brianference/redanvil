/**
 * Full render matrix for pet-sitter three views + design-option defect proofs.
 * Writes PNGs under design-refs/design-options/renders/.
 *
 * Usage (from pet-sitter/): node design-refs/design-options/render-matrix.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '../..');
const rendersDir = join(__dir, 'renders');
mkdirSync(rendersDir, { recursive: true });

/** Seed sitters matching migrations/0003_rebuild.sql + review averages. */
const SITTERS = [
  {
    id: 'sit-leslieville-01',
    name: 'Avery Chen',
    neighbourhood: 'Leslieville',
    rate_per_night: 55,
    pet_types: 'dogs,cats',
    bio: 'Evening walks and overnight stays for small and medium dogs. Quiet home near Greenwood Park.',
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
    bio: 'Apartment-based overnight care near Bloor. Accepts dogs under 40 lb with a trial meet.',
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
    bio: 'Cat-only drop-ins and multi-day stays. Litter, meds, and photo updates included.',
    verified_reviews: 18,
    available_from: '2026-08-05',
    available_to: '2026-10-31',
    source_url: 'https://www.petsitters.org/',
    created_at: '2026-08-06T00:00:00.000Z',
    avg_rating: 4
  },
  {
    id: 'sit-beaches-04',
    name: 'Riley Ng',
    neighbourhood: 'The Beaches',
    rate_per_night: 70,
    pet_types: 'dogs',
    bio: 'Beach-area house with fenced yard. Best for active dogs that need long morning walks.',
    verified_reviews: 33,
    available_from: '2026-08-10',
    available_to: '2026-12-15',
    source_url: 'https://www.rover.com/',
    created_at: '2026-08-06T00:00:00.000Z',
    avg_rating: 5
  },
  {
    id: 'sit-liberty-05',
    name: 'Morgan Ellis',
    neighbourhood: 'Liberty Village',
    rate_per_night: 58,
    pet_types: 'dogs,cats',
    bio: 'Condo stays with flexible drop-off windows. Happy to coordinate with building pet policies.',
    verified_reviews: 12,
    available_from: '2026-08-01',
    available_to: '2026-09-30',
    source_url: 'https://www.care.com/',
    created_at: '2026-08-06T00:00:00.000Z',
    avg_rating: null
  },
  {
    id: 'sit-highpark-06',
    name: 'Casey Brooks',
    neighbourhood: 'High Park',
    rate_per_night: 62,
    pet_types: 'dogs',
    bio: 'Near High Park trails. Mid-day walks and overnight boarding for one or two dogs.',
    verified_reviews: 29,
    available_from: '2026-08-01',
    available_to: '2026-12-31',
    source_url: 'https://wagwalking.com/',
    created_at: '2026-08-06T00:00:00.000Z',
    avg_rating: null
  },
  {
    id: 'sit-distillery-07',
    name: 'Taylor Kim',
    neighbourhood: 'Distillery District',
    rate_per_night: 75,
    pet_types: 'cats',
    bio: 'Quiet loft for cats only. Daily play sessions and twice-daily food checks.',
    verified_reviews: 9,
    available_from: '2026-08-15',
    available_to: '2026-11-15',
    source_url: 'https://www.petsitters.org/',
    created_at: '2026-08-06T00:00:00.000Z',
    avg_rating: null
  },
  {
    id: 'sit-yorkville-08',
    name: 'Alex Rivera',
    neighbourhood: 'Yorkville',
    rate_per_night: 80,
    pet_types: 'dogs,cats',
    bio: 'Short-notice overnight coverage for city travellers. References available on request.',
    verified_reviews: 52,
    available_from: '2026-08-01',
    available_to: '2026-12-31',
    source_url: 'https://www.rover.com/',
    created_at: '2026-08-06T00:00:00.000Z',
    avg_rating: 4
  }
];

const REVIEWS = {
  'sit-leslieville-01': [
    {
      id: 'rev-01',
      sitter_id: 'sit-leslieville-01',
      rating: 5,
      body: 'Reliable evening walks and clear photo updates every night.',
      created_at: '2026-07-12T00:00:00.000Z'
    }
  ]
};

/**
 * Static file content type.
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
  if (p.endsWith('.map')) return 'application/json';
  return 'application/octet-stream';
}

/**
 * Serve dist/ + mock API.
 * @param {number} port
 */
function startStaticServer(port) {
  const dist = join(root, 'dist');
  const publicDir = join(root, 'public');
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
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
        res.end(JSON.stringify({ sitter, reviews: REVIEWS[id] ?? [] }));
        return;
      }
      if (url.pathname === '/api/assistant') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ answer: 'Mock', sitters: [] }));
        return;
      }

      let path = url.pathname === '/' ? '/index.html' : url.pathname;
      // SPA fallback for client routes
      let filePath = join(dist, path.replace(/^\//, ''));
      if (!existsSync(filePath) || path.startsWith('/avatars/')) {
        const pub = join(publicDir, path.replace(/^\//, ''));
        if (existsSync(pub)) filePath = pub;
      }
      if (!existsSync(filePath) || (existsSync(filePath) && !path.includes('.') && path !== '/')) {
        // SPA: serve index for /sitters etc.
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
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

/**
 * Serve design-options directory for option HTML screenshots.
 * @param {number} port
 */
function startOptionsServer(port) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
      let path = url.pathname === '/' ? '/gallery.html' : url.pathname;
      const filePath = join(__dir, path.replace(/^\//, ''));
      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      const buf = readFileSync(filePath);
      res.writeHead(200, { 'content-type': contentType(filePath) });
      res.end(buf);
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

/**
 * @param {import('playwright').Page} page
 * @param {string} theme
 */
async function setTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem('theme', t);
    } catch {
      /* ignore */
    }
  }, theme);
}

async function main() {
  const written = [];
  const optPort = 4177;
  const appPort = 4178;

  const optServer = await startOptionsServer(optPort);
  const appServer = await startStaticServer(appPort);
  const browser = await chromium.launch({ headless: true });

  // --- Design option defect proofs + full option frames via clip ---
  // Capture phone frames from option HTML (first .phone in each section).
  for (const opt of ['a', 'b', 'c']) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.goto(`http://127.0.0.1:${optPort}/option-${opt}.html`, {
      waitUntil: 'networkidle',
      timeout: 60000
    });
    // Wait for images
    await page.waitForTimeout(800);

    // Home light phone
    const phones = page.locator('.phone');
    const desktops = page.locator('.desktop');
    const phoneCount = await phones.count();
    const desktopCount = await desktops.count();

    // Order in HTML: home light phone, home light desktop, home dark phone, home dark desktop,
    // detail light phone, detail light desktop, detail dark phone, detail dark desktop
    const labels = [
      ['home', 'light', '375'],
      ['home', 'light', '1280'],
      ['home', 'dark', '375'],
      ['home', 'dark', '1280'],
      ['detail', 'light', '375'],
      ['detail', 'light', '1280'],
      ['detail', 'dark', '375'],
      ['detail', 'dark', '1280']
    ];

    // Phones and desktops alternate in pairs per section
    // Actually structure is: row with phone+desktop per section
    // sections: home light, home dark, detail light, detail dark
    // Each section row: phone then desktop
    let phoneIdx = 0;
    let deskIdx = 0;
    for (let i = 0; i < labels.length; i += 1) {
      const [screen, theme, vp] = labels[i];
      const isPhone = vp === '375';
      const el = isPhone ? phones.nth(phoneIdx++) : desktops.nth(deskIdx++);
      const name = `opt-${opt}_${screen}_${vp}_${theme}.png`;
      const path = join(rendersDir, name);
      await el.screenshot({ path });
      written.push(name);
    }
    await page.close();
  }

  // Explicit defect proof crops (re-named for report)
  // B 375 light home = wordmark fix
  // C 375 light home = calendar fix
  // A/B/C 375 light home = assist dock

  // --- Live app matrix: 3 views × 2 vp × 2 themes + detail ---
  const views = ['photos', 'map', 'dates'];
  const vps = [
    { w: 375, h: 780, tag: '375' },
    { w: 1280, h: 820, tag: '1280' }
  ];
  const themes = ['light', 'dark'];

  for (const view of views) {
    for (const vp of vps) {
      for (const theme of themes) {
        const page = await browser.newPage({
          viewport: { width: vp.w, height: vp.h },
          colorScheme: theme === 'dark' ? 'dark' : 'light'
        });
        const q = view === 'photos' ? '' : `?view=${view}`;
        await page.goto(`http://127.0.0.1:${appPort}/${q}`, {
          waitUntil: 'networkidle',
          timeout: 60000
        });
        await setTheme(page, theme);
        await page.waitForSelector('[data-testid="search-results"], [data-testid="empty-sitters"]', {
          timeout: 15000
        });
        // Scroll results into view on short phones so the matrix shows the view, not only the capsule
        const results = page.locator('[data-testid="search-results"]');
        if (await results.count()) {
          await results.first().scrollIntoViewIfNeeded();
        }
        await page.waitForTimeout(400);
        const name = `app_${view}_${vp.tag}_${theme}.png`;
        const path = join(rendersDir, name);
        await page.screenshot({ path, fullPage: vp.tag === '375' });
        written.push(name);
        await page.close();
      }
    }
  }

  // Detail matrix
  for (const vp of vps) {
    for (const theme of themes) {
      const page = await browser.newPage({
        viewport: { width: vp.w, height: vp.h },
        colorScheme: theme === 'dark' ? 'dark' : 'light'
      });
      await page.goto(`http://127.0.0.1:${appPort}/sitters/sit-leslieville-01`, {
        waitUntil: 'networkidle',
        timeout: 60000
      });
      await setTheme(page, theme);
      await page.waitForSelector('.detail__avatar, .detail__bio, .state', { timeout: 15000 });
      await page.waitForTimeout(400);
      const name = `app_detail_${vp.tag}_${theme}.png`;
      const path = join(rendersDir, name);
      await page.screenshot({ path, fullPage: false });
      written.push(name);
      await page.close();
    }
  }

  await browser.close();
  optServer.close();
  appServer.close();

  const all = readdirSync(rendersDir).filter((f) => f.endsWith('.png'));
  const manifest = {
    generatedAt: new Date().toISOString(),
    writtenThisRun: written.length,
    totalPngInDir: all.length,
    files: all.sort()
  };
  writeFileSync(join(rendersDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
  console.log(`Render count: ${all.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
