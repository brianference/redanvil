/**
 * Capture four frames per home layout option (dark/light × 375/1280).
 * Serves the repo root so public/ crops and brand assets resolve.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const outDir = __dirname;
const PORT = 8791;

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
  { id: '1', file: 'option-1-focus-hero.html' },
  { id: '2', file: 'option-2-gallery-first.html' },
  { id: '3', file: 'option-3-timeline-rail.html' }
];
const themes = ['light', 'dark'];
const widths = [
  { w: 375, h: 844, label: '375' },
  { w: 1280, h: 800, label: '1280' }
];

const browser = await chromium.launch();
const frames = [];

try {
  for (const opt of options) {
    for (const theme of themes) {
      for (const vp of widths) {
        const page = await browser.newPage({
          viewport: { width: vp.w, height: vp.h },
          colorScheme: theme === 'dark' ? 'dark' : 'light'
        });
        const url = `http://127.0.0.1:${PORT}/design-refs/home-options/${opt.file}?theme=${theme}`;
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(200);
        const name = `option-${opt.id}-${theme}-${vp.label}.png`;
        const out = path.join(outDir, name);
        await page.screenshot({ path: out, fullPage: false });
        frames.push(name);
        await page.close();
        console.log('wrote', name);
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({ frames, count: frames.length }, null, 2));
