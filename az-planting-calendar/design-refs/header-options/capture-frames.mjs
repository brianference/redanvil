/**
 * Capture four frames per header option (dark/light × 375/1280) and measure
 * header height, search y, brand mark height, truncation at 375.
 * Serves the repo root so public/ brand + crop assets resolve.
 */
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const outDir = __dirname;
const PORT = 8793;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

/**
 * @param {string} urlPath
 */
function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const rel = clean === '/' ? '/index.html' : clean;
  const full = path.normalize(path.join(root, rel));
  if (!full.startsWith(root)) return null;
  return full;
}

const server = createServer(async (req, res) => {
  try {
    const file = resolveFile(req.url ?? '/');
    if (!file || !existsSync(file)) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const ext = path.extname(file);
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    res.end(body);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

const options = [
  { id: '1', file: 'option-1-command-bar.html', name: 'Command bar' },
  { id: '2', file: 'option-2-two-tier.html', name: 'Two-tier sticky' },
  { id: '3', file: 'option-3-drawer-dock.html', name: 'Compact drawer + dock' }
];
const themes = ['light', 'dark'];
const widths = [
  { w: 375, h: 844, label: '375' },
  { w: 1280, h: 800, label: '1280' }
];

/**
 * Count elements that appear truncated (ellipsis or overflow clip of text).
 *
 * @param {import('playwright').Page} page
 */
async function countTruncated(page) {
  return page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll('a, button, p, span, h1, h2, h3, label, .brand-name, .mono')
    );
    let count = 0;
    for (const el of candidates) {
      if (!(el instanceof HTMLElement)) continue;
      // Skip intentionally clipped a11y helpers (not visible truncation).
      if (el.classList.contains('sr-only')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (style.position === 'absolute' && (el.offsetWidth <= 1 || el.offsetHeight <= 1)) continue;
      const ellipsis =
        style.textOverflow === 'ellipsis' ||
        (style.overflow === 'hidden' && style.whiteSpace === 'nowrap');
      if (ellipsis && el.scrollWidth > el.clientWidth + 1) {
        count += 1;
        continue;
      }
      // Explicit ellipsis character in visible single-line chrome
      if ((el.textContent ?? '').includes('…') || (el.textContent ?? '').includes('...')) {
        if (style.whiteSpace === 'nowrap' || el.scrollWidth > el.clientWidth + 1) {
          count += 1;
        }
      }
    }
    return count;
  });
}

/**
 * Measure chrome geometry for the current viewport.
 *
 * @param {import('playwright').Page} page
 * @param {number} viewportH
 */
async function measure(page, viewportH) {
  const geom = await page.evaluate(() => {
    const header = document.querySelector('[data-measure="header"]');
    const search = document.querySelector('[data-measure="search"]');
    const mark = document.querySelector('[data-measure="mark"]');
    const timeline = document.querySelector('[data-measure="timeline"]');
    if (!header || !search || !mark) {
      return { error: 'missing measure targets' };
    }
    const hr = header.getBoundingClientRect();
    const sr = search.getBoundingClientRect();
    const mr = mark.getBoundingClientRect();
    const tr = timeline ? timeline.getBoundingClientRect() : null;
    return {
      headerHeight: Math.round(hr.height),
      headerBottom: Math.round(hr.bottom),
      searchY: Math.round(sr.top),
      searchBottom: Math.round(sr.bottom),
      markHeight: Math.round(mr.height),
      markWidth: Math.round(mr.width),
      timelineTop: tr ? Math.round(tr.top) : null,
      timelineHeight: tr ? Math.round(tr.height) : null
    };
  });

  const truncated = await countTruncated(page);
  const searchAboveFold = geom.searchBottom != null ? geom.searchBottom <= viewportH : false;
  const timelineSpaceAboveFold =
    geom.timelineTop != null ? Math.max(0, viewportH - geom.timelineTop) : null;

  return {
    ...geom,
    truncatedCount: truncated,
    searchAboveFold,
    timelineSpaceAboveFold,
    viewportH
  };
}

const browser = await chromium.launch();
const frames = [];
/** @type {Record<string, unknown>} */
const report = { options: {}, capturedAt: new Date().toISOString() };

try {
  for (const opt of options) {
    /** @type {Record<string, unknown>} */
    const optReport = { name: opt.name, file: opt.file, frames: {}, metrics: {} };
    for (const theme of themes) {
      for (const vp of widths) {
        const page = await browser.newPage({
          viewport: { width: vp.w, height: vp.h },
          colorScheme: theme === 'dark' ? 'dark' : 'light'
        });
        const url = `http://127.0.0.1:${PORT}/design-refs/header-options/${opt.file}?theme=${theme}`;
        await page.goto(url, { waitUntil: 'networkidle' });
        // Wait for brand mark decode so height is real
        await page.waitForFunction(() => {
          const img = document.querySelector('[data-measure="mark"]');
          return img instanceof HTMLImageElement && img.complete && img.naturalHeight > 0;
        });
        await page.waitForTimeout(150);

        const name = `option-${opt.id}-${theme}-${vp.label}.png`;
        const out = path.join(outDir, name);
        await page.screenshot({ path: out, fullPage: false });
        frames.push(name);

        const m = await measure(page, vp.h);
        const key = `${theme}-${vp.label}`;
        optReport.frames[key] = name;
        optReport.metrics[key] = m;

        // Primary metrics: use light theme as canonical (layout identical)
        if (theme === 'light') {
          if (vp.label === '375') {
            optReport.headerHeight375 = m.headerHeight;
            optReport.searchY375 = m.searchY;
            optReport.markHeight375 = m.markHeight;
            optReport.truncated375 = m.truncatedCount;
            optReport.searchAboveFold375 = m.searchAboveFold;
            optReport.timelineSpace375 = m.timelineSpaceAboveFold;
          }
          if (vp.label === '1280') {
            optReport.headerHeight1280 = m.headerHeight;
            optReport.searchY1280 = m.searchY;
            optReport.markHeight1280 = m.markHeight;
            optReport.searchAboveFold1280 = m.searchAboveFold;
            optReport.timelineSpace1280 = m.timelineSpaceAboveFold;
          }
        }

        console.log('wrote', name, JSON.stringify(m));
        await page.close();
      }
    }
    report.options[`option-${opt.id}`] = optReport;
  }
} finally {
  await browser.close();
  server.close();
}

const measurePath = path.join(outDir, 'MEASUREMENT.json');
await writeFile(measurePath, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify({ frames, count: frames.length, measurePath }, null, 2));
