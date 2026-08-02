/**
 * Known-bad / known-good fixtures for the 11 DONE-CHECKLIST checks.
 *
 * Spec: every new rule must fail on a known-bad fixture with real output, and
 * pass on a known-good fixture. A check that cannot fail is worthless.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync
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
  evaluateNotFoundStatus,
  discoverDetailRoutes,
  fillBogus
} from '../scripts/checks/u-api-not-found.mjs';
import {
  evaluateSpaMask,
  looksLikeSpaShell
} from '../scripts/checks/u-api-no-spa-mask.mjs';
import {
  compareTopic,
  TOPICS,
  runLegalClaimsTrue
} from '../scripts/checks/u-legal-claims-true.mjs';
import {
  analysePixels,
  evaluateMetrics,
  MIN_INK,
  MIN_DETAIL
} from '../scripts/checks/fe-favicon-legible.mjs';
import {
  evaluateReproduction,
  runResultReproduces
} from '../scripts/checks/lg-result-reproduces.mjs';
import {
  evaluateKnownBad,
  runMeasKnownBad
} from '../scripts/checks/meas-known-bad.mjs';
import { evaluateTwoRun, runMeasTwoRun } from '../scripts/checks/meas-two-run.mjs';
import {
  evaluateFlattering,
  runMeasRecheckFlattering
} from '../scripts/checks/meas-recheck-flattering.mjs';
import {
  evaluateStandardTool,
  runMeasStandardTool
} from '../scripts/checks/meas-standard-tool.mjs';
import {
  evaluateEngineNamed,
  runMeasEngineNamed
} from '../scripts/checks/meas-engine-named.mjs';
import { runBuildSucceeds } from '../scripts/checks/u-build-succeeds.mjs';
import { runApiNotFound } from '../scripts/checks/u-api-not-found.mjs';
import { runApiNoSpaMask } from '../scripts/checks/u-api-no-spa-mask.mjs';
import { runFaviconLegible } from '../scripts/checks/fe-favicon-legible.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CHECK_SCRIPT = join(here, '..', 'scripts', 'checks', 'check.mjs');
const node = process.execPath;
const tempDirs: string[] = [];

/**
 * Create a tracked temp app directory.
 * @returns Absolute path.
 */
function makeAppDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'redanvil-checklist-'));
  tempDirs.push(dir);
  return dir;
}

/**
 * Write a file under appDir.
 * @param appDir App root.
 * @param relPath Relative path.
 * @param body Contents.
 */
function write(appDir: string, relPath: string, body: string): void {
  const full = join(appDir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, 'utf8');
}

/**
 * Capture pass/fail/na from a check without process.exit.
 * @returns Outcome and message.
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
 * @param fn Async or sync work.
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
 * Spawn check.mjs for a rule.
 * @param ruleId Rule id.
 * @param appDir App root.
 */
function runCheck(ruleId: string, appDir: string) {
  return spawnSync(node, [CHECK_SCRIPT, ruleId, appDir], {
    encoding: 'utf8',
    env: process.env
  });
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

describe('unimplementedRows is empty', () => {
  it('returns []', () => {
    expect(unimplementedRows()).toEqual([]);
  });

  it('every new rule is in the rubric and APP_CHECKS', () => {
    const ids = [
      'u-build-succeeds',
      'u-api-not-found',
      'u-api-no-spa-mask',
      'u-legal-claims-true',
      'fe-favicon-legible',
      'lg-result-reproduces',
      'meas-known-bad',
      'meas-two-run',
      'meas-recheck-flattering',
      'meas-standard-tool',
      'meas-engine-named'
    ];
    const rubric = new Set(loadRubric().map((r) => r.id));
    const wired = new Set(APP_CHECKS.map((c) => c.ruleId));
    for (const id of ids) {
      expect(rubric.has(id), `${id} in RULES`).toBe(true);
      expect(wired.has(id), `${id} in APP_CHECKS`).toBe(true);
    }
  });
});

describe('A5 u-build-succeeds', () => {
  it('FAILS when build script exits non-zero (known-bad)', async () => {
    const app = makeAppDir();
    write(
      app,
      'package.json',
      JSON.stringify({ name: 'bad-build', scripts: { build: 'node -e "process.exit(1)"' } })
    );
    const r = await runCaptured((io) => runBuildSucceeds(app, io));
    expect(r.code).toBe(1);
    expect(r.msg).toMatch(/npm run build exited/i);
    console.log('u-build-succeeds known-bad:', r.msg.slice(0, 200));
  });

  it('PASSES when build script exits 0 (known-good)', async () => {
    const app = makeAppDir();
    write(
      app,
      'package.json',
      JSON.stringify({ name: 'good-build', scripts: { build: 'node -e "process.exit(0)"' } })
    );
    const r = await runCaptured((io) => runBuildSucceeds(app, io));
    expect(r.code).toBe(0);
  });

  it('is n/a when there is no build script', async () => {
    const app = makeAppDir();
    write(app, 'package.json', JSON.stringify({ name: 'no-build', scripts: {} }));
    const r = await runCaptured((io) => runBuildSucceeds(app, io));
    expect(r.code).toBe(3);
  });
});

describe('B3 u-api-not-found', () => {
  it('evaluateNotFoundStatus fails on 200 and 500, passes on 404', () => {
    expect(evaluateNotFoundStatus(404)).toBeNull();
    expect(evaluateNotFoundStatus(200)).toMatch(/200/);
    expect(evaluateNotFoundStatus(500)).toMatch(/500/);
    console.log('u-api-not-found known-bad (200):', evaluateNotFoundStatus(200));
  });

  it('discovers detail routes and fills bogus ids', () => {
    const app = makeAppDir();
    write(app, 'functions/api/crops/[id].ts', 'export async function onRequest() {}');
    write(app, 'functions/api/health.ts', 'export async function onRequest() {}');
    const routes = discoverDetailRoutes(app);
    expect(routes).toContain('/api/crops/[id]');
    expect(routes).not.toContain('/api/health');
    expect(fillBogus('/api/crops/[id]')).toBe('/api/crops/__no_such_id__');
  });

  it('FAILS when the runtime returns 200 for a bogus id (known-bad fixture server)', async () => {
    const app = makeAppDir();
    write(app, 'functions/api/items/[id].ts', 'export async function onRequest() {}');
    write(app, 'wrangler.toml', 'name = "t"\n');
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as AddressInfo).port;
    try {
      const r = await runCaptured((io) =>
        runApiNotFound(app, io, {
          boot: async () => ({
            baseUrl: `http://127.0.0.1:${port}`,
            cleanup: () => {},
            error: null
          })
        })
      );
      expect(r.code).toBe(1);
      expect(r.msg).toMatch(/200/);
      console.log('u-api-not-found known-bad output:', r.msg.slice(0, 300));
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('PASSES when the runtime returns 404 (known-good)', async () => {
    const app = makeAppDir();
    write(app, 'functions/api/items/[id].ts', 'export async function onRequest() {}');
    write(app, 'wrangler.toml', 'name = "t"\n');
    const server = createServer((_req, res) => {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end('{"error":"not found"}');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as AddressInfo).port;
    try {
      const r = await runCaptured((io) =>
        runApiNotFound(app, io, {
          boot: async () => ({
            baseUrl: `http://127.0.0.1:${port}`,
            cleanup: () => {},
            error: null
          })
        })
      );
      expect(r.code).toBe(0);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});

describe('B5 u-api-no-spa-mask', () => {
  it('detects SPA shell bodies', () => {
    expect(looksLikeSpaShell('<!doctype html><div id="root"></div>')).toBe(true);
    expect(looksLikeSpaShell('{"error":"not found"}')).toBe(false);
    const bad = evaluateSpaMask(200, '<!doctype html><html><div id="root"></div>');
    expect(bad).toMatch(/SPA|200/i);
    console.log('u-api-no-spa-mask known-bad:', bad);
  });

  it('FAILS when absent API path returns SPA HTML (known-bad)', async () => {
    const app = makeAppDir();
    write(app, 'wrangler.toml', 'name = "t"\n');
    write(app, 'functions/api/health.ts', 'export async function onRequest() {}');
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><html><body><div id="root"></div></body></html>');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as AddressInfo).port;
    try {
      const r = await runCaptured((io) =>
        runApiNoSpaMask(app, io, {
          boot: async () => ({
            baseUrl: `http://127.0.0.1:${port}`,
            cleanup: () => {},
            error: null
          }),
          path: '/api/__definitely_absent_test'
        })
      );
      expect(r.code).toBe(1);
      expect(r.msg).toMatch(/SPA|200/i);
      console.log('u-api-no-spa-mask known-bad output:', r.msg.slice(0, 300));
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('PASSES when absent path returns 404 JSON (known-good)', async () => {
    const app = makeAppDir();
    write(app, 'wrangler.toml', 'name = "t"\n');
    write(app, 'functions/api/health.ts', 'export async function onRequest() {}');
    const server = createServer((_req, res) => {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end('{"error":"missing"}');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as AddressInfo).port;
    try {
      const r = await runCaptured((io) =>
        runApiNoSpaMask(app, io, {
          boot: async () => ({
            baseUrl: `http://127.0.0.1:${port}`,
            cleanup: () => {},
            error: null
          }),
          path: '/api/__definitely_absent_test'
        })
      );
      expect(r.code).toBe(0);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});

describe('D4 u-legal-claims-true', () => {
  it('FAILS when copy denies cookies but code sets them (known-bad)', async () => {
    const app = makeAppDir();
    write(
      app,
      'src/pages/Privacy.tsx',
      'export default function Privacy() { return <p>We do not use cookies on this site.</p>; }'
    );
    write(
      app,
      'src/lib/track.ts',
      'export function setPref() { document.cookie = "pref=1; path=/"; }'
    );
    const r = await runCaptured((io) => runLegalClaimsTrue(app, io));
    expect(r.code).toBe(1);
    expect(r.msg).toMatch(/cookies/i);
    console.log('u-legal-claims-true known-bad:', r.msg.slice(0, 300));
  });

  it('PASSES when disclosure matches code (known-good)', async () => {
    const app = makeAppDir();
    write(
      app,
      'src/pages/Privacy.tsx',
      'export default function Privacy() { return <p>We use cookies to remember theme preference. We do not process payments. No accounts required.</p>; }'
    );
    write(app, 'src/lib/theme.ts', 'export function setTheme() { document.cookie = "theme=dark"; }');
    const r = await runCaptured((io) => runLegalClaimsTrue(app, io));
    expect(r.code).toBe(0);
  });

  it('compareTopic pure mismatch for undisclosed analytics', () => {
    const topic = TOPICS.find((t) => t.id === 'analytics')!;
    const m = compareTopic(
      topic,
      'This privacy policy is short. We care about privacy.',
      [{ path: 'src/App.tsx', text: "gtag('config', 'G-XXXX');" }]
    );
    expect(m).toMatch(/analytics/i);
  });
});

describe('D7 fe-favicon-legible', () => {
  it('FAILS on empty / solid / low-detail pixels (known-bad)', () => {
    const empty = new Uint8ClampedArray(32 * 32 * 4); // fully transparent
    const emptyM = analysePixels(empty, 32, 32);
    const emptyReasons = evaluateMetrics(emptyM);
    expect(emptyReasons.some((r) => /ink coverage/i.test(r))).toBe(true);
    console.log('fe-favicon-legible known-bad empty:', emptyReasons.join('; '));

    const solid = new Uint8ClampedArray(32 * 32 * 4);
    for (let i = 0; i < 32 * 32; i++) {
      solid[i * 4] = 20;
      solid[i * 4 + 1] = 20;
      solid[i * 4 + 2] = 20;
      solid[i * 4 + 3] = 255;
    }
    const solidM = analysePixels(solid, 32, 32);
    const solidReasons = evaluateMetrics(solidM);
    expect(solidReasons.length).toBeGreaterThan(0);
    console.log('fe-favicon-legible known-bad solid:', solidReasons.join('; '));
    expect(solidM.inkCoverage).toBeGreaterThan(MIN_INK);
    expect(solidM.detailEnergy).toBeLessThan(MIN_DETAIL + 50); // uniform is low detail
  });

  it('PASSES a high-contrast geometric mark (known-good)', async () => {
    // Checkerboard of saturated blue ink -- edges for detail, colour that
    // contrasts with both a white tab and a near-black tab (pure black ink
    // vanishes on dark chrome and would fail the worst-contrast floor).
    const rgba = new Uint8ClampedArray(32 * 32 * 4);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const i = (y * 32 + x) * 4;
        const on = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
        if (on) {
          rgba[i] = 30;
          rgba[i + 1] = 120;
          rgba[i + 2] = 255;
          rgba[i + 3] = 255;
        } else {
          rgba[i] = 0;
          rgba[i + 1] = 0;
          rgba[i + 2] = 0;
          rgba[i + 3] = 0;
        }
      }
    }
    const m = analysePixels(rgba, 32, 32);
    const reasons = evaluateMetrics(m);
    expect(reasons, reasons.join('; ')).toEqual([]);

    const app = makeAppDir();
    const r = await runCaptured((io) =>
      runFaviconLegible(app, io, { pixels: { rgba, width: 32, height: 32 } })
    );
    expect(r.code).toBe(0);
  });
});

describe('F4 lg-result-reproduces', () => {
  it('FAILS when finalScore does not match recomputed score (known-bad)', async () => {
    const app = makeAppDir();
    const rules = loadRubric().map((r) => ({ ruleId: r.id, passed: true }));
    // Claim 99 while all-pass recomputes to 100.
    const result = {
      kind: 'results',
      slug: 'fixture',
      finalScore: 99,
      threshold: 90,
      rules,
      provenance: {
        commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        notApplicable: []
      }
    };
    write(app, 'results/fixture.json', JSON.stringify(result));
    write(app, '.redanvil/claims.json', JSON.stringify({ slug: 'fixture' }));
    const r = await runCaptured((io) =>
      runResultReproduces(app, io, {
        head: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        recompute: () => ({ score: 100, blockers: [], rubricIds: rules.map((x) => x.ruleId) })
      })
    );
    expect(r.code).toBe(1);
    expect(r.msg).toMatch(/finalScore|recomput/i);
    console.log('lg-result-reproduces known-bad:', r.msg.slice(0, 300));
  });

  it('PASSES when score and commit match (known-good)', async () => {
    const app = makeAppDir();
    const rules = loadRubric().map((r) => ({ ruleId: r.id, passed: true }));
    const result = {
      kind: 'results',
      slug: 'fixture',
      finalScore: 100,
      threshold: 90,
      rules,
      provenance: {
        commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        notApplicable: []
      }
    };
    write(app, 'results/fixture.json', JSON.stringify(result));
    write(app, '.redanvil/claims.json', JSON.stringify({ slug: 'fixture' }));
    const r = await runCaptured((io) =>
      runResultReproduces(app, io, {
        head: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        recompute: () => ({ score: 100, blockers: [], rubricIds: rules.map((x) => x.ruleId) })
      })
    );
    expect(r.code).toBe(0);
  });

  it('evaluateReproduction flags invented rule ids', () => {
    const failures = evaluateReproduction(
      {
        finalScore: 100,
        rules: [{ ruleId: 'totally-fake-rule', passed: true }],
        provenance: { commit: 'c'.repeat(40) }
      },
      { score: 100, rubricIds: ['u-test-presence'] },
      'c'.repeat(40)
    );
    expect(failures.some((f) => /invented/i.test(f))).toBe(true);
  });
});

describe('G1–G5 measurement provenance', () => {
  it('G1 FAILSwhen knownBad is missing (known-bad)', () => {
    const failures = evaluateKnownBad({}, ['u-build-succeeds'], () => Date.now());
    expect(failures[0]).toMatch(/no knownBad/);
    console.log('meas-known-bad known-bad:', failures[0]);
  });

  it('G1 PASSES when knownBad is recorded and fresh (known-good)', async () => {
    const app = makeAppDir();
    const future = new Date(Date.now() + 60_000).toISOString();
    const meta: Record<string, object> = {};
    for (const id of [
      'u-build-succeeds',
      'u-api-not-found',
      'u-api-no-spa-mask',
      'u-legal-claims-true',
      'fe-favicon-legible',
      'lg-result-reproduces',
      'meas-known-bad',
      'meas-two-run',
      'meas-recheck-flattering',
      'meas-standard-tool',
      'meas-engine-named',
      'fe-light-dark',
      'fe-search-present',
      'u-api-real-output'
    ]) {
      meta[id] = {
        knownBad: { input: 'fixture', failed: true, recordedAt: future }
      };
    }
    write(app, 'evidence/measurement-meta.json', JSON.stringify(meta));
    const r = await runCaptured((io) =>
      runMeasKnownBad(app, io, { rerun: false })
    );
    expect(r.code).toBe(0);
  });

  it('G2 FAILS when runs disagree (known-bad)', () => {
    const failures = evaluateTwoRun(
      {
        'fe-light-dark': { runs: [{ ok: true }, { ok: false }] },
        'fe-search-present': { runs: [{ ok: true }, { ok: true }] },
        'fe-favicon-legible': { runs: [{ ok: true }, { ok: true }] }
      },
      ['fe-light-dark', 'fe-search-present', 'fe-favicon-legible']
    );
    expect(failures.some((f) => /disagree/i.test(f))).toBe(true);
    console.log('meas-two-run known-bad:', failures.find((f) => /disagree/i.test(f)));
  });

  it('G2 PASSES when two runs agree (known-good)', async () => {
    const app = makeAppDir();
    write(
      app,
      'evidence/measurement-meta.json',
      JSON.stringify({
        'fe-light-dark': { engine: 'chromium', runs: [{ ok: true }, { ok: true }] },
        'fe-search-present': { engine: 'chromium', runs: [{ ok: true }, { ok: true }] },
        'fe-favicon-legible': { engine: 'chromium', runs: [{ ok: true }, { ok: true }] }
      })
    );
    const r = await runCaptured((io) => runMeasTwoRun(app, io));
    expect(r.code).toBe(0);
  });

  it('G3 FAILS on flattering fail→pass with one run (known-bad)', () => {
    const failures = evaluateFlattering(
      { 'fe-light-dark': { runs: [{ ok: true }] } },
      [{ ruleId: 'fe-light-dark', passed: false }]
    );
    expect(failures[0]).toMatch(/fail→pass|two agreeing/i);
    console.log('meas-recheck-flattering known-bad:', failures[0]);
  });

  it('G3 PASSES when flip has two agreeing runs (known-good)', async () => {
    const app = makeAppDir();
    write(
      app,
      'evidence/measurement-meta.json',
      JSON.stringify({
        'fe-light-dark': { runs: [{ ok: true }, { ok: true }] }
      })
    );
    const r = await runCaptured((io) =>
      runMeasRecheckFlattering(app, io, {
        prevRules: [{ ruleId: 'fe-light-dark', passed: false }]
      })
    );
    expect(r.code).toBe(0);
  });

  it('G4 FAILS when contrast tool is hand-rolled (known-bad)', () => {
    const failures = evaluateStandardTool(
      {
        'fe-a11y-contrast': { tool: 'hand-rolled-getComputedStyle' }
      },
      ['fe-a11y-contrast']
    );
    expect(failures.length).toBeGreaterThan(0);
    console.log('meas-standard-tool known-bad:', failures[0]);
  });

  it('G4 PASSES when tool is axe-core (known-good)', async () => {
    const app = makeAppDir();
    write(
      app,
      'evidence/measurement-meta.json',
      JSON.stringify({
        'fe-a11y-contrast': { tool: 'axe-core', engine: 'chromium', runs: [{ ok: true }, { ok: true }] }
      })
    );
    const r = await runCaptured((io) => runMeasStandardTool(app, io));
    expect(r.code).toBe(0);
  });

  it('G5 FAILS when engine is missing (known-bad)', () => {
    const failures = evaluateEngineNamed(
      {
        'fe-light-dark': { runs: [{ ok: true }, { ok: true }] },
        'fe-search-present': { engine: 'chromium', runs: [{ ok: true }, { ok: true }] },
        'fe-favicon-legible': { engine: 'chromium', runs: [{ ok: true }, { ok: true }] }
      },
      ['fe-light-dark', 'fe-search-present', 'fe-favicon-legible']
    );
    expect(failures.some((f) => /engine not recorded/i.test(f))).toBe(true);
    console.log('meas-engine-named known-bad:', failures.find((f) => /engine/i.test(f)));
  });

  it('G5 PASSES when engines are named (known-good)', async () => {
    const app = makeAppDir();
    write(
      app,
      'evidence/measurement-meta.json',
      JSON.stringify({
        'fe-light-dark': { engine: 'chromium', runs: [{ ok: true }, { ok: true }] },
        'fe-search-present': { engine: 'webkit', runs: [{ ok: true }, { ok: true }] },
        'fe-favicon-legible': { engine: 'chromium', runs: [{ ok: true }, { ok: true }] }
      })
    );
    const r = await runCaptured((io) => runMeasEngineNamed(app, io));
    expect(r.code).toBe(0);
  });
});

describe('check.mjs dispatches the new rules', () => {
  it('u-build-succeeds fails through check.mjs on known-bad', () => {
    const app = makeAppDir();
    write(
      app,
      'package.json',
      JSON.stringify({ name: 'x', scripts: { build: 'node -e "process.exit(1)"' } })
    );
    const r = runCheck('u-build-succeeds', app);
    expect(r.status).toBe(1);
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    expect(out).toMatch(/npm run build exited/i);
    console.log('check.mjs u-build-succeeds known-bad tail:', out.slice(-200));
  });

  it('u-legal-claims-true fails through check.mjs on known-bad', () => {
    const app = makeAppDir();
    write(
      app,
      'src/pages/Privacy.tsx',
      'export default function P() { return <p>We do not use cookies.</p>; }'
    );
    write(app, 'src/a.ts', 'document.cookie = "x=1";');
    const r = runCheck('u-legal-claims-true', app);
    expect(r.status).toBe(1);
    console.log(
      'check.mjs u-legal-claims-true known-bad tail:',
      `${r.stdout ?? ''}${r.stderr ?? ''}`.slice(-250)
    );
  });
});
