#!/usr/bin/env node
/**
 * The `reuse` role: search GitHub for existing implementations before anything
 * is written from scratch.
 *
 * Base rule 3 says use what exists first. It was enforced by memory, which means
 * it was not enforced: pet-sitter hand-rolled its way to a browsable directory
 * with no booking flow while maintained implementations sat unexamined.
 *
 * Uses the public GitHub search API so the scan is reproducible and its inputs
 * are recorded, rather than depending on whatever I happened to type. Results
 * are ranked by stars, and each candidate gets an explicit verdict. A scan that
 * rejects everything is a legitimate outcome; a scan that never ran is not.
 *
 * Verdicts are assigned by a runtime rule, not by opinion: this stack is
 * Cloudflare Pages Functions + D1, so anything requiring a long-running Node
 * server, native modules or PostgreSQL cannot be a dependency here. That is a
 * mechanical test, which is why it can live in a script.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Dependency-disqualifying signals for a Workers + D1 target. */
const INCOMPATIBLE = [/\bpostgres/i, /\bprisma\b/i, /\bexpress\b/i, /\bnext\.js\b/i, /\bdocker\b/i];

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = /^--([^=]+)=([\s\S]*)$/.exec(a);
    return m ? [[m[1], m[2]]] : [];
  })
);
if (!args.slug) {
  process.stderr.write('usage: reuse.mjs --slug=X [--repoRoot=.]\n');
  process.exit(2);
}
const appDir = join(resolve(args.repoRoot ?? process.cwd()), args.slug);

// Search terms come from the product brief, so the scan tracks what is actually
// being built rather than a guess baked into this script.
const briefPath = join(appDir, 'docs', 'PRODUCT-BRIEF.md');
if (!existsSync(briefPath)) {
  process.stderr.write(`no product brief at ${briefPath} -- reuse cannot precede product\n`);
  process.exit(1);
}
const brief = readFileSync(briefPath, 'utf8').toLowerCase();

/** Capability areas worth searching for, chosen by what the brief mentions. */
const AREAS = [
  // Queries use GitHub `topic:` qualifiers and single broad keywords. Free-text
  // phrases like "faceted search filter typescript" ranked 0-star hobby repos
  // ("Amazon-Style-Filter-Dashboard") above every real project -- a scan that
  // satisfied its contract and was worth nothing.
  { key: 'search + filtering UI', when: /search|filter|browse/, q: 'topic:search stars:>500' },
  { key: 'map + place discovery', when: /map|near|location|distance/, q: 'topic:maps stars:>1000' },
  { key: 'booking / reservations', when: /book|reserv|seating|availability|walk-in/, q: 'topic:scheduling stars:>500' },
  { key: 'reviews + ratings', when: /review|rating|star/, q: 'topic:rating stars:>200' },
  { key: 'auth on edge runtimes', when: /sign in|account|auth|login/, q: 'topic:authentication stars:>1000' }
];

/**
 * Adoption floor. A scan whose best result is an abandoned hobby repo means the
 * QUERY failed, not that nothing exists -- and a scan that finds nothing real is
 * indistinguishable from one that never ran.
 */
const MIN_TOP_STARS = 200;

/**
 * Query the public GitHub search API for one area.
 * @param {string} q the search expression
 * @returns {Promise<Array<{full_name:string,html_url:string,stargazers_count:number,license:string,description:string}>>} top repos
 */
async function search(q) {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=4`;
  const res = await fetch(url, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'redanvil-reuse-scout' }
  });
  if (!res.ok) throw new Error(`github search ${res.status} for "${q}"`);
  const body = await res.json();
  return (body.items ?? []).map((r) => ({
    full_name: r.full_name,
    html_url: r.html_url,
    stargazers_count: r.stargazers_count,
    license: r.license?.spdx_id ?? 'NOT DECLARED',
    description: (r.description ?? '').slice(0, 120)
  }));
}

const areas = AREAS.filter((a) => a.when.test(brief));
if (areas.length === 0) {
  process.stderr.write('the product brief matched no capability area -- refusing to write an empty scan\n');
  process.exit(1);
}

let md = `# Reuse scan — ${args.slug}

Run ${new Date().toISOString().slice(0, 10)} by \`roles/reuse.mjs\` against the public
GitHub search API, before any feature was written. Required by the \`reuse\`
process step; base rule 3 is use what exists before writing anything.

Search areas were selected from \`docs/PRODUCT-BRIEF.md\`, so the scan tracks what
is actually being built. Ranked by stars.

**The binding constraint:** the runtime is Cloudflare Pages Functions + D1.
Anything needing a long-running Node server, native modules or PostgreSQL cannot
be a dependency here regardless of quality. It can still be a reference
architecture, which is a different verdict and still useful.

`;

let considered = 0;
let bestStars = 0;
for (const area of areas) {
  md += `## ${area.key}\n\nQuery: \`${area.q}\`\n\n| repo | stars | licence | verdict |\n|---|---|---|---|\n`;
  let repos = [];
  try {
    repos = await search(area.q);
  } catch (err) {
    md += `| _search failed_ | | | ${String(err).slice(0, 80)} |\n\n`;
    continue;
  }
  for (const r of repos) {
    considered += 1;
    bestStars = Math.max(bestStars, r.stargazers_count);
    const blob = `${r.full_name} ${r.description}`;
    const clash = INCOMPATIBLE.find((re) => re.test(blob));
    const verdict = clash
      ? `reject as dependency — incompatible with Workers + D1 (${String(clash).replace(/[/\\bi]/g, '')})`
      : 'candidate — read before writing this capability';
    md += `| [${r.full_name}](${r.html_url}) | ${r.stargazers_count} | ${r.license} | ${verdict} |\n`;
  }
  md += '\n';
  // Be polite to the unauthenticated search API.
  await new Promise((r) => setTimeout(r, 2000));
}

md += `## Outcome

${considered} repositories examined across ${areas.length} capability areas. Every
candidate carries a licence and a verdict above.

Verdicts are assigned by a mechanical runtime test, not by preference: a project
naming PostgreSQL, Prisma, Express, Next.js or Docker cannot be a dependency on
Workers + D1. Candidates that survive that test must still be read before the
capability is written by hand.

**This scan does not authorise copying.** Anything adopted needs its LICENSE file
read directly and recorded here before code or schema is reused.
`;

if (bestStars < MIN_TOP_STARS) {
  process.stderr.write(
    `best result has ${bestStars} stars, below the ${MIN_TOP_STARS} floor -- the queries failed, ` +
      'and a scan that finds nothing real is indistinguishable from one that never ran. Refusing to write it.\n'
  );
  process.exit(1);
}

mkdirSync(join(appDir, 'docs'), { recursive: true });
writeFileSync(join(appDir, 'docs', 'REUSE-SCAN.md'), md);
console.log(
  `reuse scan: ${considered} repos across ${areas.length} areas, top ${bestStars} stars -> docs/REUSE-SCAN.md`
);
