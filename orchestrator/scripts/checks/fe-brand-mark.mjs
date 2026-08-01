#!/usr/bin/env node
/**
 * fe-brand-mark — header brand mark and favicon/OG art must be real assets.
 *
 * Usage: node fe-brand-mark.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = not applicable (no shell / no frontend).
 *
 * Why: the per-app pack requires a real brand mark (not emoji, not a text span)
 * and real favicon/OG art. Those requirements lived only in prose, so
 * az-planting-calendar shipped with a literal "AZ" span and a 361-byte hand-
 * drawn rect favicon while still clearing the scored gate.
 *
 * FAILS when:
 *   - the header brand mark is a text span, an emoji, or a single-glyph placeholder
 *   - favicon or OG art is absent
 *   - favicon or OG art is a trivially small hand-drawn placeholder
 *
 * PASSES only when a real raster or substantive vector asset exists AND the
 * shell references it (img/src or link/meta to public assets of sufficient size).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Minimum bytes for a favicon that is not a hand-drawn stub.
 * The az-planting-calendar SVG was 361 bytes (rect + "AZ" text). Dashboard's
 * real PNG favicon is ~11KB. Floor sits well above the stub class and below
 * any real generated or designed asset.
 */
export const MIN_FAVICON_BYTES = 1024;

/**
 * Minimum bytes for an OG image that is not a stub banner.
 * The az-planting-calendar og.svg was 842 bytes of rect + text. Real OG
 * assets are tens to hundreds of KB.
 */
export const MIN_OG_BYTES = 4096;

/** Emoji / pictograph code points used as logo substitutes. */
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{1F1E0}-\u{1F1FF}]/u;

/** Shell / header files where the brand mark lives. */
const SHELL_FILE = /(Layout|Header|Shell|Nav|Chrome|AppShell|Logo)\.(tsx?|jsx?)$/i;

/**
 * Collect source files under dir (skips node_modules, dist, tests).
 *
 * @param {string} dir Root to walk.
 * @param {string[]} [out] Accumulator.
 * @returns {string[]} Absolute paths.
 */
function sourceFiles(dir, out = []) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Shell sources: Layout/Header/Logo components, falling back to all src.
 *
 * @param {string} appDir App root.
 * @returns {string[]} Absolute paths.
 */
function shellSources(appDir) {
  const all = sourceFiles(join(appDir, 'src'));
  const shell = all.filter((f) => SHELL_FILE.test(f.replace(/\\/g, '/')));
  return shell.length > 0 ? shell : all;
}

/**
 * Detect a text-span / emoji / single-glyph brand mark in shell source.
 *
 * Patterns that fail:
 * - `<span className="…mark…">AZ</span>` (or logo/brand class)
 * - short text (1–3 alphanumerics) inside a mark/logo element
 * - emoji used as the mark
 *
 * @param {string} src Shell source text.
 * @returns {{ kind: 'text-span' | 'emoji' | 'single-glyph', snippet: string } | null}
 */
export function detectPlaceholderMark(src) {
  // Emoji as sole or primary mark content in a brand/logo/mark element.
  const emojiEl =
    /<(?:span|div|i|em|b|strong)[^>]*(?:class(Name)?|id)\s*=\s*[{'"`][^'"`}]*(?:mark|logo|brand|icon)[^'"`}]*['"`}][^>]*>\s*([^<]{1,12})\s*<\/(?:span|div|i|em|b|strong)>/gi;
  let m;
  while ((m = emojiEl.exec(src)) !== null) {
    const inner = (m[2] ?? '').trim();
    if (EMOJI_RE.test(inner)) {
      return { kind: 'emoji', snippet: inner.slice(0, 40) };
    }
    // Single glyph or 1–3 letter text placeholder ("AZ", "A", "X").
    if (/^[\p{L}\p{N}]{1,3}$/u.test(inner)) {
      return {
        kind: inner.length === 1 ? 'single-glyph' : 'text-span',
        snippet: inner
      };
    }
  }

  // Bare emoji next to brand/logo class names (e.g. children: '🌵').
  const emojiAssign =
    /(?:mark|logo|brand)[^;\n]{0,40}['"`]([^'"`]*[\u{1F300}-\u{1FAFF}][^'"`]*)['"`]/u;
  const ea = emojiAssign.exec(src);
  if (ea) {
    return { kind: 'emoji', snippet: (ea[1] ?? '').slice(0, 40) };
  }

  // `{/* logo */}AZ` style or children with only short text in mark class via
  // template: className includes mark and adjacent short text content.
  const shortInMark =
    /className\s*=\s*[{]?['"`][^'"`]*(?:__mark|logo-mark|brand-mark|topbar__mark|site-mark)[^'"`]*['"`][^>]*>\s*([A-Za-z0-9]{1,3})\s*</;
  const sm = shortInMark.exec(src);
  if (sm) {
    const inner = sm[1] ?? '';
    return {
      kind: inner.length === 1 ? 'single-glyph' : 'text-span',
      snippet: inner
    };
  }

  return null;
}

/**
 * Whether source text references a real image brand asset (inline or via Logo).
 *
 * @param {string} src Shell / logo source text.
 * @returns {boolean}
 */
export function shellReferencesBrandAsset(src) {
  // <img src="/logo-….png"> or src={logoUrl} with logo in path/name.
  if (
    /<(?:img|Image)\b[^>]*(?:src|srcSet)\s*=\s*['"`{][^'"`}]*(?:logo|mark|brand|lockup)[^'"`}]*/i.test(
      src
    )
  ) {
    return true;
  }
  // import logo from '…logo….png|svg|webp'
  if (
    /import\s+\w+\s+from\s+['"`][^'"`]*(?:logo|mark|brand|lockup)[^'"`]*\.(?:png|jpe?g|webp|svg|gif)['"`]/i.test(
      src
    )
  ) {
    return true;
  }
  // new URL('…logo…', import.meta.url) / require of image
  if (
    /(?:logo|mark|brand|lockup)[^'"`\n]{0,40}\.(?:png|jpe?g|webp|svg)/i.test(src) &&
    /(?:src|href|url)\s*[:=]/i.test(src)
  ) {
    return true;
  }
  // Substantial inline SVG used as mark (path data present, not just a rect).
  if (
    /<(?:span|div|a|Link)[^>]*(?:mark|logo|brand)[^>]*>[\s\S]{0,200}<svg[\s\S]{80,}?<\/svg>/i.test(
      src
    ) &&
    /<path\b/i.test(src)
  ) {
    return true;
  }
  return false;
}

/**
 * Whether the app mounts a Logo component (shared design-system pattern).
 *
 * @param {string} src Source text.
 * @returns {boolean}
 */
export function usesLogoComponent(src) {
  return (
    /<\s*Logo\b/.test(src) ||
    /import\s+\{[^}]*\bLogo\b[^}]*\}\s+from/.test(src) ||
    /import\s+Logo\s+from/.test(src) ||
    /from\s+['"`][^'"`]*design-system\/Logo['"`]/.test(src)
  );
}

/**
 * Public logo assets that count as a real brand mark file.
 *
 * @param {string} appDir App root.
 * @returns {{ path: string, bytes: number }[]}
 */
export function publicLogoAssets(appDir) {
  const pub = join(appDir, 'public');
  if (!existsSync(pub)) return [];
  const out = [];
  for (const name of readdirSync(pub)) {
    if (!/\.(png|jpe?g|webp|svg|gif)$/i.test(name)) continue;
    if (!/(?:logo|mark|lockup|brand)/i.test(name)) continue;
    const full = join(pub, name);
    const bytes = statSync(full).size;
    if (bytes >= MIN_FAVICON_BYTES) out.push({ path: full, bytes });
  }
  return out;
}

/**
 * Read design-system Logo.tsx when the monorepo layout is present.
 *
 * @param {string} appDir App root.
 * @returns {string}
 */
function readSharedLogoSource(appDir) {
  // app/src → repo design-system (dashboard/app-builder layout)
  const candidates = [
    join(appDir, '..', 'design-system', 'Logo.tsx'),
    join(appDir, 'design-system', 'Logo.tsx'),
    join(appDir, 'src', 'components', 'shell', 'Logo.tsx'),
    join(appDir, 'src', 'components', 'Logo.tsx')
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        return readFileSync(p, 'utf8');
      } catch {
        // skip unreadable
      }
    }
  }
  return '';
}

/**
 * Resolve a public asset path from an href/src like "/favicon.svg" or "favicon.png".
 *
 * @param {string} appDir App root.
 * @param {string} ref Path from HTML.
 * @returns {string | null} Absolute filesystem path or null.
 */
function resolvePublic(appDir, ref) {
  if (!ref || ref.startsWith('http') || ref.startsWith('data:')) return null;
  const clean = ref.replace(/^\//, '').split('?')[0].split('#')[0];
  if (!clean) return null;
  const full = join(appDir, 'public', clean);
  if (existsSync(full)) return full;
  // Also accept assets living at app root public-equivalent for fixtures.
  const alt = join(appDir, clean);
  return existsSync(alt) ? alt : null;
}

/**
 * Read index.html (or public/index.html) for link/meta asset refs.
 *
 * @param {string} appDir App root.
 * @returns {string}
 */
function readIndexHtml(appDir) {
  for (const rel of ['index.html', 'public/index.html']) {
    const p = join(appDir, rel);
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  return '';
}

/**
 * Find favicon and OG file paths declared by the app.
 *
 * @param {string} appDir App root.
 * @param {string} html index.html contents.
 * @returns {{ favicon: string | null, og: string | null, faviconRef: string | null, ogRef: string | null }}
 */
export function findSeoImagePaths(appDir, html) {
  const favMatch =
    /<link[^>]+rel\s*=\s*['"`](?:icon|shortcut icon|apple-touch-icon)['"`][^>]+href\s*=\s*['"`]([^'"`]+)['"`]/i.exec(
      html
    ) ||
    /<link[^>]+href\s*=\s*['"`]([^'"`]+)['"`][^>]+rel\s*=\s*['"`](?:icon|shortcut icon|apple-touch-icon)['"`]/i.exec(
      html
    );
  const ogMatch =
    /<meta[^>]+property\s*=\s*['"`]og:image['"`][^>]+content\s*=\s*['"`]([^'"`]+)['"`]/i.exec(
      html
    ) ||
    /<meta[^>]+content\s*=\s*['"`]([^'"`]+)['"`][^>]+property\s*=\s*['"`]og:image['"`]/i.exec(
      html
    );

  const faviconRef = favMatch?.[1] ?? null;
  const ogRef = ogMatch?.[1] ?? null;

  // Fall back to conventional public filenames when HTML is minimal (fixtures).
  let favicon = faviconRef ? resolvePublic(appDir, faviconRef) : null;
  let og = ogRef ? resolvePublic(appDir, ogRef) : null;

  const pub = join(appDir, 'public');
  if (!favicon && existsSync(pub)) {
    const names = readdirSync(pub);
    const hit = names.find((n) => /^favicon/i.test(n) || /^apple-touch/i.test(n));
    if (hit) favicon = join(pub, hit);
  }
  if (!og && existsSync(pub)) {
    const names = readdirSync(pub);
    const hit = names.find((n) => /^og[.-]|og.*\.(png|jpe?g|webp|svg)$/i.test(n));
    if (hit) og = join(pub, hit);
  }

  return { favicon, og, faviconRef, ogRef };
}

/**
 * Whether a file is a trivially small placeholder asset.
 *
 * @param {string} filePath Absolute path.
 * @param {number} minBytes Minimum substantive size.
 * @returns {{ trivial: boolean, bytes: number }}
 */
export function isTrivialAsset(filePath, minBytes) {
  if (!existsSync(filePath)) return { trivial: true, bytes: 0 };
  const bytes = statSync(filePath).size;
  if (bytes < minBytes) return { trivial: true, bytes };
  // Tiny SVG that is only rect/circle + text is still a hand-drawn stub even if
  // it barely clears the floor — catch the "AZ" favicon pattern by content.
  if (/\.svg$/i.test(filePath) && bytes < 2048) {
    const body = readFileSync(filePath, 'utf8');
    const hasPath = /<path\b/i.test(body);
    const hasText = /<text\b/i.test(body);
    const shapeOnly = /<(?:rect|circle|ellipse|line|polyline)\b/i.test(body);
    if (!hasPath && shapeOnly && hasText) {
      return { trivial: true, bytes };
    }
    if (!hasPath && shapeOnly && bytes < minBytes * 2) {
      return { trivial: true, bytes };
    }
  }
  return { trivial: false, bytes };
}

/**
 * Run the check.
 *
 * @param {string} appDir App directory.
 * @param {{pass:()=>never, fail:(m?:string)=>never, notApplicable:(w?:string)=>never}} io
 */
export function runBrandMark(appDir, io) {
  const sources = shellSources(appDir);
  if (sources.length === 0) {
    io.notApplicable('no src/ shell to inspect');
  }

  const joined = sources.map((f) => readFileSync(f, 'utf8')).join('\n');
  const sharedLogo = readSharedLogoSource(appDir);
  const assetSource = `${joined}\n${sharedLogo}`;
  const failures = [];

  const placeholder = detectPlaceholderMark(joined);
  if (placeholder) {
    failures.push(
      `header brand mark is a ${placeholder.kind} placeholder ("${placeholder.snippet}") — ` +
        'use a real raster or substantive vector asset, not a text span or emoji'
    );
  }

  const logos = publicLogoAssets(appDir);
  const refsAsset =
    shellReferencesBrandAsset(assetSource) ||
    (usesLogoComponent(joined) && logos.length > 0);

  if (!refsAsset && !placeholder) {
    // No placeholder pattern matched, but also no real asset reference — still fail.
    failures.push(
      'shell does not reference a real brand-mark asset (img/import of logo|mark|brand|lockup, ' +
        'Logo component backed by public logo assets, or substantive inline SVG with path data)'
    );
  }

  // Logo component is only a pass when public/ actually holds a substantive mark.
  if (usesLogoComponent(joined) && logos.length === 0 && !shellReferencesBrandAsset(assetSource)) {
    failures.push(
      'shell mounts a Logo component but public/ has no substantive logo|mark|lockup asset'
    );
  }

  // When a placeholder is present, we already fail — still check assets so the
  // report names every defect (favicon stub + text mark) rather than only the first.
  const html = readIndexHtml(appDir);
  const { favicon, og, faviconRef, ogRef } = findSeoImagePaths(appDir, html);

  if (!favicon) {
    failures.push(
      `favicon absent (no link rel=icon target under public/${faviconRef ? ` — ref ${faviconRef}` : ''})`
    );
  } else {
    const { trivial, bytes } = isTrivialAsset(favicon, MIN_FAVICON_BYTES);
    if (trivial) {
      failures.push(
        `favicon is a trivially small hand-drawn placeholder (${relative(appDir, favicon)}: ${bytes} bytes; ` +
          `need a real asset ≥ ${MIN_FAVICON_BYTES} bytes, not a rect+text stub)`
      );
    }
  }

  if (!og) {
    failures.push(
      `OG image absent (no og:image under public/${ogRef ? ` — ref ${ogRef}` : ''})`
    );
  } else {
    const { trivial, bytes } = isTrivialAsset(og, MIN_OG_BYTES);
    if (trivial) {
      failures.push(
        `OG image is a trivially small hand-drawn placeholder (${relative(appDir, og)}: ${bytes} bytes; ` +
          `need a real asset ≥ ${MIN_OG_BYTES} bytes)`
      );
    }
  }

  // When shell references a logo file, require that file to exist and be substantive
  // if it resolves under public/.
  const logoPathMatch =
    /(?:src|href)\s*=\s*['"`](\/[^'"`]*(?:logo|mark|brand|lockup)[^'"`]*)['"`]/i.exec(joined);
  if (logoPathMatch?.[1]) {
    const logoFile = resolvePublic(appDir, logoPathMatch[1]);
    if (!logoFile) {
      failures.push(`shell references ${logoPathMatch[1]} but that file is missing under public/`);
    } else {
      const { trivial, bytes } = isTrivialAsset(logoFile, MIN_FAVICON_BYTES);
      if (trivial) {
        failures.push(
          `referenced brand asset is trivial (${relative(appDir, logoFile)}: ${bytes} bytes)`
        );
      }
    }
  }

  if (failures.length > 0) {
    io.fail(failures.join('\n'));
  }

  console.log('real brand mark asset referenced by shell; favicon and OG are substantive');
  io.pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node fe-brand-mark.mjs <appDir>');
    process.exit(2);
  }
  runBrandMark(dir, {
    pass: () => process.exit(0),
    fail: (m) => {
      if (m) console.error(m);
      process.exit(1);
    },
    notApplicable: (w) => {
      if (w) console.error(`n/a: ${w}`);
      process.exit(3);
    }
  });
}
