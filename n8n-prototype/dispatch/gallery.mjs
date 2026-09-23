/**
 * One self-contained HTML page for a pending record.
 * Dark background, a responsive grid, numbered options, images as data URIs.
 * Refuses to write when the page would exceed GALLERY_MAX_BYTES.
 */
import { readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { GALLERY_MAX_BYTES } from './constants.mjs';
import { isInside } from './options.mjs';

/** MIME types for the image extensions options.mjs collects. */
const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

/**
 * Escape text for an HTML text node or attribute.
 * @param {string} value raw text
 * @returns {string}
 */
export function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * @param {string} filePath absolute path
 * @returns {string} data URI
 */
function imageDataUri(filePath) {
  const ext = extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) throw new Error(`not an image: ${filePath}`);
  const bytes = readFileSync(filePath);
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

/**
 * Rewrite relative image src attributes to data URIs so an HTML option
 * (gallery.html) still shows its pictures inside the page.
 * @param {string} html option HTML
 * @param {string} htmlFile absolute path of the option file
 * @param {string} repoRoot repository root, files outside it are left alone
 * @returns {string}
 */
function embedRelativeImages(html, htmlFile, repoRoot) {
  return html.replace(
    /\b(src\s*=\s*)(['"])([^'"]+)\2/gi,
    (whole, attr, quote, src) => {
      if (/^(?:data:|https?:|\/\/)/i.test(src)) return whole;
      const abs = resolve(dirname(htmlFile), src);
      if (!isInside(repoRoot, abs)) return whole;
      const ext = extname(abs).toLowerCase();
      if (!MIME_BY_EXT[ext]) return whole;
      try {
        return `${attr}${quote}${imageDataUri(abs)}${quote}`;
      } catch {
        return whole;
      }
    }
  );
}

/**
 * HTML for one option. Missing files render as a label and a note, not a
 * thrown error: the owner still sees that the option was declared.
 * @param {number} number 1-based index
 * @param {{ label: string, path: string }} option registry option
 * @param {string} repoRoot repository root
 * @returns {string}
 */
function renderOption(number, option, repoRoot) {
  const label = escapeHtml(option.label);
  const abs = join(repoRoot, option.path);
  const caption = `<figcaption>${number}. ${label}</figcaption>`;
  if (!isInside(repoRoot, abs)) {
    return `<figure>${caption}<p>Path is outside the repo.</p></figure>`;
  }
  let body;
  try {
    const ext = extname(abs).toLowerCase();
    if (MIME_BY_EXT[ext]) {
      body = `<img alt="${label}" src="${imageDataUri(abs)}">`;
    } else if (ext === '.html') {
      const html = embedRelativeImages(readFileSync(abs, 'utf8'), abs, repoRoot);
      // Entity-escape so a `</iframe>` inside the option cannot close our tag.
      // The browser decodes the attribute before using it as the frame document.
      body = `<iframe title="${label}" sandbox="" srcdoc="${escapeHtml(html)}"></iframe>`;
    } else {
      body = '<p>Not an image or HTML file.</p>';
    }
  } catch (error) {
    const missing = error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
    body = `<p>${missing ? 'File is missing.' : 'Could not read the file.'}</p>`;
  }
  return `<figure>${caption}${body}</figure>`;
}

/**
 * Build the page. Does not write it.
 * @param {{ title?: string, summary?: string, options?: { label: string, path: string }[] }} record pending record
 * @param {string} repoRoot repository root
 * @returns {string} HTML document
 */
export function renderGallery(record, repoRoot) {
  const title = typeof record.title === 'string' ? record.title : 'Decision';
  const summary = typeof record.summary === 'string' ? record.summary : '';
  const options = Array.isArray(record.options) ? record.options : [];
  const figures = options.map((option, index) => renderOption(index + 1, option, repoRoot));
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; background: #121212; color: #f2f2f2; font: 18px/1.45 system-ui, sans-serif; }
  header { padding: 24px 24px 0; max-width: 72rem; }
  h1 { font-size: 1.6rem; margin: 0 0 8px; }
  p { margin: 0; color: #d0d0d0; }
  main { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; padding: 24px; }
  figure { margin: 0; background: #1c1c1c; border-radius: 12px; padding: 16px; }
  figcaption { font-size: 1.6rem; font-weight: 700; margin-bottom: 12px; }
  img, iframe { width: 100%; height: auto; min-height: 240px; background: #0e0e0e; border: 0; border-radius: 8px; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(summary)}</p>
</header>
<main>
${figures.join('\n')}
</main>
</body>
</html>
`;
}

/**
 * Render and refuse when the UTF-8 size would exceed the limit.
 * @param {object} record pending record
 * @param {string} repoRoot repository root
 * @returns {string} HTML that is within the limit
 */
export function galleryHtml(record, repoRoot) {
  const html = renderGallery(record, repoRoot);
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > GALLERY_MAX_BYTES) {
    throw new Error(
      `gallery would be ${bytes} bytes, over the ${GALLERY_MAX_BYTES} byte limit`
    );
  }
  return html;
}
