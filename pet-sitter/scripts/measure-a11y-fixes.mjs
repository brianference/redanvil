/**
 * Measure contrast (axe), touch targets, and type floor for pet-sitter a11y fixes.
 * Serves local dist/ + mock sitters API. Prints JSON only (real measurements).
 *
 * Usage (from pet-sitter/): node scripts/measure-a11y-fixes.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const PORT = 4191;

const SITTERS = [
  {
    id: 'sit-leslieville-01',
    name: 'Avery Chen',
    neighbourhood: 'Leslieville',
    rate_per_night: 55,
    pet_types: 'dogs,cats',
    bio: 'Evening walks and overnight stays.',
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
    bio: 'Apartment-based overnight care.',
    verified_reviews: 41,
    available_from: '2026-08-01',
    available_to: '2026-11-30',
    source_url: 'https://wagwalking.com/',
    created_at: '2026-08-06T00:00:00.000Z',
    avg_rating: 5
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
  if (p.endsWith('.map')) return 'application/json';
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
 * @param {import('playwright').Page} page
 * @param {'photos'|'map'|'dates'} view
 */
async function openView(page, view) {
  const testId =
    view === 'photos' ? 'view-photos' : view === 'map' ? 'view-map' : 'view-dates';
  await page.getByTestId(testId).click();
  await page.waitForTimeout(400);
}

/**
 * @param {import('playwright').Page} page
 * @param {'light'|'dark'} theme
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
  await page.waitForTimeout(200);
}

/**
 * Inject axe-core from CDN and run colour-contrast only.
 * @param {import('playwright').Page} page
 */
async function runAxeContrast(page) {
  const axePath = join(root, 'node_modules', 'axe-core', 'axe.min.js');
  await page.addScriptTag({ path: axePath });
  return page.evaluate(async () => {
    // @ts-expect-error axe on window
    const axe = window.axe;
    const results = await axe.run(document, {
      runOnly: { type: 'rule', values: ['color-contrast'] }
    });
    return {
      axeVersion: axe.version,
      violations: results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          html: n.html.slice(0, 200),
          failureSummary: n.failureSummary
        }))
      })),
      nodeCount: results.violations.reduce((n, v) => n + v.nodes.length, 0)
    };
  });
}

/**
 * Measure interactive hit boxes and sub-16px text nodes.
 * @param {import('playwright').Page} page
 */
async function measureTargetsAndType(page) {
  return page.evaluate(() => {
    const MIN = 44;
    const TYPE_FLOOR = 16;

    /**
     * @param {Element} el
     */
    function box(el) {
      const r = el.getBoundingClientRect();
      return {
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
        tag: el.tagName,
        testid: el.getAttribute('data-testid') || '',
        cls: (el.className && String(el.className).slice?.(0, 80)) || '',
        text: (el.textContent || '').trim().slice(0, 40)
      };
    }

    const interactive = Array.from(
      document.querySelectorAll(
        'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="link"]'
      )
    ).filter((el) => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });

    const smallTargets = interactive
      .map((el) => {
        const b = box(el);
        return { ...b, fail: b.w < MIN || b.h < MIN };
      })
      .filter((b) => b.fail);

    // Named controls of interest
    const named = {};
    for (const sel of [
      'button.view-switch__btn',
      'input.search-capsule__input',
      'input.map-search__input',
      'button.map-search__go',
      'button.cal-day',
      'button.topbar__menu-btn'
    ]) {
      const els = Array.from(document.querySelectorAll(sel)).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (els.length === 0) {
        named[sel] = [];
        continue;
      }
      named[sel] = els.slice(0, 3).map((el) => {
        const b = box(el);
        return { ...b, fail: b.w < MIN || b.h < MIN, count: els.length };
      });
      if (els.length > 0) named[sel][0].total = els.length;
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    /** @type {Array<{text:string,px:number,tag:string,cls:string}>} */
    const under = [];
    let node;
    while ((node = walker.nextNode())) {
      const t = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t) continue;
      const parent = node.parentElement;
      if (!parent) continue;
      const s = getComputedStyle(parent);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const r = parent.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const px = parseFloat(s.fontSize);
      if (!Number.isFinite(px) || px >= TYPE_FLOOR - 0.01) continue;
      under.push({
        text: t.slice(0, 48),
        px: Math.round(px * 10) / 10,
        tag: parent.tagName,
        cls: (parent.className && String(parent.className).slice?.(0, 60)) || ''
      });
    }

    // Dedupe by tag+cls+px+text
    const seen = new Set();
    const uniqueUnder = [];
    for (const u of under) {
      const k = `${u.tag}|${u.cls}|${u.px}|${u.text}`;
      if (seen.has(k)) continue;
      seen.add(k);
      uniqueUnder.push(u);
    }

    return {
      smallTargetCount: smallTargets.length,
      smallTargets: smallTargets.slice(0, 40),
      named,
      under16Count: under.length,
      under16Unique: uniqueUnder.slice(0, 60),
      under16Sample: under.slice(0, 25)
    };
  });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${PORT}/`;
  /** @type {Record<string, unknown>} */
  const report = { base, measuredAt: new Date().toISOString() };

  try {
    // --- Axe contrast both themes (home photos default) ---
    report.axe = {};
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
      await setTheme(page, theme);
      await openView(page, 'photos');
      // Also check map + dates active pill colors
      const photos = await runAxeContrast(page);
      await openView(page, 'map');
      const map = await runAxeContrast(page);
      await openView(page, 'dates');
      const dates = await runAxeContrast(page);
      report.axe[theme] = {
        photos,
        map,
        dates,
        totalContrastNodes:
          photos.nodeCount + map.nodeCount + dates.nodeCount
      };
      await page.close();
    }

    // --- Targets + type at 375, all three views ---
    report.mobile375 = {};
    for (const view of ['photos', 'map', 'dates']) {
      const page = await browser.newPage({
        viewport: { width: 375, height: 812 }
      });
      await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
      await setTheme(page, 'light');
      await openView(page, view);
      report.mobile375[view] = await measureTargetsAndType(page);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
