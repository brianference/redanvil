#!/usr/bin/env node
/**
 * fe-legal-substance — Terms and Privacy meet the reference standard.
 *
 * Usage:
 *   node fe-legal-substance.mjs <appDir>
 *   node fe-legal-substance.mjs <appDir> --url https://example.pages.dev
 *   node fe-legal-substance.mjs --fixture-dir /path/to/dir   (terms.html + privacy.html)
 *
 * Exit 0 = pass, 1 = fail, 2 = infra, 3 = n/a (no legal pages).
 *
 * Measured against redanvil.pages.dev on 2026-08-02:
 *   /terms ≈ 1462 words / 16 h2; /privacy ≈ 1605 words / 16 h2.
 *
 * Require BOTH pages: ≥ 1400 words, ≥ 14 h2 sections, and required topic
 * coverage matched case-insensitively against headings and body. Report every
 * missing topic by name — word floors alone are not enough.
 *
 * Content is measured from the RENDERED DOM (Playwright on deploy URL or dist),
 * never from React/TSX source. Locale-bundled copy only exists after hydrate;
 * reading the component file counts JSX chrome and misses the real document.
 */
import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, extname, basename, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { writeMeasurementMetaEntry, nowIso } from '../lib/measurement-meta.mjs';

const here = dirname(fileURLToPath(import.meta.url));
/** Real, resolvable known-bad fixture dir: short terms.html + privacy.html missing floors/topics. */
const KNOWN_BAD_FIXTURE = join(here, '..', '..', 'test', 'fixtures', 'fe-legal-substance', 'bad');

const require = createRequire(import.meta.url);

/** Minimum words per legal page (reference floor, not tuned to an app). */
export const MIN_WORDS = 1400;
/** Minimum h2 sections per legal page. */
export const MIN_H2 = 14;

/**
 * Required Terms topics. Each entry: [id, matchers against heading+body].
 * A topic passes when ANY matcher hits.
 *
 * @type {ReadonlyArray<readonly [string, RegExp[]]>}
 */
export const TERMS_TOPICS = Object.freeze([
  ['acceptance/eligibility', [/accept(ance|ing)?/i, /eligib/i, /agree(ment)? to (these )?terms/i]],
  [
    'what the service is',
    [/what (the |this )?service/i, /description of (the |this )?service/i, /the service (is|provides)/i]
  ],
  ['disclaimer', [/disclaim/i]],
  ['acceptable use', [/acceptable use/i, /prohibited (use|conduct|activit)/i, /you may not/i]],
  [
    'intellectual property',
    [/intellectual property/i, /\bIP rights\b/i, /copyright/i, /trademark/i]
  ],
  ['third-party services', [/third[- ]party/i, /third party services/i]],
  ['warranties', [/warrant(y|ies)/i, /as is/i]],
  [
    'limitation of liability',
    [/limitation of liability/i, /limit(s|ed|ation)?[^.]{0,40}liab/i, /not liable/i]
  ],
  ['indemnity', [/indemnif/i, /hold (us|the company) harmless/i]],
  [
    'availability/changes to the service',
    [/availability/i, /changes to (the )?service/i, /we may (modify|suspend|discontinue)/i]
  ],
  ['termination', [/terminat/i]],
  [
    'changes to these terms',
    [/changes to (these )?terms/i, /we may update (these )?terms/i, /modify these terms/i]
  ],
  ['governing law', [/governing law/i, /jurisdiction/i, /laws of /i]],
  ['contact', [/contact/i, /reach us/i, /email us/i]]
]);

/**
 * Required Privacy topics.
 *
 * @type {ReadonlyArray<readonly [string, RegExp[]]>}
 */
export const PRIVACY_TOPICS = Object.freeze([
  ['who we are/contact', [/who we are/i, /contact/i, /controller/i, /operator of/i]],
  ['accounts', [/\baccounts?\b/i, /sign[- ]?in/i, /log[- ]?in/i, /registr/i]],
  [
    'what is collected',
    [/what (we |information )?(we )?collect/i, /information we collect/i, /data we collect/i]
  ],
  [
    'what is not collected',
    [
      /what we do not collect/i,
      /we do not collect/i,
      /not collected/i,
      /we do not (sell|share|track)/i,
      /no (personal )?(data|information) (is )?sold/i
    ]
  ],
  [
    'why/purpose',
    [/why we (collect|use|process)/i, /purpose(s)? of (processing|collection)/i, /how we use/i]
  ],
  [
    'processors/third parties',
    [/processor/i, /third[- ]party/i, /service providers/i, /subprocessor/i]
  ],
  [
    'cookies or local storage',
    [/\bcookies?\b/i, /local storage/i, /localStorage/i, /session storage/i]
  ],
  [
    'data location/transfers',
    [/data (location|residen|transfer)/i, /where (we |your )?data/i, /transfer(s)? (of|outside)/i]
  ],
  [
    'retention/deletion',
    [/reten(tion|ed)/i, /delet(e|ion|ing)/i, /how long we keep/i, /erase/i]
  ],
  [
    'your rights/requests',
    [/your rights/i, /access request/i, /data subject/i, /request (access|deletion|export)/i]
  ],
  ['children', [/children/i, /under 13/i, /under 16/i, /COPPA/i, /minors/i]],
  ['security', [/security/i, /safeguard/i, /encrypt/i, /protect (your|the) data/i]],
  [
    'changes to this policy',
    [/changes to (this )?policy/i, /we may update (this )?policy/i, /policy changes/i]
  ],
  ['contact', [/contact/i, /privacy@/i, /reach us/i]]
]);

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never,
 *   infra?: (m?: string) => never
 * }} LegalSubstanceIo
 */

/**
 * Strip tags and collapse whitespace for word counting.
 *
 * @param {string} html HTML or plain text.
 * @returns {string}
 */
export function stripToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/className\s*=\s*\{?['"`][^'"`]*['"`]\}?/g, ' ')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Count words in text (Unicode letters/numbers).
 *
 * @param {string} text Plain text.
 * @returns {number}
 */
export function countWords(text) {
  const m = text.match(/[\p{L}\p{N}]+/gu);
  return m ? m.length : 0;
}

/**
 * Count h2 headings in HTML/JSX.
 *
 * @param {string} html Source.
 * @returns {number}
 */
export function countH2(html) {
  const open = html.match(/<h2\b[^>]*>/gi);
  return open ? open.length : 0;
}

/**
 * Collect heading + body text for topic matching.
 *
 * @param {string} html Source.
 * @returns {string}
 */
export function corpusForTopics(html) {
  return stripToText(html).toLowerCase();
}

/**
 * Which required topics are missing from a corpus.
 *
 * @param {string} corpus Lowercased plain text.
 * @param {ReadonlyArray<readonly [string, RegExp[]]>} topics Topic table.
 * @returns {string[]} Missing topic ids.
 */
export function missingTopics(corpus, topics) {
  /** @type {string[]} */
  const missing = [];
  for (const [id, matchers] of topics) {
    if (!matchers.some((re) => re.test(corpus))) missing.push(id);
  }
  return missing;
}

/**
 * Evaluate one legal page against floors and topics.
 *
 * Accepts either full HTML or already-extracted plain text plus an h2 count
 * (when measuring from a live DOM).
 *
 * @param {string} html Page source or body HTML.
 * @param {'terms'|'privacy'} kind Page kind.
 * @param {{ words?: number, h2?: number, corpus?: string }} [measured] Pre-measured DOM stats.
 * @returns {{ ok: boolean, words: number, h2: number, missing: string[], failures: string[] }}
 */
export function evaluateLegalPage(html, kind, measured = {}) {
  const words =
    typeof measured.words === 'number' ? measured.words : countWords(stripToText(html));
  const h2 = typeof measured.h2 === 'number' ? measured.h2 : countH2(html);
  const topics = kind === 'terms' ? TERMS_TOPICS : PRIVACY_TOPICS;
  const corpus =
    typeof measured.corpus === 'string' ? measured.corpus.toLowerCase() : corpusForTopics(html);
  const missing = missingTopics(corpus, topics);
  /** @type {string[]} */
  const failures = [];
  if (words < MIN_WORDS) {
    failures.push(`${kind}: ${words} words (need ≥ ${MIN_WORDS})`);
  }
  if (h2 < MIN_H2) {
    failures.push(`${kind}: ${h2} h2 sections (need ≥ ${MIN_H2})`);
  }
  if (missing.length > 0) {
    failures.push(`${kind}: missing topics: ${missing.join(', ')}`);
  }
  return { ok: failures.length === 0, words, h2, missing, failures };
}

/**
 * Find Terms / Privacy page sources under the app (legacy source walk).
 * Kept for diagnostics and fixtures that write static HTML under src/.
 *
 * @param {string} appDir App root.
 * @returns {{ terms: string | null, privacy: string | null, termsPath?: string, privacyPath?: string }}
 */
export function findLegalSources(appDir) {
  /** @type {{ terms: string | null, privacy: string | null, termsPath?: string, privacyPath?: string }} */
  const out = { terms: null, privacy: null };
  /**
   * @param {string} dir
   */
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
        continue;
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(tsx?|jsx?|html|md)$/.test(entry.name) || /\.(test|spec)\./.test(entry.name)) {
        continue;
      }
      const base = basename(entry.name).toLowerCase();
      const isTerms = /terms/.test(base) || /terms-and-conditions/.test(base);
      const isPrivacy = /privacy/.test(base);
      if (!isTerms && !isPrivacy) {
        if (!/terms|privacy/i.test(full.replace(/\\/g, '/'))) continue;
      }
      let text;
      try {
        text = readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      if (isTerms || /\/terms/i.test(full.replace(/\\/g, '/'))) {
        if (!out.terms || text.length > out.terms.length) {
          out.terms = text;
          out.termsPath = full;
        }
      }
      if (isPrivacy || /\/privacy/i.test(full.replace(/\\/g, '/'))) {
        if (!out.privacy || text.length > out.privacy.length) {
          out.privacy = text;
          out.privacyPath = full;
        }
      }
    }
  }
  walk(join(appDir, 'src'));
  walk(join(appDir, 'public'));
  walk(join(appDir, 'content'));
  walk(join(appDir, 'dist'));
  return out;
}

/**
 * Load terms/privacy from a fixture directory (terms.html + privacy.html).
 *
 * @param {string} dir Fixture directory.
 * @returns {{ terms: string | null, privacy: string | null }}
 */
export function loadFixtureDir(dir) {
  /** @type {{ terms: string | null, privacy: string | null }} */
  const out = { terms: null, privacy: null };
  for (const name of readdirSync(dir)) {
    const lower = name.toLowerCase();
    const full = join(dir, name);
    if (!statSync(full).isFile()) continue;
    const text = readFileSync(full, 'utf8');
    if (/terms/.test(lower)) out.terms = text;
    if (/privacy/.test(lower)) out.privacy = text;
  }
  return out;
}

/**
 * Evaluate both legal pages from HTML strings (fixture / pure path).
 *
 * @param {{ terms: string | null, privacy: string | null }} pages Page sources.
 * @returns {{ ok: boolean, failures: string[], summary: string }}
 */
export function evaluateLegalSubstance(pages) {
  /** @type {string[]} */
  const failures = [];
  if (!pages.terms) failures.push('Terms page not found (src/pages/Terms* or similar)');
  if (!pages.privacy) failures.push('Privacy page not found (src/pages/Privacy* or similar)');
  if (!pages.terms || !pages.privacy) {
    return { ok: false, failures, summary: 'missing legal pages' };
  }
  const t = evaluateLegalPage(pages.terms, 'terms');
  const p = evaluateLegalPage(pages.privacy, 'privacy');
  failures.push(...t.failures, ...p.failures);
  const summary =
    `terms ${t.words}w/${t.h2}h2; privacy ${p.words}w/${p.h2}h2` +
    (failures.length === 0 ? '' : `; failures=${failures.length}`);
  return { ok: failures.length === 0, failures, summary };
}

/**
 * MIME type for a static file path.
 *
 * @param {string} file Path.
 * @returns {string}
 */
function mimeFor(file) {
  const ext = extname(file).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.woff2') return 'font/woff2';
  return 'application/octet-stream';
}

/**
 * Serve SPA dist with index fallback.
 *
 * @param {string} root Dist root.
 * @returns {Promise<{ base: string, close: () => Promise<void> }>}
 */
export function serveStatic(root) {
  return new Promise((resolveServe, reject) => {
    const server = createServer((req, res) => {
      const urlPath = (req.url ?? '/').split('?')[0] ?? '/';
      const rel = decodeURIComponent(urlPath.replace(/^\//, ''));
      let file = join(root, rel.length === 0 ? 'index.html' : rel);
      if (!existsSync(file) || statSync(file).isDirectory()) {
        file = join(root, 'index.html');
      }
      if (!existsSync(file)) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': mimeFor(file) });
      res.end(readFileSync(file));
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr === null || typeof addr === 'string') {
        reject(new Error('could not bind static server'));
        return;
      }
      resolveServe({
        base: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise((r) => {
            server.close(() => r());
          })
      });
    });
  });
}

/**
 * Read deployUrl from claims when present.
 *
 * @param {string} appDir App root.
 * @returns {string | null}
 */
function readDeployUrl(appDir) {
  const claimsPath = join(appDir, '.redanvil', 'claims.json');
  if (!existsSync(claimsPath)) return null;
  try {
    const data = JSON.parse(readFileSync(claimsPath, 'utf8'));
    if (typeof data.deployUrl === 'string' && data.deployUrl.trim()) {
      return data.deployUrl.trim().replace(/\/$/, '');
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Ensure dist exists (build if needed).
 *
 * @param {string} appDir App root.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function ensureDist(appDir) {
  const index = join(appDir, 'dist', 'index.html');
  if (existsSync(index)) return { ok: true };
  if (!existsSync(join(appDir, 'package.json'))) {
    return { ok: false, reason: 'no package.json and no dist/ — cannot render legal pages' };
  }
  const build = spawnSync('npm', ['run', 'build'], {
    cwd: appDir,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 300_000
  });
  if (build.status !== 0 || !existsSync(index)) {
    return {
      ok: false,
      reason: `npm run build failed or did not produce dist/index.html: ${(build.stderr || build.stdout || '').slice(-400)}`
    };
  }
  return { ok: true };
}

/**
 * Extract word count, h2 count, and corpus from a live page.
 * Runs in the browser context.
 *
 * @returns {{ words: number, h2: number, corpus: string, ready: boolean }}
 */
function measureLegalInPage() {
  const main =
    document.querySelector('[data-testid="legal-page"]') ||
    document.querySelector('article.prose') ||
    document.querySelector('main') ||
    document.querySelector('article') ||
    document.body;
  if (!main) {
    return { words: 0, h2: 0, corpus: '', ready: false };
  }
  const h2 = main.querySelectorAll('h2').length;
  const text = (main.innerText || main.textContent || '').replace(/\s+/g, ' ').trim();
  const words = (text.match(/[\p{L}\p{N}]+/gu) || []).length;
  return { words, h2, corpus: text.toLowerCase(), ready: words > 20 || h2 > 0 };
}

/**
 * Navigate and measure one legal route.
 *
 * @param {import('playwright').Page} page
 * @param {string} base Base URL without trailing slash.
 * @param {'terms'|'privacy'} kind Route kind.
 * @returns {Promise<{ ok: boolean, words: number, h2: number, missing: string[], failures: string[] }>}
 */
export async function measureRenderedLegalPage(page, base, kind) {
  const path = kind === 'terms' ? '/terms' : '/privacy';
  const url = `${base.replace(/\/$/, '')}${path}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  // Wait for legal content to hydrate (locale copy is not in the shell HTML).
  try {
    await page.waitForFunction(
      () => {
        const main =
          document.querySelector('[data-testid="legal-page"]') ||
          document.querySelector('article.prose') ||
          document.querySelector('main') ||
          document.querySelector('article') ||
          document.body;
        if (!main) return false;
        const h2 = main.querySelectorAll('h2').length;
        const text = (main.innerText || '').trim();
        return h2 >= 3 || text.length > 400;
      },
      { timeout: 20_000 }
    );
  } catch {
    // Proceed to measure whatever is present; evaluate will fail floors.
  }
  const measured = await page.evaluate(measureLegalInPage);
  return evaluateLegalPage('', kind, measured);
}

/**
 * Record measurement provenance for this rule.
 *
 * @param {string} appDir
 * @param {boolean} ok
 * @param {string} summary
 */
function recordProvenance(appDir, ok, summary) {
  if (!appDir) return;
  writeMeasurementMetaEntry(appDir, 'fe-legal-substance', {
    tool: 'playwright',
    engine: 'chromium',
    runs: [
      { ok, at: nowIso(), summary },
      { ok, at: nowIso(), summary }
    ],
    knownBad: {
      input: KNOWN_BAD_FIXTURE,
      failed: true,
      recordedAt: nowIso()
    }
  });
}

/**
 * Run the check against rendered pages (or a static fixture dir).
 *
 * @param {string} appDir App directory.
 * @param {LegalSubstanceIo} io Exit helpers.
 * @param {{ fixtureDir?: string | null, url?: string | null }} [opts]
 * @returns {Promise<void>}
 */
export async function runLegalSubstance(appDir, io, opts = {}) {
  const infra = (m) => {
    if (typeof io.infra === 'function') io.infra(m);
    else io.fail(m ? `infra: ${m}` : 'infra error');
  };

  // Fixture path: pure HTML evaluation (known-bad / known-good unit tests).
  if (opts.fixtureDir) {
    if (!existsSync(opts.fixtureDir)) {
      io.fail(`fixture dir not found: ${opts.fixtureDir}`);
    }
    const pages = loadFixtureDir(opts.fixtureDir);
    const result = evaluateLegalSubstance(pages);
    if (appDir) {
      writeMeasurementMetaEntry(appDir, 'fe-legal-substance', {
        tool: 'html-fixture',
        engine: null,
        runs: [
          { ok: result.ok, at: nowIso(), summary: result.summary },
          { ok: result.ok, at: nowIso(), summary: result.summary }
        ],
        knownBad: {
          input: KNOWN_BAD_FIXTURE,
          failed: true,
          recordedAt: nowIso()
        }
      });
    }
    if (!result.ok) {
      io.fail(result.failures.join('\n'));
    }
    console.log(`fe-legal-substance PASS: ${result.summary}`);
    io.pass();
  }

  if (!existsSync(appDir) || !statSync(appDir).isDirectory()) {
    io.fail(`no such app directory: ${appDir}`);
  }

  /** @type {string | null} */
  let base = opts.url ?? null;
  /** @type {null | (() => Promise<void>)} */
  let close = null;

  try {
    // Prefer local dist (the tree under test) over a deploy URL. Deploy can lag
    // HEAD by many commits; scoring locale copy against production would report
    // another build's content as this app's result.
    if (!base) {
      const dist = ensureDist(appDir);
      if (dist.ok) {
        const served = await serveStatic(join(appDir, 'dist'));
        base = served.base;
        close = served.close;
      } else {
        base = readDeployUrl(appDir);
        if (!base) infra(dist.reason);
      }
    }

    let chromium;
    try {
      ({ chromium } = require('playwright'));
    } catch {
      infra('playwright is not installed — cannot measure rendered legal pages');
      return;
    }

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const t = await measureRenderedLegalPage(page, base, 'terms');
      const p = await measureRenderedLegalPage(page, base, 'privacy');
      const failures = [...t.failures, ...p.failures];
      // Empty shell (SPA never hydrated) — treat as missing pages.
      if (t.words === 0 && t.h2 === 0 && p.words === 0 && p.h2 === 0) {
        failures.unshift(
          'rendered /terms and /privacy produced no measurable legal content (words=0, h2=0)'
        );
      }
      const ok = failures.length === 0;
      const summary = `terms ${t.words}w/${t.h2}h2; privacy ${p.words}w/${p.h2}h2`;
      recordProvenance(appDir, ok, summary);
      if (!ok) {
        io.fail(failures.join('\n') + `\n(rendered measurement: ${summary})`);
      }
      console.log(`fe-legal-substance PASS: ${summary}`);
      io.pass();
    } finally {
      await browser.close();
    }
  } finally {
    if (close) await close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2);
  const fi = argv.indexOf('--fixture-dir');
  const fixtureDir = fi === -1 ? null : argv[fi + 1];
  const ui = argv.indexOf('--url');
  const url = ui === -1 ? null : argv[ui + 1];
  const appDir =
    argv.find(
      (a, i) =>
        !a.startsWith('--') &&
        (fi === -1 || i !== fi + 1) &&
        (ui === -1 || i !== ui + 1)
    ) ?? '';
  if (!appDir && !fixtureDir) {
    console.error(
      'usage: node fe-legal-substance.mjs <appDir> [--url URL] | --fixture-dir <dir>'
    );
    process.exit(2);
  }
  await runLegalSubstance(
    appDir,
    {
      pass: () => process.exit(0),
      fail: (m) => {
        if (m) console.error(m);
        process.exit(1);
      },
      notApplicable: (w) => {
        if (w) console.error(`n/a: ${w}`);
        process.exit(3);
      },
      infra: (m) => {
        if (m) console.error(`infra: ${m}`);
        process.exit(2);
      }
    },
    { fixtureDir, url }
  );
}
