#!/usr/bin/env node
/**
 * Integration scan — look for an existing API or library before building a
 * capability yourself (R29).
 *
 * Searches GitHub for real, maintained implementations of the capability and
 * writes `INTEGRATIONS.md`: what exists, what it costs, what licence it carries,
 * whether it runs in the target runtime, and the build-vs-integrate decision
 * with its reason.
 *
 * The artifact is the point. "I looked and there was nothing" is unverifiable;
 * a table of candidates with stars, licence, last-push and a stated verdict is
 * checkable, and it stops the next person re-doing the search.
 *
 * Usage:
 *   node integration_scan.mjs --capability "flight search" \
 *     --terms "google flights api,flight search,airport autocomplete" \
 *     --runtime "cloudflare workers (javascript)" --out INTEGRATIONS.md
 *
 * Requires GITHUB_TOKEN (or GH_TOKEN) in the environment for the search API.
 * Exits non-zero if nothing could be searched, so a build step can depend on it.
 */
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1];
};

const capability = flag('capability');
const terms = String(flag('terms', '') ?? '')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);
const runtime = flag('runtime', 'unspecified');
const out = flag('out', 'INTEGRATIONS.md');
const perTerm = Number(flag('limit', '6'));

if (!capability || terms.length === 0) {
  console.error(
    'usage: node integration_scan.mjs --capability "<what you are building>" ' +
      '--terms "a,b,c" [--runtime "..."] [--out INTEGRATIONS.md]'
  );
  process.exit(2);
}

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
if (!token) {
  console.error('integration_scan FAIL: set GITHUB_TOKEN (or GH_TOKEN) to use the search API');
  process.exit(1);
}

/** Search GitHub repositories for one term. */
async function search(term) {
  const url =
    `https://api.github.com/search/repositories?q=${encodeURIComponent(term)}` +
    `&sort=stars&order=desc&per_page=${perTerm}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error(`${res.status} for "${term}"`);
  const body = await res.json();
  return Array.isArray(body.items) ? body.items : [];
}

/** Stale after two years with no push — a dead dependency is a liability. */
const STALE_MS = 1000 * 60 * 60 * 24 * 365 * 2;

const found = new Map();
for (const term of terms) {
  let rows;
  try {
    rows = await search(term);
  } catch (err) {
    console.error(`  ! ${term}: ${String(err).slice(0, 90)}`);
    continue;
  }
  console.log(`  ${term}: ${rows.length} repo(s)`);
  for (const r of rows) {
    if (!found.has(r.full_name)) found.set(r.full_name, { ...r, foundVia: term });
  }
}

if (found.size === 0) {
  console.error('integration_scan FAIL: no candidates found — widen the terms');
  process.exit(1);
}

const rows = [...found.values()].sort((a, b) => b.stargazers_count - a.stargazers_count);
const now = Date.now();

const table = rows.map((r) => {
  const pushed = (r.pushed_at ?? '').slice(0, 10);
  const stale = r.pushed_at && now - Date.parse(r.pushed_at) > STALE_MS;
  const licence = r.license?.spdx_id ?? 'none';
  const flags = [
    r.archived ? 'archived' : '',
    stale ? 'stale' : '',
    licence === 'NOASSERTION' || licence === 'none' ? 'licence unclear' : ''
  ]
    .filter(Boolean)
    .join(', ');
  return `| [${r.full_name}](${r.html_url}) | ${r.stargazers_count} | ${r.language ?? '?'} | ${licence} | ${pushed} | ${flags || '-'} |`;
});

const doc = `# Integration scan — ${capability}

Ran before building. **Reuse beats rebuild**, but only when the licence, the
runtime and the maintenance status all hold — so each candidate is recorded with
those facts and a verdict, not just a link.

- **Capability:** ${capability}
- **Target runtime:** ${runtime}
- **Search terms:** ${terms.map((t) => `\`${t}\``).join(', ')}
- **Candidates found:** ${rows.length}

## Candidates

| repo | stars | language | licence | last push | flags |
|---|---:|---|---|---|---|
${table.join('\n')}

## Assessment

Fill this in — the table above is evidence, not a decision. For each serious
candidate state:

- **Cost** at the volume this app needs, including what the free tier actually
  returns (a free tier that omits the data you need is not a free tier).
- **Licence** fit. \`NOASSERTION\` means unclear, which is a real adoption risk.
- **Runtime** fit. A Python library cannot run in a Cloudflare Worker; needing a
  separate service is a cost even when the library is free.
- **Terms of service.** A library that reverse-engineers a provider's internal
  endpoints may work perfectly and still be against that provider's terms.
- **Failure mode.** What happens when it breaks, and who notices.

## Decision

**Build / integrate / hybrid:** …

**Why:** …

**Revisit when:** …
`;

writeFileSync(out, doc);
console.log(`\nintegration_scan: ${rows.length} candidate(s) -> ${out}`);
console.log('  Now fill in Assessment and Decision — the table is evidence, not a conclusion.');
