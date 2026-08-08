#!/usr/bin/env node
/**
 * The `qa-runtime` role: probe the DEPLOYED routes and bindings for real.
 *
 * A 200 on the homepage only proves static assets served. This probes each API
 * route with the right method and records what actually came back, because an
 * endpoint that exists on disk is not an endpoint that answers -- pet-sitter had
 * a working 172-line assistant worker whose UI never called it, and two POST-only
 * routes that looked like 404s under GET.
 *
 * Writes evidence/api-live.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = /^--([^=]+)=([\s\S]*)$/.exec(a);
    return m ? [[m[1], m[2]]] : [];
  })
);
if (!args.slug) {
  process.stderr.write('usage: qa-runtime.mjs --slug=X [--repoRoot=.] [--url=...]\n');
  process.exit(2);
}
const appDir = join(resolve(args.repoRoot ?? process.cwd()), args.slug);

/**
 * Resolve the deployed URL from the app's own recorded claim rather than a guess.
 * @returns {string|null} the production URL
 */
function deployedUrl() {
  if (args.url) return args.url;
  const claims = join(appDir, '.redanvil', 'claims.json');
  if (!existsSync(claims)) return null;
  try {
    const j = JSON.parse(readFileSync(claims, 'utf8'));
    return j.deployUrl ?? j.url ?? null;
  } catch {
    return null;
  }
}

const base = deployedUrl();
if (!base) {
  process.stderr.write(
    'no deployed URL in .redanvil/claims.json and none passed -- qa-runtime cannot probe an app that has not shipped\n'
  );
  process.exit(1);
}

/** Routes discovered from the functions directory, so the probe tracks the app. */
const fnDir = join(appDir, 'functions', 'api');
/** @type {string[]} */
const routes = ['/'];
if (existsSync(fnDir)) {
  const { readdirSync } = await import('node:fs');
  for (const e of readdirSync(fnDir, { withFileTypes: true, recursive: true })) {
    if (!e.isFile() || !e.name.endsWith('.ts')) continue;
    if (e.name.startsWith('_')) continue;
    const rel = join(e.parentPath ?? e.path, e.name)
      .replace(fnDir, '')
      .replace(/\\/g, '/')
      .replace(/\.ts$/, '')
      .replace(/\/index$/, '');
    // A [id] segment needs a real id, not a literal -- inserting the literal is
    // what put a "Sample Sitter" row into production to make a probe pass.
    if (/\[/.test(rel)) continue;
    routes.push(`/api${rel}`);
  }
}

/**
 * Probe one route with both methods, since POST-only routes 404 under GET.
 * @param {string} path route path
 * @returns {Promise<object>} the recorded result
 */
async function probe(path) {
  /** @type {Record<string, {status:number, contentType:string, bodyHead:string}>} */
  const byMethod = {};
  for (const method of ['GET', 'POST']) {
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'POST' ? '{}' : undefined
      });
      const text = (await res.text()).slice(0, 120);
      byMethod[method] = {
        status: res.status,
        contentType: res.headers.get('content-type') ?? '',
        bodyHead: text
      };
    } catch (err) {
      byMethod[method] = { status: 0, contentType: '', bodyHead: String(err).slice(0, 80) };
    }
  }
  // SPA fallback check: Pages answers unmatched paths with index.html at 200, so
  // a status code alone proves nothing about whether the route exists.
  const looksLikeFallback = Object.values(byMethod).every((r) => /text\/html/.test(r.contentType));
  return { path, methods: byMethod, looksLikeSpaFallback: looksLikeFallback };
}

const results = [];
for (const r of [...new Set(routes)]) results.push(await probe(r));

const realApi = results.filter((r) => r.path !== '/' && !r.looksLikeSpaFallback);
const fallbacks = results.filter((r) => r.path !== '/' && r.looksLikeSpaFallback);

mkdirSync(join(appDir, 'evidence'), { recursive: true });
writeFileSync(
  join(appDir, 'evidence', 'api-live.json'),
  JSON.stringify(
    {
      url: base,
      checkedAt: new Date().toISOString(),
      routesProbed: results.length,
      realEndpoints: realApi.length,
      spaFallbacks: fallbacks.map((f) => f.path),
      results
    },
    null,
    2
  ) + '\n'
);

console.log(
  `qa-runtime: ${results.length} route(s) probed, ${realApi.length} real endpoint(s)` +
    (fallbacks.length ? `, ${fallbacks.length} answering as SPA fallback: ${fallbacks.map((f) => f.path).join(', ')}` : '')
);
if (realApi.length === 0) {
  process.stderr.write('no route answered as a real endpoint -- the backend is not reachable\n');
  process.exit(1);
}
