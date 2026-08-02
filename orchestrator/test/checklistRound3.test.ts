/**
 * Known-bad / known-good fixtures for SPEC-checklist-round3 rules.
 *
 * Every new rule must fail on a known-bad fixture (real output, non-zero exit)
 * and pass on a known-good fixture. unimplementedRows() must stay [].
 *
 * Also extends fe-responsive-375 for placeholder clipping (not a new row).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync
} from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { unimplementedRows } from '../src/done/coverage.mjs';
import { loadRubric } from '../src/rubric/index';
import { APP_CHECKS } from '../src/commands/gate';
import {
  BROWSER_DRIVEN_RULES,
  RULES_REQUIRING_KNOWN_BAD
} from '../scripts/lib/measurement-meta.mjs';
import {
  BROWSER_UA,
  evaluatePageLinks,
  isItemDetailPath,
  probeExternalLink,
  runResourceLinks
} from '../scripts/checks/fe-resource-links.mjs';
import {
  evaluateViewportResult,
  runResultInViewport
} from '../scripts/checks/fe-result-in-viewport.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CHECK_SCRIPT = join(here, '..', 'scripts', 'checks', 'check.mjs');
const node = process.execPath;
const tempDirs: string[] = [];

const NEW_RULES = ['fe-resource-links', 'fe-result-in-viewport'] as const;

/**
 * Create a tracked temp directory.
 * @returns Absolute path.
 */
function makeTempDir(prefix = 'redanvil-r3-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/**
 * Write a file under dir.
 * @param dir Root.
 * @param relPath Relative path.
 * @param body Contents.
 */
function write(dir: string, relPath: string, body: string): void {
  const full = join(dir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, 'utf8');
}

/**
 * Capture pass/fail/na without process.exit.
 * @returns io + result holder.
 */
function captureIo(): {
  io: {
    pass: () => never;
    fail: (m?: string) => never;
    notApplicable: (w?: string) => never;
    infra: (m?: string) => never;
  };
  result: { code: number; msg: string };
} {
  const result = { code: -1, msg: '' };
  const io = {
    pass: () => {
      result.code = 0;
      throw { __done: true };
    },
    fail: (m?: string) => {
      result.code = 1;
      result.msg = m ?? '';
      throw { __done: true };
    },
    notApplicable: (w?: string) => {
      result.code = 3;
      result.msg = w ?? '';
      throw { __done: true };
    },
    infra: (m?: string) => {
      result.code = 2;
      result.msg = m ?? '';
      throw { __done: true };
    }
  };
  return { io, result };
}

/**
 * Run a check function that uses never-returning io.
 * @param fn Work.
 * @returns code and message.
 */
async function runCaptured(
  fn: (io: ReturnType<typeof captureIo>['io']) => void | Promise<void>
): Promise<{ code: number; msg: string }> {
  const { io, result } = captureIo();
  try {
    await fn(io);
  } catch (e) {
    if (!(e && typeof e === 'object' && '__done' in e)) throw e;
  }
  return result;
}

/**
 * Local HTTP server for link-probe proofs.
 *
 * Routes:
 *  - /ok → 200
 *  - /missing → 404
 *  - /bot-gate → 403 without browser UA, 200 with BROWSER_UA
 *
 * @returns base URL and close.
 */
function startProbeServer(): Promise<{ base: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const path = (req.url ?? '/').split('?')[0] ?? '/';
      const ua = req.headers['user-agent'] ?? '';
      if (path === '/ok') {
        res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
        return;
      }
      if (path === '/missing') {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
        return;
      }
      if (path === '/bot-gate') {
        // Mimic almanac.com: bare agents get 403, browser UA gets 200.
        if (ua.includes('Mozilla/5.0') && ua.includes('Chrome')) {
          res.writeHead(200, { 'content-type': 'text/plain' }).end('browser ok');
        } else {
          res.writeHead(403, { 'content-type': 'text/plain' }).end('bot blocked');
        }
        return;
      }
      res.writeHead(404).end('nope');
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      // Report as `localhost` so fixture pages served on 127.0.0.1 treat these
      // as a different host (external), matching production guide links.
      resolve({
        base: `http://localhost:${addr.port}`,
        close: () =>
          new Promise((r) => {
            server.close(() => r());
          })
      });
    });
  });
}

/**
 * Materialise a fixture dir with link placeholders replaced.
 * @param srcDir Source fixture template dir.
 * @param replacements href placeholder → URL.
 * @returns Temp fixture dir path.
 */
function materialiseFixtureDir(
  srcDir: string,
  replacements: Record<string, string>
): string {
  const dest = makeTempDir('r3-fix-');
  for (const name of ['crop__tomato.html']) {
    const src = join(srcDir, name);
    let html = readFileSync(src, 'utf8');
    for (const [token, url] of Object.entries(replacements)) {
      html = html.split(token).join(url);
    }
    writeFileSync(join(dest, name), html, 'utf8');
  }
  return dest;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) break;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
});

describe('checklist round3 registration', () => {
  it('unimplementedRows is still empty', () => {
    expect(unimplementedRows()).toEqual([]);
  });

  it('every new rule is in the rubric and APP_CHECKS', () => {
    const rubric = new Set(loadRubric().map((r) => r.id));
    const wired = new Set(APP_CHECKS.map((c) => c.ruleId));
    for (const id of NEW_RULES) {
      expect(rubric.has(id), `${id} in RULES`).toBe(true);
      expect(wired.has(id), `${id} in APP_CHECKS`).toBe(true);
    }
  });

  it('new rules are listed for known-bad / browser provenance', () => {
    for (const id of NEW_RULES) {
      expect(RULES_REQUIRING_KNOWN_BAD).toContain(id);
      expect(BROWSER_DRIVEN_RULES).toContain(id);
    }
  });
});

describe('D11 fe-resource-links', () => {
  it('classifies item detail paths (pure helper)', () => {
    expect(isItemDetailPath('/crop/tomato')).toBe(true);
    expect(isItemDetailPath('/crops/:id')).toBe(true);
    expect(isItemDetailPath('/plants/[slug]')).toBe(true);
    expect(isItemDetailPath('/about')).toBe(false);
    expect(isItemDetailPath('/')).toBe(false);
    expect(isItemDetailPath('/privacy')).toBe(false);
  });

  it('evaluatePageLinks FAILS when the only external URL is dead', () => {
    const probes = new Map([
      ['https://example.invalid/missing', { ok: false, status: 404 as number | null }]
    ]);
    const r = evaluatePageLinks('/crop/tomato', ['https://example.invalid/missing'], probes);
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toMatch(/dead link|HTTP 404/i);
    console.log('fe-resource-links pure known-bad:', r.failures[0]);
  });

  it('evaluatePageLinks PASSES when external URL resolves', () => {
    const probes = new Map([
      ['https://example.com/guide', { ok: true, status: 200 as number | null }]
    ]);
    const r = evaluatePageLinks('/crop/tomato', ['https://example.com/guide'], probes);
    expect(r.ok).toBe(true);
  });

  it('evaluatePageLinks FAILS when page has no external link', () => {
    const r = evaluatePageLinks('/crop/basil', [], new Map());
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toMatch(/no external link/i);
  });

  it('probeExternalLink: dead URL path fires (real 404)', async () => {
    const server = await startProbeServer();
    try {
      const cache = new Map();
      const dead = await probeExternalLink(`${server.base}/missing`, cache);
      expect(dead.ok).toBe(false);
      expect(dead.status).toBe(404);
      console.log('fe-resource-links dead-link probe:', JSON.stringify(dead));

      const live = await probeExternalLink(`${server.base}/ok`, cache);
      expect(live.ok).toBe(true);
      expect(live.status).toBe(200);

      // Cache hit: second call does not re-fetch (map size stays 2 after third probe of same URL)
      await probeExternalLink(`${server.base}/ok`, cache);
      expect(cache.size).toBe(2);
    } finally {
      await server.close();
    }
  });

  it('probeExternalLink: browser UA avoids false 403 (bot-gate host)', async () => {
    const server = await startProbeServer();
    try {
      // Bare agent (no browser UA) would see 403 from this host.
      const bare = await fetch(`${server.base}/bot-gate`, {
        headers: { 'user-agent': 'curl/8.0' },
        signal: AbortSignal.timeout(5_000)
      });
      expect(bare.status).toBe(403);
      console.log('fe-resource-links bare-agent status:', bare.status);

      const cache = new Map();
      const withBrowser = await probeExternalLink(`${server.base}/bot-gate`, cache);
      expect(withBrowser.ok).toBe(true);
      expect(withBrowser.status).toBe(200);
      expect(BROWSER_UA).toMatch(/Mozilla\/5\.0/);
      console.log('fe-resource-links browser-UA status:', withBrowser.status);
    } finally {
      await server.close();
    }
  });

  it('FAILS fixture page whose external link really 404s (known-bad, Playwright)', async () => {
    const server = await startProbeServer();
    try {
      const fixtureDir = materialiseFixtureDir(join(here, 'fixtures/resource-links/bad'), {
        __DEAD_LINK__: `${server.base}/missing`
      });
      const app = makeTempDir();
      const r = await runCaptured((io) =>
        runResourceLinks(app, io, { fixtureDir })
      );
      expect(r.code).toBe(1);
      expect(r.msg).toMatch(/dead link|HTTP 404|FAIL/i);
      console.log('fe-resource-links known-bad fixture:', r.msg.slice(0, 300));
    } finally {
      await server.close();
    }
  }, 120_000);

  it('PASSES fixture page whose external link returns 200 (known-good)', async () => {
    const server = await startProbeServer();
    try {
      const fixtureDir = materialiseFixtureDir(join(here, 'fixtures/resource-links/good'), {
        __LIVE_LINK__: `${server.base}/ok`
      });
      const app = makeTempDir();
      const r = await runCaptured((io) =>
        runResourceLinks(app, io, { fixtureDir })
      );
      expect(r.code).toBe(0);
      console.log('fe-resource-links known-good exit:', r.code);
    } finally {
      await server.close();
    }
  }, 120_000);

  it('FAILS fixture with no external link at all', async () => {
    const fixtureDir = join(here, 'fixtures/resource-links/no-link');
    const app = makeTempDir();
    const r = await runCaptured((io) => runResourceLinks(app, io, { fixtureDir }));
    expect(r.code).toBe(1);
    expect(r.msg).toMatch(/no external link/i);
    console.log('fe-resource-links no-link:', r.msg.slice(0, 200));
  }, 120_000);

  it('dispatches through check.mjs', () => {
    // Empty app with no detail routes → n/a (exit 3), proves the case is wired.
    const app = makeTempDir();
    write(app, 'src/App.tsx', 'export default function App(){ return null }');
    const r = spawnSync(node, [CHECK_SCRIPT, 'fe-resource-links', app], {
      encoding: 'utf8',
      env: process.env
    });
    expect([0, 1, 3]).toContain(r.status);
    // Not "unknown rule"
    expect(r.stderr ?? '').not.toMatch(/unknown rule/);
    console.log('fe-resource-links check.mjs exit:', r.status, (r.stderr || r.stdout || '').slice(0, 120));
  }, 60_000);
});

describe('C10 fe-result-in-viewport', () => {
  it('evaluateViewportResult FAILS when nearest change is below the fold (known-bad pure)', () => {
    const before = {
      signature: '10:Tomato|20:Basil',
      items: [
        { y: 10, text: 'Tomato', tag: 'li' },
        { y: 20, text: 'Basil', tag: 'li' }
      ]
    };
    const after = {
      signature: '1942:Tomato',
      items: [{ y: 1942, text: 'Tomato', tag: 'li' }]
    };
    const r = evaluateViewportResult({
      before,
      after,
      viewportHeight: 900,
      scrollY: 0
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/below the fold|y=1942/i);
    expect(r.nearestY).toBe(1942);
    console.log('fe-result-in-viewport pure known-bad:', r.reason);
  });

  it('evaluateViewportResult PASSES when change is in the first viewport (known-good pure)', () => {
    const before = {
      signature: '80:Tomato|120:Basil|160:Pepper',
      items: [
        { y: 80, text: 'Tomato', tag: 'li' },
        { y: 120, text: 'Basil', tag: 'li' },
        { y: 160, text: 'Pepper', tag: 'li' }
      ]
    };
    const after = {
      signature: '80:Tomato',
      items: [{ y: 80, text: 'Tomato', tag: 'li' }]
    };
    const r = evaluateViewportResult({
      before,
      after,
      viewportHeight: 900,
      scrollY: 0
    });
    expect(r.ok).toBe(true);
    expect(r.nearestY).toBe(80);
  });

  it('FAILS fixture with results far below the fold (known-bad, Playwright)', async () => {
    const app = makeTempDir();
    const fixture = join(here, 'fixtures/result-in-viewport/below-fold.html');
    const r = await runCaptured((io) =>
      runResultInViewport(app, io, { fixture })
    );
    expect(r.code).toBe(1);
    expect(r.msg).toMatch(/below the fold|FAIL|y=/i);
    console.log('fe-result-in-viewport known-bad fixture:', r.msg.slice(0, 350));
  }, 120_000);

  it('PASSES fixture with results in the first viewport (known-good)', async () => {
    const app = makeTempDir();
    const fixture = join(here, 'fixtures/result-in-viewport/in-view.html');
    const r = await runCaptured((io) =>
      runResultInViewport(app, io, { fixture })
    );
    expect(r.code).toBe(0);
    console.log('fe-result-in-viewport known-good exit:', r.code);
  }, 120_000);

  it('dispatches through check.mjs', () => {
    const app = makeTempDir();
    write(app, 'src/App.tsx', 'export default function App(){ return null }');
    const r = spawnSync(node, [CHECK_SCRIPT, 'fe-result-in-viewport', app], {
      encoding: 'utf8',
      env: process.env,
      timeout: 90_000
    });
    expect([0, 1, 2, 3]).toContain(r.status);
    expect(r.stderr ?? '').not.toMatch(/unknown rule/);
    console.log(
      'fe-result-in-viewport check.mjs exit:',
      r.status,
      (r.stderr || r.stdout || '').slice(0, 120)
    );
  }, 120_000);
});

describe('fe-responsive-375 placeholder extension', () => {
  it('truncated fixture includes a narrow placeholder field', () => {
    const html = readFileSync(
      join(here, 'fixtures/responsive-375/truncated.html'),
      'utf8'
    );
    expect(html).toMatch(/placeholder="Find a crop by name/);
    expect(html).toMatch(/width:\s*140px/);
  });

  it('clean fixture has a full-width short placeholder', () => {
    const html = readFileSync(join(here, 'fixtures/responsive-375/clean.html'), 'utf8');
    expect(html).toMatch(/placeholder="Find a crop"/);
  });
});
