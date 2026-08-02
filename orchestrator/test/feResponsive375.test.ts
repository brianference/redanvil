/**
 * Binds fe-responsive-375 element-level truncation (design_audit.mjs) to
 * fixtures with known answers.
 *
 * The old check only compared document.body.scrollWidth to the viewport, so
 * ellipsis and line-clamp passed while labels were clipped. These fixtures
 * prove the extended check FAILs real truncation and PASSES clean layout,
 * and that sr-only + deliberate scroll containers are excluded.
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
const SCRIPT = join(repoRoot, '.github', 'scripts', 'design_audit.mjs');
const FIXTURES = join(here, 'fixtures', 'responsive-375');

/**
 * Serve one HTML file as every path so design_audit's `/` + routes all hit it.
 *
 * @param fileName - Fixture file under fixtures/responsive-375.
 * @returns Base URL and close function.
 */
function serveAsIndex(fileName: string): Promise<{ base: string; close: () => void }> {
  return new Promise((resolve) => {
    const htmlPath = join(FIXTURES, fileName);
    const server: Server = createServer((req, res) => {
      const path = (req.url ?? '/').split('?')[0] ?? '/';
      // Same body for every route so required-pages / multi-route passes do not
      // pollute the responsive measurement with 404 shells.
      if (!existsSync(htmlPath)) {
        res.writeHead(404).end('not found');
        return;
      }
      void path;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(readFileSync(htmlPath));
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ base: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

/**
 * Run design_audit; only the fe-responsive-375 line is asserted by callers.
 *
 * @param base - Origin of the fixture server.
 * @returns Exit code and combined output.
 */
function runAudit(base: string): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      SCRIPT,
      base,
      '--routes',
      '/about,/contact,/terms,/privacy'
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

/** Open servers to close after the suite. */
const closers: Array<() => void> = [];

afterAll(() => {
  for (const c of closers) c();
});

describe('fe-responsive-375 element-level truncation', () => {
  it('FAILS a page with ellipsised zone label and line-clamped subtitle', async () => {
    const handle = await serveAsIndex('truncated.html');
    closers.push(handle.close);
    const { out } = await runAudit(handle.base);
    const line = out.split('\n').find((l) => l.includes('fe-responsive-375')) ?? '';
    expect(line, out).toMatch(/FAIL\s+fe-responsive-375/);
    expect(out, out).toMatch(/zone-selector__label/);
    expect(out, out).toMatch(/hero__subtitle/);
    // Must not blame the deliberate scroll container or the sr-only theme text
    expect(out).not.toMatch(/year-grid-scroll/);
    expect(out).not.toMatch(/theme-toggle__sr-only/);
  }, 120_000);

  it('PASSES a clean page with wrapping text and a horizontal scroll grid', async () => {
    const handle = await serveAsIndex('clean.html');
    closers.push(handle.close);
    const { out } = await runAudit(handle.base);
    const line = out.split('\n').find((l) => l.includes('fe-responsive-375')) ?? '';
    expect(line, out).toMatch(/ok\s+fe-responsive-375/);
  }, 120_000);
});
