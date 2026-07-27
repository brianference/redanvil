#!/usr/bin/env node
/**
 * Competitor scan — look at what the real products in this category actually
 * ship, including the pages nobody thinks about (R31).
 *
 * R23 sources App Store screenshots for the product screen. This covers the rest
 * of the site: the terms, privacy, about and contact pages, and the features a
 * category treats as table stakes.
 *
 * It fetches each competitor's pages, records their section headings and length,
 * and writes `COMPETITORS.md`. Headings and word counts are facts; the
 * assessment is yours.
 *
 * Nothing is copied — structure is read, prose is not reproduced. Take the
 * mechanism and change the execution (R23).
 *
 * Usage:
 *   node competitor_scan.mjs --product "flight search" \
 *     --sites "southwest.com,expedia.com,united.com" \
 *     --pages "terms,privacy,about,contact" --out COMPETITORS.md
 *
 * Exits non-zero if nothing could be fetched, so a build step can depend on it.
 */
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1];
};

const product = flag('product');
const sites = String(flag('sites', '') ?? '')
  .split(',')
  .map((s) => s.trim().replace(/^https?:\/\//, ''))
  .filter(Boolean);
const pages = String(flag('pages', 'terms,privacy,about,contact'))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const out = flag('out', 'COMPETITORS.md');

if (!product || sites.length === 0) {
  console.error(
    'usage: node competitor_scan.mjs --product "<category>" --sites "a.com,b.com" ' +
      '[--pages "terms,privacy,about,contact"] [--out COMPETITORS.md]'
  );
  process.exit(2);
}

/** Common paths a given page type lives at. */
const CANDIDATES = {
  terms: ['/terms', '/terms-of-service', '/terms-and-conditions', '/legal/terms', '/tos'],
  privacy: ['/privacy', '/privacy-policy', '/legal/privacy', '/privacy-notice'],
  about: ['/about', '/about-us', '/company'],
  contact: ['/contact', '/contact-us', '/help', '/support']
};

/** Strip tags and collapse whitespace. */
const textOf = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Heading text in document order. */
function headings(html) {
  const found = [];
  const re = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const t = textOf(m[2]).slice(0, 90);
    if (t && t.length > 2) found.push(t);
  }
  return found;
}

/** Try each candidate path until one returns HTML. */
async function fetchPage(site, kind) {
  for (const path of CANDIDATES[kind] ?? [`/${kind}`]) {
    const url = `https://${site}${path}`;
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'text/html'
        },
        signal: AbortSignal.timeout(20000)
      });
      if (!res.ok) continue;
      const html = await res.text();
      const text = textOf(html);
      if (text.length < 400) continue;
      const hs = headings(html);
      return { url: res.url, words: text.split(/\s+/).length, headings: hs };
    } catch {
      /* try the next candidate path */
    }
  }
  return null;
}

const results = [];
for (const site of sites) {
  for (const kind of pages) {
    const r = await fetchPage(site, kind);
    if (r) {
      console.log(`  ${site} ${kind}: ${r.words} words, ${r.headings.length} headings`);
      results.push({ site, kind, ...r });
    } else {
      console.log(`  ${site} ${kind}: not reachable`);
      results.push({ site, kind, url: null, words: 0, headings: [] });
    }
  }
}

const reached = results.filter((r) => r.url !== null);
if (reached.length === 0) {
  console.error('competitor_scan FAIL: nothing fetched — check the sites list');
  process.exit(1);
}

const rows = results.map(
  (r) =>
    `| ${r.site} | ${r.kind} | ${r.url ? `[link](${r.url})` : 'not reachable'} | ${r.words} | ${r.headings.length} |`
);

const detail = reached
  .filter((r) => r.headings.length > 0)
  .map(
    (r) =>
      `### ${r.site} — ${r.kind}\n\n${r.words} words, ${r.headings.length} headings.\n\n` +
      r.headings
        .slice(0, 30)
        .map((h) => `- ${h}`)
        .join('\n') +
      (r.headings.length > 30 ? `\n- …and ${r.headings.length - 30} more` : '')
  )
  .join('\n\n');

const doc = `# Competitor scan — ${product}

What the real products in this category actually ship, including the pages that
get forgotten. Section headings and lengths below are **facts read from the live
pages**; the assessment is the judgement call.

Structure is read, prose is not reproduced. Take the mechanism and change the
execution.

- **Category:** ${product}
- **Competitors:** ${sites.join(', ')}
- **Pages checked:** ${pages.join(', ')}

## What they ship

| site | page | url | words | headings |
|---|---|---|---:|---:|
${rows.join('\n')}

## Section structure

${detail || '_No headings extracted — the pages may be client-rendered._'}

## Assessment

Fill this in.

### Features and controls we are missing

List what their PRODUCT screen has that ours does not. Missing table stakes is a
defect even when nothing in the spec named it.

### Page structure to adopt

Section count, table of contents, related-policy navigation, ordering.

### Components worth borrowing

Name each one and say how you will change its shape, density or position.

### What we deliberately will not do

And why.
`;

writeFileSync(out, doc);
console.log(`\ncompetitor_scan: ${reached.length}/${results.length} page(s) read -> ${out}`);
console.log('  Now fill in Assessment — the table is evidence, not a conclusion.');
