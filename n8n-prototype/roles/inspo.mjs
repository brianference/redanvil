#!/usr/bin/env node
/**
 * The `inspo` role: reference intake from shipping products.
 *
 * Constraints are not a design. The rule pack is identical for every app, so
 * following only the rules produces the same centred column under a sticky
 * header every time. Direction has to come from products that actually shipped.
 *
 * Scraping galleries is permitted as of 2026-08-06 at the owner's instruction.
 * What is NOT permitted is redistribution: screenshots stay local and gitignored,
 * and SOURCES.md is the committed record. Take one idea from each; never clone a
 * layout, a palette or a wordmark.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).flatMap((a) => {
  const m = /^--([^=]+)=([\s\S]*)$/.exec(a); return m ? [[m[1], m[2]]] : [];
}));
if (!args.slug) { process.stderr.write('usage: inspo.mjs --slug=X\n'); process.exit(2); }
const appDir = join(resolve(args.repoRoot ?? process.cwd()), args.slug);
const briefPath = join(appDir, 'docs', 'PRODUCT-BRIEF.md');
if (!existsSync(briefPath)) { process.stderr.write('no product brief -- inspo cannot precede product\n'); process.exit(1); }
const brief = readFileSync(briefPath, 'utf8');

// Search terms come from the brief so the intake tracks what is being built.
const term = (brief.match(/^#\s*Product brief\s*[—-]\s*(.+)$/m)?.[1] ?? args.slug).replace(/-/g, ' ').trim();

/**
 * The iTunes Search API is a public, documented endpoint that returns real
 * shipping apps with rating counts. A design that survived millions of users is
 * evidence; a concept shot is not.
 * @returns {Promise<object[]>} ranked apps
 */
async function appStore() {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&limit=12&country=us`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`itunes search ${res.status}`);
  const body = await res.json();
  return (body.results ?? [])
    .map((r) => ({
      name: r.trackName,
      genre: r.primaryGenreName,
      ratings: r.userRatingCount ?? 0,
      url: r.trackViewUrl,
      shots: (r.screenshotUrls ?? []).length
    }))
    .filter((r) => r.ratings > 0)
    .sort((a, b) => b.ratings - a.ratings);
}

let apps = [];
try { apps = await appStore(); }
catch (err) { process.stderr.write(`reference intake failed: ${String(err)}\n`); process.exit(1); }

if (apps.length < 3) {
  process.stderr.write(`only ${apps.length} rated app(s) found for "${term}" -- too thin to call a reference intake\n`);
  process.exit(1);
}

const md = `# Design reference intake — ${args.slug}

Captured ${new Date().toISOString().slice(0, 10)} by \`roles/inspo.mjs\` from the public
iTunes Search API, searching "${term}".

Ranked by rating count, because a design that survived millions of users is
evidence and a concept shot is not.

**Take ONE idea from each. Do not clone a layout, a palette, a brand mark or a
wordmark.** Screenshots stay local and gitignored; this file is the committed
record of where direction came from.

| app | genre | ratings | shots | store |
|---|---|---|---|---|
${apps.map((a) => `| ${a.name} | ${a.genre} | ${a.ratings.toLocaleString('en-US')} | ${a.shots} | [store](${a.url}) |`).join('\n')}

## How to use this

Study what the top few do with the fold, the result unit, and how they show
price, availability and trust. Then build something structurally different that
borrows the *insight*, not the layout.
`;

mkdirSync(join(appDir, 'design-refs'), { recursive: true });
writeFileSync(join(appDir, 'design-refs', 'SOURCES.md'), md);
console.log(`inspo: ${apps.length} shipping apps, top "${apps[0].name}" at ${apps[0].ratings.toLocaleString('en-US')} ratings`);
