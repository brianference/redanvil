#!/usr/bin/env node
/**
 * fe-legal-substance — Terms and Privacy meet the reference standard.
 *
 * Usage:
 *   node fe-legal-substance.mjs <appDir>
 *   node fe-legal-substance.mjs --fixture-dir /path/to/dir   (terms.html + privacy.html)
 *
 * Exit 0 = pass, 1 = fail, 3 = n/a (no legal pages).
 *
 * Measured against redanvil.pages.dev on 2026-08-02:
 *   /terms ≈ 1462 words / 16 h2; /privacy ≈ 1605 words / 16 h2.
 *
 * Require BOTH pages: ≥ 1400 words, ≥ 14 h2 sections, and required topic
 * coverage matched case-insensitively against headings and body. Report every
 * missing topic by name — word floors alone are not enough.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

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
 *   notApplicable: (w?: string) => never
 * }} LegalSubstanceIo
 */

/**
 * Strip tags and collapse whitespace for word counting.
 *
 * @param {string} html HTML or JSX-ish text.
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
 * @param {string} html Page source.
 * @param {'terms'|'privacy'} kind Page kind.
 * @returns {{ ok: boolean, words: number, h2: number, missing: string[], failures: string[] }}
 */
export function evaluateLegalPage(html, kind) {
  const words = countWords(stripToText(html));
  const h2 = countH2(html);
  const topics = kind === 'terms' ? TERMS_TOPICS : PRIVACY_TOPICS;
  const missing = missingTopics(corpusForTopics(html), topics);
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
 * Find Terms / Privacy page sources under the app.
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
        // Path-based: pages/terms.tsx style already handled by base; also route files.
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
  // dist routes if built as multi-page
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
 * Evaluate both legal pages.
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
 * Run the check.
 *
 * @param {string} appDir App directory.
 * @param {LegalSubstanceIo} io Exit helpers.
 * @param {{ fixtureDir?: string | null }} [opts]
 */
export function runLegalSubstance(appDir, io, opts = {}) {
  /** @type {{ terms: string | null, privacy: string | null }} */
  let pages;
  if (opts.fixtureDir) {
    if (!existsSync(opts.fixtureDir)) {
      io.fail(`fixture dir not found: ${opts.fixtureDir}`);
    }
    pages = loadFixtureDir(opts.fixtureDir);
  } else {
    if (!existsSync(appDir) || !statSync(appDir).isDirectory()) {
      io.fail(`no such app directory: ${appDir}`);
    }
    pages = findLegalSources(appDir);
    if (!pages.terms && !pages.privacy) {
      io.notApplicable('no Terms or Privacy page sources found');
    }
  }

  const result = evaluateLegalSubstance(pages);
  if (!result.ok) {
    io.fail(result.failures.join('\n'));
  }
  console.log(`fe-legal-substance PASS: ${result.summary}`);
  io.pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2);
  const fi = argv.indexOf('--fixture-dir');
  const fixtureDir = fi === -1 ? null : argv[fi + 1];
  const appDir =
    argv.find((a, i) => !a.startsWith('--') && (fi === -1 || i !== fi + 1)) ?? '';
  if (!appDir && !fixtureDir) {
    console.error('usage: node fe-legal-substance.mjs <appDir> | --fixture-dir <dir>');
    process.exit(2);
  }
  runLegalSubstance(appDir, {
    pass: () => process.exit(0),
    fail: (m) => {
      if (m) console.error(m);
      process.exit(1);
    },
    notApplicable: (w) => {
      if (w) console.error(`n/a: ${w}`);
      process.exit(3);
    }
  }, { fixtureDir });
}
