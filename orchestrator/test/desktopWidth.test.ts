/**
 * Binds `desktop_width.mjs` to fixtures whose correct answer is known.
 *
 * This test exists because the check was confidently wrong for weeks. It
 * measured `main.getBoundingClientRect().width`, and a block element is 100% of
 * its parent by default, so it reported 93% for pages whose content sat in the
 * left third of a 1920 viewport. Four pages across two apps were narrow behind
 * that number and a person looking at the site caught it, not the check.
 *
 * Nothing bound the measurement to a case with a known answer, so there was
 * nowhere for the mistake to surface. These fixtures are that binding: a page
 * whose container is full width while its content is not MUST fail, or the
 * check has regressed to what it was.
 *
 * Measured against the OLD implementation, all three fixtures reported 100%:
 *
 *   narrow.html            container=100%   painted=19%
 *   wide.html              container=100%   painted=90%
 *   footer-only-wide.html  container=100%   painted=19%
 *
 * A check that answers 100% for every page, correct or not, carries no
 * information. These three cases make that indistinguishable from a failure.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const SCRIPT = join(repoRoot, '.github', 'scripts', 'desktop_width.mjs');
const FIXTURES = join(here, 'fixtures', 'width');

/** Serve the fixture directory so the script can measure real rendered pages. */
function serveFixtures(): Promise<{ base: string; close: () => void }> {
  return new Promise((resolve) => {
    const server: Server = createServer((req, res) => {
      const name = (req.url ?? '/').split('?')[0]?.replace(/^\//, '') ?? '';
      const file = join(FIXTURES, name.length === 0 ? 'wide.html' : name);
      if (!existsSync(file)) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ base: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

let handle: { base: string; close: () => void } | null = null;

afterAll(() => {
  handle?.close();
});

/**
 * Run the real CLI against a fixture route.
 *
 * Async on purpose: `spawnSync` blocks this process's event loop, so the
 * fixture server — which lives in the same process — could never answer, every
 * page load timed out, and the checks "failed" for the wrong reason. One of
 * these tests passed on that failure, which is precisely the vacuous pass this
 * file exists to prevent.
 */
function measure(base: string, route: string): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      SCRIPT,
      base,
      '--routes',
      route,
      '--widths',
      '1440,1920'
    ]);
    let out = '';
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      out += d.toString();
    });
    child.on('close', (code) => resolve({ code: code ?? 1, out }));
  });
}

describe('desktop_width measures painted content, not a container', () => {
  it('FAILS a page whose container is full width but whose content is not', async () => {
    handle = handle ?? (await serveFixtures());
    const { code, out } = await measure(handle.base, '/narrow.html');
    // This is the exact shape that shipped narrow four times: `main` is 100%
    // wide, the content is capped at 400px. A container measurement passes it.
    expect(out).toMatch(/FAIL/);
    expect(code).toBe(1);
    const pct = /narrow\.html @ 1920 -> (\d+)%/.exec(out)?.[1];
    expect(pct, `expected a low percentage, got: ${out}`).toBeDefined();
    expect(Number(pct)).toBeLessThan(40);
  }, 200_000);

  it('PASSES a page that genuinely uses the width', async () => {
    handle = handle ?? (await serveFixtures());
    const { code, out } = await measure(handle.base, '/wide.html');
    expect(out, out).toMatch(/desktop width PASS/);
    expect(code).toBe(0);
  }, 200_000);

  it('does not let a full-width footer rescue a narrow body', async () => {
    handle = handle ?? (await serveFixtures());
    const { code, out } = await measure(handle.base, '/footer-only-wide.html');
    // Header and footer legitimately span the viewport. If they counted, every
    // page on any site with a footer would pass regardless of its content.
    expect(out, out).toMatch(/FAIL/);
    expect(code).toBe(1);
  }, 200_000);
});
