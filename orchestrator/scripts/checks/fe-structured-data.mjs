#!/usr/bin/env node
/**
 * fe-structured-data — JSON-LD + absolute canonical URL on the home route.
 *
 * Usage:
 *   node fe-structured-data.mjs <appDir>
 *   node fe-structured-data.mjs --fixture /path/to/page.html
 *
 * Exit 0 = pass, 1 = fail, 3 = n/a (no frontend).
 *
 * per-app-pack already required JSON-LD; nothing measured it. Require a valid
 * application/ld+json block with @context and @type, and a
 * <link rel="canonical"> whose href is an absolute http(s) URL, on home.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never
 * }} StructuredDataIo
 */

/**
 * Collect HTML-ish and shell sources that may declare head meta.
 *
 * @param {string} appDir App root.
 * @returns {string[]} Absolute paths.
 */
function headSources(appDir) {
  /** @type {string[]} */
  const out = [];
  for (const rel of ['index.html', 'public/index.html', 'dist/index.html']) {
    const p = join(appDir, rel);
    if (existsSync(p)) out.push(p);
  }
  const src = join(appDir, 'src');
  if (!existsSync(src)) return out;
  /**
   * @param {string} dir
   */
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
        continue;
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (
        /\.(tsx?|jsx?|html)$/.test(entry.name) &&
        !/\.(test|spec)\./.test(entry.name) &&
        /(index|App|main|Layout|Shell|Document|Html|Helmet|Head|meta|seo|useDocumentMeta)/i.test(
          entry.name
        )
      ) {
        out.push(full);
      }
    }
  }
  walk(src);
  // Also pull any file that mentions ld+json or rel=canonical so SPA injectors count.
  /**
   * @param {string} dir
   */
  function walkAll(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
        continue;
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walkAll(full);
        continue;
      }
      if (!/\.(tsx?|jsx?)$/.test(entry.name) || /\.(test|spec)\./.test(entry.name)) continue;
      if (out.includes(full)) continue;
      try {
        const text = readFileSync(full, 'utf8');
        if (/ld\+json|application\/ld\+json|rel\s*[=:]\s*['"`]?canonical/i.test(text)) {
          out.push(full);
        }
      } catch {
        // skip
      }
    }
  }
  if (existsSync(src)) walkAll(src);
  return out;
}

/**
 * Join all candidate head-related content for evaluation.
 *
 * @param {string} appDir App root.
 * @returns {string}
 */
export function collectHeadCorpus(appDir) {
  return headSources(appDir)
    .map((f) => {
      try {
        return readFileSync(f, 'utf8');
      } catch {
        return '';
      }
    })
    .join('\n');
}

/**
 * Extract raw JSON-LD script bodies from HTML/JSX corpus.
 *
 * @param {string} corpus Combined source/HTML.
 * @returns {string[]} JSON string candidates.
 */
export function extractJsonLdBlocks(corpus) {
  /** @type {string[]} */
  const blocks = [];
  // HTML: <script type="application/ld+json">...</script>
  const htmlRe =
    /<script[^>]*type\s*=\s*['"`]application\/ld\+json['"`][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = htmlRe.exec(corpus)) !== null) {
    blocks.push((m[1] ?? '').trim());
  }
  // JSX: dangerouslySetInnerHTML={{ __html: JSON.stringify({...}) }}
  const jsxType =
    /type\s*[:=]\s*['"`]application\/ld\+json['"`][\s\S]{0,400}?(?:__html|children)\s*[:=]\s*\{?[`'"]([\s\S]*?)[`'"]/gi;
  while ((m = jsxType.exec(corpus)) !== null) {
    blocks.push((m[1] ?? '').trim());
  }
  // JSON.stringify({ '@context': ..., '@type': ... }) near ld+json
  if (/application\/ld\+json/i.test(corpus)) {
    const objRe =
      /\{[^{}]*['"]@context['"]\s*:\s*['"][^'"]+['"][^{}]*['"]@type['"]\s*:\s*['"][^'"]+['"][^{}]*\}/g;
    while ((m = objRe.exec(corpus)) !== null) {
      blocks.push(m[0]);
    }
    // Also allow @type before @context
    const objRe2 =
      /\{[^{}]*['"]@type['"]\s*:\s*['"][^'"]+['"][^{}]*['"]@context['"]\s*:\s*['"][^'"]+['"][^{}]*\}/g;
    while ((m = objRe2.exec(corpus)) !== null) {
      blocks.push(m[0]);
    }
  }
  return blocks;
}

/**
 * Validate one JSON-LD block parses and has @context + @type.
 *
 * @param {string} raw Raw JSON text.
 * @returns {{ ok: boolean, why?: string, type?: string }}
 */
export function validateJsonLdBlock(raw) {
  if (!raw || raw.trim().length === 0) {
    return { ok: false, why: 'empty JSON-LD block' };
  }
  // JSX may escape quotes; normalise common escapes.
  let text = raw
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
  // Single-quoted JS object keys sometimes appear; try as-is first.
  try {
    const data = JSON.parse(text);
    return validateJsonLdValue(data);
  } catch {
    // Try converting bare JS object with single quotes to JSON.
    try {
      const asJson = text
        .replace(/(['"])?([@\w$]+)(['"])?\s*:/g, '"$2":')
        .replace(/'/g, '"');
      const data = JSON.parse(asJson);
      return validateJsonLdValue(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, why: `JSON-LD does not parse as JSON: ${msg}` };
    }
  }
}

/**
 * @param {unknown} data Parsed JSON-LD.
 * @returns {{ ok: boolean, why?: string, type?: string }}
 */
function validateJsonLdValue(data) {
  if (Array.isArray(data)) {
    for (const item of data) {
      const r = validateJsonLdValue(item);
      if (r.ok) return r;
    }
    return { ok: false, why: 'JSON-LD array has no object with @context and @type' };
  }
  if (data === null || typeof data !== 'object') {
    return { ok: false, why: 'JSON-LD root is not an object' };
  }
  const obj = /** @type {Record<string, unknown>} */ (data);
  const ctx = obj['@context'];
  const type = obj['@type'];
  if (ctx === undefined || ctx === null || String(ctx).trim() === '') {
    return { ok: false, why: 'JSON-LD missing @context' };
  }
  if (type === undefined || type === null || String(type).trim() === '') {
    return { ok: false, why: 'JSON-LD missing @type' };
  }
  return { ok: true, type: String(type) };
}

/**
 * Find canonical href candidates in corpus.
 *
 * @param {string} corpus Combined source/HTML.
 * @returns {string[]}
 */
export function extractCanonicalHrefs(corpus) {
  /** @type {string[]} */
  const hrefs = [];
  const patterns = [
    /<link[^>]+rel\s*=\s*['"`]canonical['"`][^>]+href\s*=\s*['"`]([^'"`]+)['"`]/gi,
    /<link[^>]+href\s*=\s*['"`]([^'"`]+)['"`][^>]+rel\s*=\s*['"`]canonical['"`]/gi,
    /rel\s*[:=]\s*['"`]canonical['"`][^;{]{0,120}href\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
    /href\s*[:=]\s*['"`]([^'"`]+)['"`][^;{]{0,120}rel\s*[:=]\s*['"`]canonical['"`]/gi,
    /setAttribute\s*\(\s*['"`]href['"`]\s*,\s*['"`](https?:\/\/[^'"`]+)['"`]/gi,
    /canonical(?:Url|URL|Href)?\s*[:=]\s*['"`](https?:\/\/[^'"`]+)['"`]/gi
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(corpus)) !== null) {
      if (m[1]) hrefs.push(m[1].trim());
    }
  }
  // Template form: `${origin}${path}` after creating a canonical link.
  if (
    /rel\s*[:=]\s*['"`]canonical['"`]/i.test(corpus) &&
    /https?:\/\//.test(corpus) &&
    hrefs.length === 0
  ) {
    // Accept runtime builders that join an absolute origin with a path when
    // the corpus also constructs a canonical link element.
    const originM =
      /(?:siteOrigin|origin|canonicalOrigin|BASE_URL|SITE_URL)\s*[:=]\s*['"`](https?:\/\/[^'"`]+)['"`]/i.exec(
        corpus
      );
    if (originM?.[1]) hrefs.push(originM[1].replace(/\/$/, '') + '/');
  }
  return hrefs;
}

/**
 * Whether a URL string is absolute http(s).
 *
 * @param {string} href Candidate href.
 * @returns {boolean}
 */
export function isAbsoluteHttpUrl(href) {
  try {
    const u = new URL(href);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Evaluate structured-data requirements against a corpus.
 *
 * @param {string} corpus HTML/source text.
 * @returns {{ ok: boolean, failures: string[], jsonLdType?: string, canonical?: string }}
 */
export function evaluateStructuredData(corpus) {
  /** @type {string[]} */
  const failures = [];
  const blocks = extractJsonLdBlocks(corpus);
  if (blocks.length === 0) {
    failures.push(
      'no application/ld+json block found on the home surface — per-app-pack requires JSON-LD'
    );
  }
  /** @type {string | undefined} */
  let jsonLdType;
  let anyValid = false;
  /** @type {string[]} */
  const jsonFailures = [];
  for (const block of blocks) {
    const v = validateJsonLdBlock(block);
    if (v.ok) {
      anyValid = true;
      jsonLdType = v.type;
      break;
    }
    if (v.why) jsonFailures.push(v.why);
  }
  if (blocks.length > 0 && !anyValid) {
    failures.push(
      `JSON-LD present but invalid: ${jsonFailures[0] ?? 'must parse as JSON with @context and @type'}`
    );
  }

  const hrefs = extractCanonicalHrefs(corpus);
  const absolute = hrefs.find(isAbsoluteHttpUrl);
  if (!absolute) {
    if (hrefs.length === 0) {
      failures.push(
        'no <link rel="canonical"> found — home must declare an absolute canonical URL'
      );
    } else {
      failures.push(
        `canonical href is not an absolute http(s) URL (got ${JSON.stringify(hrefs[0])})`
      );
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    jsonLdType,
    canonical: absolute
  };
}

/**
 * Run the check.
 *
 * @param {string} appDir App directory (or empty when fixture-only).
 * @param {StructuredDataIo} io Exit helpers.
 * @param {{ fixture?: string | null }} [opts]
 */
export function runStructuredData(appDir, io, opts = {}) {
  let corpus = '';
  if (opts.fixture) {
    if (!existsSync(opts.fixture)) {
      io.fail(`fixture not found: ${opts.fixture}`);
    }
    corpus = readFileSync(opts.fixture, 'utf8');
  } else {
    if (!existsSync(appDir) || !statSync(appDir).isDirectory()) {
      io.fail(`no such app directory: ${appDir}`);
    }
    const hasSurface =
      existsSync(join(appDir, 'src')) ||
      existsSync(join(appDir, 'public')) ||
      existsSync(join(appDir, 'index.html'));
    if (!hasSurface) {
      io.notApplicable('no frontend surface to require structured data for');
    }
    corpus = collectHeadCorpus(appDir);
    if (corpus.trim().length === 0) {
      io.fail(
        'no index.html or head/meta source found — cannot verify JSON-LD or canonical'
      );
    }
  }

  const result = evaluateStructuredData(corpus);
  if (!result.ok) {
    io.fail(result.failures.join('\n'));
  }
  console.log(
    `fe-structured-data PASS: JSON-LD @type=${result.jsonLdType ?? '?'} and canonical=${result.canonical}`
  );
  io.pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2);
  const fi = argv.indexOf('--fixture');
  const fixture = fi === -1 ? null : argv[fi + 1];
  const appDir = argv.find((a, i) => !a.startsWith('--') && (fi === -1 || i !== fi + 1)) ?? '';
  if (!appDir && !fixture) {
    console.error('usage: node fe-structured-data.mjs <appDir> | --fixture <html>');
    process.exit(2);
  }
  runStructuredData(appDir, {
    pass: () => process.exit(0),
    fail: (m) => {
      if (m) console.error(m);
      process.exit(1);
    },
    notApplicable: (w) => {
      if (w) console.error(`n/a: ${w}`);
      process.exit(3);
    }
  }, { fixture });
}
