/**
 * Known-bad / known-good fixtures for SPEC-checklist-round2 rules.
 *
 * Every new rule must fail on a known-bad fixture (real output, non-zero exit)
 * and pass on a known-good fixture. unimplementedRows() must stay [].
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
  evaluateDesignOptions,
  runDesignOptions
} from '../scripts/checks/proc-design-options.mjs';
import {
  evaluateBreadcrumbHtml,
  runBreadcrumbs
} from '../scripts/checks/fe-breadcrumbs.mjs';
import {
  evaluateLegalPage,
  evaluateLegalSubstance,
  MIN_WORDS,
  MIN_H2,
  TERMS_TOPICS,
  PRIVACY_TOPICS,
  runLegalSubstance
} from '../scripts/checks/fe-legal-substance.mjs';
import {
  evaluateStructuredData,
  runStructuredData
} from '../scripts/checks/fe-structured-data.mjs';
import {
  parseWranglerBindings,
  detectMissingBinding,
  evaluateBindingProbes,
  runBindingsBound
} from '../scripts/checks/lg-bindings-bound.mjs';
import {
  evaluateMarkHeights,
  MIN_HEIGHT_1280,
  MIN_HEIGHT_375,
  runBrandMarkSize
} from '../scripts/checks/fe-brand-mark-size.mjs';
import {
  BROWSER_DRIVEN_RULES,
  RULES_REQUIRING_KNOWN_BAD
} from '../scripts/lib/measurement-meta.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CHECK_SCRIPT = join(here, '..', 'scripts', 'checks', 'check.mjs');
const node = process.execPath;
const tempDirs: string[] = [];

const NEW_RULES = [
  'fe-breadcrumbs',
  'proc-design-options',
  'fe-legal-substance',
  'fe-structured-data',
  'lg-bindings-bound',
  'fe-brand-mark-size'
] as const;

/**
 * Create a tracked temp app directory.
 * @returns Absolute path.
 */
function makeAppDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'redanvil-r2-'));
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
 * Spawn check.mjs.
 * @param ruleId Rule id.
 * @param appDir App root.
 */
function runCheck(ruleId: string, appDir: string) {
  return spawnSync(node, [CHECK_SCRIPT, ruleId, appDir], {
    encoding: 'utf8',
    env: process.env
  });
}

/**
 * Build a legal page that meets floors and topics.
 * @param kind terms or privacy.
 * @returns HTML string.
 */
function buildLegalHtml(kind: 'terms' | 'privacy'): string {
  const topics = kind === 'terms' ? TERMS_TOPICS : PRIVACY_TOPICS;
  const termsSeed =
    'Users accept these terms and eligibility rules. The service is a planting calendar. ' +
    'We disclaim all implied warranties. Acceptable use forbids abuse of the system. ' +
    'Intellectual property in the product remains with us. Third-party services may apply. ' +
    'Warranties are limited and the service is provided as is. Limitation of liability applies to all claims. ' +
    'You indemnify us against misuse. Availability of the service may change and we may modify the service. ' +
    'Termination of access is possible. Changes to these terms may occur at any time. ' +
    'Governing law and jurisdiction are stated below. Contact us at legal@example.com for questions.';
  const privacySeed =
    'Who we are: Demo Inc operates this site. Contact privacy@example.com. Accounts are optional for saved lists. ' +
    'Information we collect includes usage events you submit. We do not collect payment card numbers. ' +
    'Why we collect data: to run the product. Processors and third-party service providers host infrastructure. ' +
    'Cookies or local storage may store theme preference. Data location and transfers stay in the region of the host. ' +
    'Retention and deletion: you may request deletion of stored rows. Your rights include access requests. ' +
    'Children under 13 should not use the service. Security safeguards include encryption in transit. ' +
    'Changes to this policy will be posted on this page. Contact us for privacy requests.';
  const sections = topics.map(([id]) => {
    const seed = kind === 'terms' ? termsSeed : privacySeed;
    return `<h2>${id}</h2><p>This section covers ${id}. ${seed}</p>`;
  });
  // Pad to clear the word floor.
  const padWord = 'content ';
  const pad = padWord.repeat(Math.ceil((MIN_WORDS + 50) / 1));
  // Ensure ≥ MIN_H2 (topics already provide 14).
  while (sections.length < MIN_H2) {
    sections.push(`<h2>Extra section ${sections.length + 1}</h2><p>${padWord.repeat(20)}</p>`);
  }
  return `<!doctype html><html><body><article>${sections.join('\n')}<p>${pad}</p></article></body></html>`;
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

describe('checklist round2 registration', () => {
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

  it('new rules are listed for known-bad / browser provenance where required', () => {
    for (const id of NEW_RULES) {
      expect(RULES_REQUIRING_KNOWN_BAD).toContain(id);
    }
    expect(BROWSER_DRIVEN_RULES).toContain('fe-breadcrumbs');
    expect(BROWSER_DRIVEN_RULES).toContain('fe-brand-mark-size');
  });
});

describe('C8 fe-breadcrumbs', () => {
  it('FAILS when inner page has no breadcrumb nav (known-bad)', () => {
    const html = readFileSync(join(here, 'fixtures/breadcrumbs/bad-about.html'), 'utf8');
    const ev = evaluateBreadcrumbHtml(html);
    expect(ev.ok).toBe(false);
    expect(ev.reason).toMatch(/breadcrumb/i);
    console.log('fe-breadcrumbs known-bad:', ev.reason);
  });

  it('PASSES when breadcrumb nav has a parent link (known-good)', () => {
    const html = readFileSync(join(here, 'fixtures/breadcrumbs/good-about.html'), 'utf8');
    const ev = evaluateBreadcrumbHtml(html);
    expect(ev.ok).toBe(true);
  });

  it('FAILS through runBreadcrumbs on fixture-dir known-bad', async () => {
    const dir = makeAppDir();
    write(
      dir,
      'about.html',
      readFileSync(join(here, 'fixtures/breadcrumbs/bad-about.html'), 'utf8')
    );
    write(dir, 'index.html', '<html><body><h1>Home</h1></body></html>');
    const r = await runCaptured((io) => runBreadcrumbs(dir, io, { fixtureDir: dir }));
    expect(r.code).toBe(1);
    expect(r.msg).toMatch(/breadcrumb/i);
    console.log('fe-breadcrumbs run known-bad:', r.msg.slice(0, 250));
  });

  it('PASSES through runBreadcrumbs on fixture-dir known-good', async () => {
    const dir = makeAppDir();
    write(
      dir,
      'about.html',
      readFileSync(join(here, 'fixtures/breadcrumbs/good-about.html'), 'utf8')
    );
    write(dir, 'index.html', '<html><body><h1>Home</h1></body></html>');
    const r = await runCaptured((io) => runBreadcrumbs(dir, io, { fixtureDir: dir }));
    expect(r.code).toBe(0);
  });
});

describe('C9 proc-design-options', () => {
  it('FAILS when options dir is missing (known-bad)', () => {
    const app = makeAppDir();
    write(app, 'src/App.tsx', 'export default function App(){return null}');
    const r = evaluateDesignOptions(app);
    expect(r.status).toBe('fail');
    expect(r.messages.join(' ')).toMatch(/design-options/i);
    console.log('proc-design-options known-bad:', r.messages[0]);
  });

  it('FAILS when fewer than three options or DECISION has TBD', () => {
    const app = makeAppDir();
    write(app, 'src/App.tsx', 'export default function A(){return null}');
    write(app, 'design-refs/design-options/a.html', '<html><body>A</body></html>');
    write(app, 'design-refs/design-options/b.html', '<html><body>B</body></html>');
    write(
      app,
      'design-refs/design-options/DECISION.md',
      'Chosen: A because TBD structural difference is TODO'
    );
    const r = evaluateDesignOptions(app);
    expect(r.status).toBe('fail');
    expect(r.messages.join('\n')).toMatch(/3|unwritten|TBD|TODO|structur/i);
  });

  it('PASSES with three options and a complete DECISION.md (known-good)', async () => {
    const app = makeAppDir();
    write(app, 'src/App.tsx', 'export default function A(){return null}');
    write(app, 'design-refs/design-options/option-a.html', '<html><body>A tile grid</body></html>');
    write(app, 'design-refs/design-options/option-b.html', '<html><body>B timeline</body></html>');
    write(app, 'design-refs/design-options/option-c.html', '<html><body>C hero card</body></html>');
    write(
      app,
      'design-refs/design-options/DECISION.md',
      [
        '# Design decision',
        '',
        'Chosen: option B (timeline chronicle).',
        '',
        'Why: the primary user job is scanning a history of events, so a timeline layout wins on scan speed.',
        '',
        'Structural distinctness: A is a tile grid, B is a vertical timeline chronicle, C is a single hero-card focus -- three different layout architectures, not recolors.'
      ].join('\n')
    );
    const r = await runCaptured((io) => runDesignOptions(app, io));
    expect(r.code).toBe(0);
  });

  it('fails through check.mjs on known-bad', () => {
    const app = makeAppDir();
    write(app, 'package.json', JSON.stringify({ name: 'x' }));
    write(app, 'src/x.ts', 'export {}');
    const r = runCheck('proc-design-options', app);
    expect(r.status).toBe(1);
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    expect(out).toMatch(/design-options/i);
    console.log('check.mjs proc-design-options known-bad:', out.slice(0, 200));
  });
});

describe('D8 fe-legal-substance', () => {
  it('FAILS a short page missing topics (known-bad)', () => {
    const html = '<html><body><h2>Intro</h2><p>Short legal stub with almost nothing.</p></body></html>';
    const t = evaluateLegalPage(html, 'terms');
    expect(t.ok).toBe(false);
    expect(t.failures.join(' ')).toMatch(/words|h2|missing topics/i);
    console.log('fe-legal-substance known-bad:', t.failures.join('; ').slice(0, 300));
  });

  it('PASSES full terms+privacy (known-good via fixture-dir)', async () => {
    const app = makeAppDir();
    write(app, 'terms.html', buildLegalHtml('terms'));
    write(app, 'privacy.html', buildLegalHtml('privacy'));
    const r = await runCaptured((io) => runLegalSubstance(app, io, { fixtureDir: app }));
    expect(r.code).toBe(0);
  });

  it('FAILS short fixture through fixture-dir (known-bad path)', async () => {
    const app = makeAppDir();
    write(
      app,
      'terms.html',
      '<html><body><h2>Intro</h2><p>Short legal stub with almost nothing.</p></body></html>'
    );
    write(
      app,
      'privacy.html',
      '<html><body><h2>Intro</h2><p>Short privacy stub with almost nothing.</p></body></html>'
    );
    const r = await runCaptured((io) => runLegalSubstance(app, io, { fixtureDir: app }));
    expect(r.code).toBe(1);
    expect(r.msg).toMatch(/words|h2|missing topics/i);
  });

  it('reports missing liability by name even when padded', () => {
    // Clear word/h2 floors without the liability topic phrase.
    const h2s = Array.from({ length: 14 }, (_, i) => `<h2>Section ${i + 1}</h2><p>${'word '.repeat(120)}</p>`).join(
      '\n'
    );
    const padded = `<html><body>${h2s}</body></html>`;
    const t = evaluateLegalPage(padded, 'terms');
    expect(t.words).toBeGreaterThanOrEqual(MIN_WORDS);
    expect(t.h2).toBeGreaterThanOrEqual(MIN_H2);
    expect(t.missing).toContain('limitation of liability');
    expect(t.ok).toBe(false);
  });

  it('evaluateLegalSubstance fails when privacy is missing', () => {
    const r = evaluateLegalSubstance({ terms: buildLegalHtml('terms'), privacy: null });
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toMatch(/Privacy/i);
  });
});

describe('D9 fe-structured-data', () => {
  it('FAILS without JSON-LD / absolute canonical (known-bad)', () => {
    const html = readFileSync(join(here, 'fixtures/structured-data/bad.html'), 'utf8');
    const r = evaluateStructuredData(html);
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toMatch(/ld\+json|canonical/i);
    console.log('fe-structured-data known-bad:', r.failures.join('; '));
  });

  it('PASSES with valid JSON-LD and absolute canonical (known-good)', async () => {
    const app = makeAppDir();
    write(
      app,
      'index.html',
      readFileSync(join(here, 'fixtures/structured-data/good.html'), 'utf8')
    );
    write(app, 'src/App.tsx', 'export default function A(){return null}');
    const r = await runCaptured((io) => runStructuredData(app, io));
    expect(r.code).toBe(0);
  });

  it('fails through check.mjs on known-bad', () => {
    const app = makeAppDir();
    write(app, 'index.html', '<html><head><title>x</title></head><body></body></html>');
    write(app, 'src/x.ts', 'export {}');
    const r = runCheck('fe-structured-data', app);
    expect(r.status).toBe(1);
    console.log(
      'check.mjs fe-structured-data known-bad:',
      `${r.stdout ?? ''}${r.stderr ?? ''}`.slice(0, 250)
    );
  });
});

describe('E6 lg-bindings-bound', () => {
  it('parses wrangler bindings', () => {
    const bindings = parseWranglerBindings(`
name = "demo"
[[d1_databases]]
binding = "DB"
database_name = "x"
database_id = "y"
[ai]
binding = "AI"
[[kv_namespaces]]
binding = "CACHE"
id = "z"
`);
    expect(bindings.map((b) => `${b.kind}:${b.binding}`).sort()).toEqual([
      'ai:AI',
      'd1:DB',
      'kv:CACHE'
    ]);
  });

  it('detects missing-binding symptom (known-bad shape)', () => {
    const det = detectMissingBinding(503, JSON.stringify({ error: 'Assistant binding unavailable (AI missing)' }));
    expect(det.missing).toBe(true);
    console.log('lg-bindings-bound known-bad symptom:', det.reason);
  });

  it('FAILS when probe returns binding unavailable (known-bad)', () => {
    const r = evaluateBindingProbes(
      [{ kind: 'ai', binding: 'AI' }],
      [
        {
          binding: 'AI',
          path: 'POST /api/assistant',
          status: 503,
          body: 'Assistant binding unavailable (AI missing)'
        }
      ]
    );
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toMatch(/binding/i);
    console.log('lg-bindings-bound evaluate known-bad:', r.failures[0]?.slice(0, 200));
  });

  it('PASSES when probes are healthy (known-good)', () => {
    const r = evaluateBindingProbes(
      [{ kind: 'ai', binding: 'AI' }, { kind: 'd1', binding: 'DB' }],
      [
        { binding: 'AI', path: 'POST /api/assistant', status: 200, body: '{"reply":"ok"}' },
        { binding: 'DB', path: 'GET /api/health', status: 200, body: '{"ok":true}' }
      ]
    );
    expect(r.ok).toBe(true);
  });

  it('FAILS against a live fixture server that returns 503 binding unavailable', async () => {
    const app = makeAppDir();
    write(
      app,
      'wrangler.toml',
      `name = "demo"\n[ai]\nbinding = "AI"\n`
    );
    write(
      app,
      'functions/api/assistant.ts',
      `export async function onRequestPost({ env }) {
  if (!env.AI) return new Response('Assistant binding unavailable (AI missing)', { status: 503 });
  return new Response('{}');
}`
    );
    write(app, '.redanvil/claims.json', JSON.stringify({ deployUrl: 'http://127.0.0.1:9' }));

    const server = createServer((req, res) => {
      if ((req.url ?? '').includes('assistant')) {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Assistant binding unavailable (AI missing)' }));
        return;
      }
      res.writeHead(404).end('no');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${addr.port}`;
    try {
      const r = await runCaptured((io) => runBindingsBound(app, io, { url: base }));
      expect(r.code).toBe(1);
      expect(r.msg).toMatch(/binding unavailable|AI missing/i);
      console.log('lg-bindings-bound live known-bad:', r.msg.slice(0, 250));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('PASSES against a live fixture server with healthy bindings', async () => {
    const app = makeAppDir();
    write(app, 'wrangler.toml', `name = "demo"\n[ai]\nbinding = "AI"\n`);
    write(
      app,
      'functions/api/assistant.ts',
      `export async function onRequestPost({ env }) {
  return Response.json({ reply: 'ok' });
}`
    );
    const server = createServer((req, res) => {
      if ((req.url ?? '').includes('assistant')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ reply: 'ok' }));
        return;
      }
      res.writeHead(404).end('no');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${addr.port}`;
    try {
      const r = await runCaptured((io) => runBindingsBound(app, io, { url: base }));
      expect(r.code).toBe(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('n/a without wrangler.toml', async () => {
    const app = makeAppDir();
    write(app, 'package.json', '{}');
    const r = await runCaptured((io) => runBindingsBound(app, io));
    expect(r.code).toBe(3);
  });
});

describe('D10 fe-brand-mark-size', () => {
  it('FAILS when heights are too small (known-bad pure)', () => {
    const r = evaluateMarkHeights({ found: true, height1280: 32, height375: 24 });
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toMatch(new RegExp(`${MIN_HEIGHT_1280}|${MIN_HEIGHT_375}`));
    console.log('fe-brand-mark-size known-bad:', r.failures.join('; '));
  });

  it('PASSES when heights meet floors (known-good pure)', () => {
    const r = evaluateMarkHeights({ found: true, height1280: 56, height375: 40 });
    expect(r.ok).toBe(true);
  });

  it('FAILS when no mark is found', () => {
    const r = evaluateMarkHeights({ found: false, height1280: null, height375: null });
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toMatch(/no image or SVG/i);
  });

  it('FAILS Playwright fixture with 24px mark (known-bad)', async () => {
    const fixture = join(here, 'fixtures/brand-mark-size/small.html');
    const app = makeAppDir();
    write(app, 'src/App.tsx', 'export default function A(){return null}');
    const r = await runCaptured((io) =>
      runBrandMarkSize(app, io, { fixture })
    );
    expect(r.code).toBe(1);
    expect(r.msg).toMatch(/height|48|32/i);
    console.log('fe-brand-mark-size playwright known-bad:', r.msg.slice(0, 250));
  }, 60_000);

  it('PASSES Playwright fixture with 56px mark (known-good)', async () => {
    const fixture = join(here, 'fixtures/brand-mark-size/large.html');
    const app = makeAppDir();
    write(app, 'src/App.tsx', 'export default function A(){return null}');
    const r = await runCaptured((io) =>
      runBrandMarkSize(app, io, { fixture })
    );
    expect(r.code).toBe(0);
  }, 60_000);
});
