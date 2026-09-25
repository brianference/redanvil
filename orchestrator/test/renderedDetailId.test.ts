/**
 * fe-breadcrumbs / fe-resource-links: resolving a real detail id from a
 * client-rendered collection.
 *
 * Both checks used to read only `/api/<collection>` JSON and the RAW HTML of
 * `/<collection>`. A client-rendered SPA served from a static dist answers
 * neither, so the dashboard (which lists /run/<slug> links on `/`, rendered
 * after its feed loads) failed with "no real detail id available". The fix
 * reads the rendered DOM. These tests pin both directions:
 *
 *   - known-good: links written by JS after load ARE found, and the raw-HTML
 *     path alone provably cannot see them;
 *   - known-bad: a rendered app with no detail links still yields null, and
 *     the full check still exits 1 on it — the fix never invents an id.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { firstRealIdFromHtml, resolveRealDetailId } from '../scripts/checks/fe-breadcrumbs.mjs';
import { firstRealIdFromRenderedPages } from '../scripts/lib/rendered-detail-id.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CHECK_SCRIPT = join(here, '..', 'scripts', 'checks', 'check.mjs');

/** SPA shell that writes a detail link into the DOM after a delay, like a feed load. */
const RENDERS_DETAIL_LINK = `<!doctype html><html><body><div id="root"></div>
<script>setTimeout(function () {
  // Built from parts so the raw source holds no literal detail href either.
  var a = document.createElement('a'); a.href = '/run/' + 'real-slug'; a.textContent = 'real-slug';
  document.getElementById('root').appendChild(a);
}, 300);</script></body></html>`;

/** SPA shell that renders only chrome links — no detail link, ever. */
const RENDERS_NO_DETAIL_LINK = `<!doctype html><html><body><div id="root"></div>
<script>setTimeout(function () {
  var a = document.createElement('a'); a.href = '/about'; a.textContent = 'About';
  document.getElementById('root').appendChild(a);
}, 300);</script></body></html>`;

const servers: Server[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(() => r(null)))));
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * Serve one HTML body for every path, like a static SPA fallback. /api/* also
 * gets the HTML, exactly as a static dist server answers it.
 *
 * @param html - Body for every request.
 * @returns Origin URL.
 */
async function serveEverywhere(html: string): Promise<string> {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('rendered-DOM detail id resolution', () => {
  it('finds a detail link the app writes after load; raw HTML cannot', async () => {
    const origin = await serveEverywhere(RENDERS_DETAIL_LINK);
    // The pre-fix path: raw HTML of the collection has no detail link.
    expect(firstRealIdFromHtml(RENDERS_DETAIL_LINK, '/run')).toBeNull();
    expect(await resolveRealDetailId(origin, '/run/:slug')).toBeNull();

    const browser = await chromium.launch();
    try {
      expect(await resolveRealDetailId(origin, '/run/:slug', { browser })).toBe('real-slug');
    } finally {
      await browser.close();
    }
  }, 60_000);

  it('KNOWN-BAD: a rendered app with no detail link yields null (no invented id)', async () => {
    const origin = await serveEverywhere(RENDERS_NO_DETAIL_LINK);
    const browser = await chromium.launch();
    try {
      const id = await firstRealIdFromRenderedPages(browser, origin, '/run', firstRealIdFromHtml, {
        waitMs: 1_500
      });
      expect(id).toBeNull();
    } finally {
      await browser.close();
    }
  }, 60_000);

  it('KNOWN-BAD: fe-breadcrumbs still exits 1 on an SPA whose pages never link a detail', () => {
    const app = mkdtempSync(join(tmpdir(), 'redanvil-detail-id-'));
    tempDirs.push(app);
    mkdirSync(join(app, 'src'), { recursive: true });
    mkdirSync(join(app, 'dist'), { recursive: true });
    writeFileSync(
      join(app, 'src', 'App.tsx'),
      '<Route path="/" element={<Home />} />\n<Route path="/run/:slug" element={<Run />} />\n'
    );
    writeFileSync(join(app, 'dist', 'index.html'), RENDERS_NO_DETAIL_LINK);
    const r = spawnSync(process.execPath, [CHECK_SCRIPT, 'fe-breadcrumbs', app], {
      encoding: 'utf8',
      timeout: 150_000
    });
    const out = `${r.stdout}${r.stderr}`;
    expect(r.status).toBe(1);
    expect(out).toMatch(/no real detail id available for \/run\/:slug/);
  }, 160_000);
});
