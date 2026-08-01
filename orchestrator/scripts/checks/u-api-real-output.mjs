#!/usr/bin/env node
/**
 * u-api-real-output — every API route the app ships answers a realistic call
 * with something real.
 *
 * Usage: node u-api-real-output.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 2 = infra, 3 = not applicable (no functions/api).
 *
 * This is u-test-feature-audit's idea applied to the other half of the app. The
 * audit inventories interactive controls from the RUNNING page and fails on any
 * control no test claims. This inventories API routes from `functions/api/**`
 * on disk and fails on any route no example claims, so a new endpoint is
 * unproven-by-default instead of silently unverified. In both cases the
 * inventory comes from the app, never from a list someone maintains — a list
 * only ever contains what its author remembered.
 *
 * The gap it closes: QuickFlight passed contrast, touch targets, painted width,
 * a green unit suite, zero console errors AND the control audit, while its
 * assistant endpoint had answered 502 for two months. Every control was proven
 * clickable. Nothing had ever checked what came back.
 *
 * What this decides and what it does not: this half is the machine-decidable
 * one — status, emptiness, placeholder text, declared breadth. Whether a
 * well-formed answer actually DELIVERS the product's claim is a judgment with
 * no code oracle, and that is the `det+judge` half, scored from a recorded
 * verdict over the evidence this file captures. Hence EVIDENCE_DIR: every
 * request and response is written out so the judge reads real captured traffic
 * rather than being asked to imagine it.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, sep, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  pickFreePort,
  killProcessTree,
  waitForReady,
  spawnWranglerPagesDev,
  ensureBuild
} from '../../../.github/scripts/runtime_parity.mjs';

/** Where the per-route examples live. */
export const EXAMPLES_FILE = join('tests', 'api-examples.json');
/** Captured live traffic, and the judge half's evidence. */
export const EVIDENCE_DIR = 'evidence';
/** Readiness ceiling for the local Workers runtime (ms). */
const READINESS_MS = 90_000;
/** Per-request ceiling (ms). */
const REQUEST_MS = 20_000;

/**
 * Text that looks like a claim but is not one.
 *
 * Same constant, same reasoning as u-test-feature-audit: an example whose route
 * reads "TODO" documents the gap instead of closing it, and without this the
 * check would pass because the key was present.
 */
const EMPTY_CLAIM = /^(todo|tbd|n\/?a|none|pending|\?+)\b/i;

/**
 * Placeholder content in a live response.
 *
 * Deliberately the same vocabulary u-data-no-placeholder greps for in source,
 * because the failure is identical wherever it surfaces: a plausible-looking
 * answer that nothing real produced. Matching on the response body catches the
 * case the static scan cannot see, where the seed data is fine and the handler
 * synthesises filler at runtime.
 */
const PLACEHOLDER =
  /lorem\s+ipsum|dolor\s+sit\s+amet|foo@(example|test)\.com|john\.?doe@|TODO:\s*replace|REPLACE_ME|<placeholder>|xxx-xxx-xxx/i;

/**
 * Read and parse a JSON file, or null.
 *
 * @param {string} file - Absolute path.
 * @returns {unknown|null} Parsed value.
 */
function readJson(file) {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Every API route the app ships, as served paths.
 *
 * Cloudflare Pages Functions routing is file-based, so the filesystem IS the
 * route table: `functions/api/health.ts` serves `/api/health`, and a `[id]`
 * segment is a parameter. Test files and `_middleware` are not routes.
 *
 * @param {string} appDir - App directory.
 * @returns {string[]} Served route paths, sorted.
 */
export function discoverRoutes(appDir) {
  const root = join(appDir, 'functions', 'api');
  if (!existsSync(root)) return [];
  /** @type {string[]} */
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (['.ts', '.js', '.tsx', '.mjs'].includes(extname(entry.name))) files.push(full);
    }
  };
  walk(root);
  const routes = new Set();
  for (const file of files) {
    const base = file.slice(0, -extname(file).length);
    const rel = relative(appDir, base).split(sep).join('/');
    if (/\.(test|spec)$/.test(rel)) continue;
    if (/(^|\/)_/.test(rel)) continue;
    // functions/api/foo -> /api/foo ; .../index -> the directory itself
    routes.add('/' + rel.replace(/^functions\//, '').replace(/\/index$/, ''));
  }
  return [...routes].sort();
}

/**
 * Fill a route's parameter segments from an example's declared values.
 *
 * `/api/flights/[id]` cannot be called literally; the example supplies `id`.
 * A parameterised route with no value is unusable, which is a failure rather
 * than something to paper over with an invented one.
 *
 * @param {string} route - Route path, possibly with `[param]` segments.
 * @param {Record<string, string|number>} [params] - Declared parameter values.
 * @returns {{path: string, missing: string[]}} Concrete path and any unfilled params.
 */
export function fillParams(route, params = {}) {
  const missing = [];
  const path = route.replace(/\[([^\]]+)\]/g, (_m, name) => {
    const value = params[name];
    if (value === undefined) {
      missing.push(name);
      return `[${name}]`;
    }
    return encodeURIComponent(String(value));
  });
  return { path, missing };
}

/**
 * Append an example's declared query string to a path.
 *
 * A GET route that filters or searches cannot be exercised without one:
 * `/api/airports` with no `q` is a different code path from the one users hit,
 * and proving the empty case answers proves nothing about the real one.
 *
 * @param {string} path - Concrete path.
 * @param {Record<string, string|number>} [query] - Declared query parameters.
 * @returns {string} Path with query string.
 */
export function withQuery(path, query) {
  if (query === undefined || query === null) return path;
  const entries = Object.entries(query);
  if (entries.length === 0) return path;
  const search = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${path}?${search}`;
}

/**
 * Whether a parsed response body carries nothing.
 *
 * A 200 carrying `{}`, `[]`, `""` or null answered without delivering anything,
 * which is indistinguishable from a stub that returns the right shape.
 *
 * @param {unknown} body - Parsed body.
 * @returns {boolean} True when empty.
 */
export function isEmptyBody(body) {
  if (body === null || body === undefined) return true;
  if (typeof body === 'string') return body.trim() === '';
  if (Array.isArray(body)) return body.length === 0;
  if (typeof body === 'object') return Object.keys(body).length === 0;
  return false;
}

/**
 * The primary collection in a response, for breadth checks.
 *
 * Looks for the conventional container names rather than guessing: a response
 * is `{items: []}` or `{results: []}` or a bare array.
 *
 * @param {unknown} body - Parsed body.
 * @returns {unknown[]|null} The collection, or null when there is not one.
 */
export function primaryCollection(body) {
  if (Array.isArray(body)) return body;
  if (body === null || typeof body !== 'object') return null;
  // Conventional names first, then ANY array-valued key. A fixed name list read
  // `{"flights": []}` as "no collection to count" and skipped the breadth check
  // entirely — an empty result set passing because the app named its own field.
  // Falling back to the sole array present means the check follows the app's
  // vocabulary rather than requiring the app to adopt the check's.
  for (const key of ['items', 'results', 'data', 'quotes', 'records']) {
    if (Array.isArray(body[key])) return body[key];
  }
  const arrays = Object.values(body).filter((v) => Array.isArray(v));
  // Only when it is unambiguous. With several arrays there is no principled way
  // to pick "the" collection, and guessing would measure the wrong one.
  return arrays.length === 1 ? arrays[0] : null;
}

/**
 * Whether a route's examples include one that expects success.
 *
 * @param {object[]} examples - Examples declared for one route.
 * @returns {boolean} True when at least one expects a 2xx.
 */
export function hasSuccessExample(examples) {
  return examples.some((e) => {
    const status = e?.expect?.status;
    const wanted = typeof status === 'number' ? status : 200;
    return wanted >= 200 && wanted < 300;
  });
}

/**
 * Judge one captured response against its example.
 *
 * @param {object} example - The declared example.
 * @param {{status: number|null, text: string, body: unknown, error: string|null}} got - What came back.
 * @returns {string|null} Failure reason, or null when it satisfies the example.
 */
export function evaluateResponse(example, got) {
  const want = example.expect ?? {};
  if (got.error !== null) return `request failed: ${got.error}`;
  const wantStatus = typeof want.status === 'number' ? want.status : 200;
  // A 5xx expectation is never legitimate. `expect.status` is written by the
  // same person who owns the handler, so a permanently failing route could be
  // waved through with `{"status": 500}` and the check would agree it met
  // expectations. A server error is the endpoint failing, whoever declared it.
  //
  // A 4xx expectation IS legitimate and is checked elsewhere: answering 404 for
  // an absent record, or 400 for a malformed body, is real behaviour worth
  // proving. What that cannot do is stand in for the route working at all, so
  // the 2xx requirement is enforced per ROUTE rather than per example — see
  // `hasSuccessExample`.
  if (wantStatus >= 500) {
    return (
      `the example declares status ${wantStatus}. A 5xx expectation declares the ` +
      'endpoint broken rather than proving it works.'
    );
  }
  if (got.status !== wantStatus) {
    return `expected status ${wantStatus}, got ${got.status}${got.text ? ` — ${got.text.slice(0, 200)}` : ''}`;
  }
  // Non-emptiness is the DEFAULT, opt-out rather than opt-in. As an opt-in it
  // was trivially evaded: omit the flag and `{}` or `[]` sails through with a
  // 200. An endpoint that answers with nothing has not returned real data, so
  // the burden belongs on whoever wants to say otherwise.
  if (want.nonEmpty !== false && isEmptyBody(got.body)) {
    return `status ${got.status} but the body carries nothing (${got.text.slice(0, 120) || 'empty'})`;
  }
  if (typeof want.minItems === 'number') {
    const collection = primaryCollection(got.body);
    if (collection === null) {
      return `minItems ${want.minItems} declared but the response has no collection to count`;
    }
    if (collection.length < want.minItems) {
      return (
        `returned ${collection.length} item(s), fewer than the declared minimum of ${want.minItems}. ` +
        'The endpoint answers correctly and delivers too little to be useful.'
      );
    }
  }
  if (PLACEHOLDER.test(got.text)) {
    const hit = PLACEHOLDER.exec(got.text);
    return `response contains placeholder content: "${hit?.[0]}"`;
  }
  return null;
}

/**
 * Call one example against the running app.
 *
 * @param {number} port - Local port.
 * @param {string} path - Concrete request path.
 * @param {object} example - The declared example.
 * @returns {Promise<{status: number|null, text: string, body: unknown, error: string|null}>} Captured response.
 */
async function callExample(port, path, example, origin = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_MS);
  try {
    const method = (example.method ?? 'GET').toUpperCase();
    // Declared headers are sent. Without them an auth-gated route could not be
    // exercised honestly at all: it would answer 401, fail the check, and the
    // cheapest way to go green would be to stop requiring auth. A gate that
    // rewards removing an access control is worse than no gate. Secrets belong
    // in the environment, so a header value here should reference a test
    // credential, never a production one.
    const init = { method, signal: controller.signal, headers: { ...(example.headers ?? {}) } };
    if (example.body !== undefined && method !== 'GET' && method !== 'HEAD') {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(example.body);
    }
    // `origin` lets one route be probed somewhere the local runtime cannot
    // reach. Everything else still runs against the locally booted Worker.
    const res = await fetch(`${origin ?? `http://127.0.0.1:${port}`}${path}`, init);
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, text, body, error: null };
  } catch (err) {
    return { status: null, text: '', body: null, error: String(err?.message ?? err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Decide u-api-real-output for one app.
 *
 * @param {string} appDir - App directory.
 * @param {{pass: Function, fail: Function, notApplicable: Function}} io - Outcome callbacks.
 * @param {{boot?: Function}} [deps] - Injected boot, for tests.
 * @returns {Promise<void>}
 */
export async function runApiRealOutput(appDir, io, deps = {}) {
  const { pass, fail, notApplicable } = io;

  const routes = discoverRoutes(appDir);
  if (routes.length === 0) return notApplicable('no functions/api routes to exercise');

  const declared = readJson(join(appDir, EXAMPLES_FILE));
  if (declared === null || !Array.isArray(declared.examples)) {
    return fail(
      `${routes.length} API route(s) exist and ${EXAMPLES_FILE} declares none.\n` +
        routes.map((r) => `  ${r}`).join('\n') +
        '\n\nAn endpoint with no example is an endpoint nobody has proven answers.'
    );
  }

  // A route may carry SEVERAL examples: the success path plus whatever error
  // behaviour is worth proving (404 for an absent record, 400 for a malformed
  // body). Keying one example per route silently dropped all but the last.
  const byRoute = new Map();
  for (const example of declared.examples) {
    if (typeof example?.route !== 'string' || EMPTY_CLAIM.test(example.route)) continue;
    const list = byRoute.get(example.route) ?? [];
    list.push(example);
    byRoute.set(example.route, list);
  }

  // Untested-by-default. Same rule as an unclaimed control.
  const unclaimed = routes.filter((r) => !byRoute.has(r));
  if (unclaimed.length > 0) {
    return fail(
      `${unclaimed.length} API route(s) no example claims:\n` +
        unclaimed.map((r) => `  ${r}`).join('\n') +
        `\n\nAdd each to ${EXAMPLES_FILE} with a realistic call and what its answer ` +
        'must satisfy. A route nobody calls is a route nobody has proven works.'
    );
  }

  // Every route needs at least one SUCCESS example. Error-path examples are
  // worth having, but a route whose only demonstration is a 404 has proven it
  // rejects things, not that it ever returns real data — which is the rule.
  const noSuccess = routes.filter((r) => !hasSuccessExample(byRoute.get(r) ?? []));
  if (noSuccess.length > 0) {
    return fail(
      `${noSuccess.length} route(s) have no successful (2xx) example:\n` +
        noSuccess.map((r) => `  ${r}`).join('\n') +
        '\n\nError-path examples are welcome, but one of them must show the route ' +
        'actually returning real data, or nothing here proves it ever does.'
    );
  }

  // A claim that cannot be made concrete is not a claim.
  const unfillable = [];
  const plan = [];
  for (const route of routes) {
    for (const example of byRoute.get(route)) {
      const { path, missing } = fillParams(route, example.params);
      if (missing.length > 0) unfillable.push(`${route} (no value for ${missing.join(', ')})`);
      else plan.push({ route, path: withQuery(path, example.query), example });
    }
  }
  if (unfillable.length > 0) {
    return fail(
      `${unfillable.length} route(s) have parameters no example fills:\n` +
        unfillable.map((r) => `  ${r}`).join('\n') +
        `\n\nAdd a "params" object to the example so the route can actually be called.`
    );
  }

  const build = ensureBuild(appDir);
  if (!build.ok) return fail(`the app does not build, so no route can be exercised:\n${build.output.slice(-800)}`);

  const boot = deps.boot ?? defaultBoot;
  const captured = await boot(appDir, plan);
  if (captured.error !== null) return fail(captured.error);

  const failures = [];
  for (const entry of captured.results) {
    const reason = evaluateResponse(entry.example, entry.got);
    if (reason !== null) failures.push(`  ${entry.example.method ?? 'GET'} ${entry.path} — ${reason}`);
  }

  // Written whether or not the det half passed: the judge needs the evidence
  // most when something looks fine and is not.
  writeEvidence(appDir, captured.results);

  if (failures.length > 0) {
    return fail(
      `${failures.length} route(s) did not return real data:\n` +
        failures.join('\n') +
        `\n\nCaptured traffic: ${join(EVIDENCE_DIR, evidenceName(appDir))}`
    );
  }
  return pass();
}

/**
 * Evidence filename for an app.
 *
 * @param {string} appDir - App directory.
 * @returns {string} File name.
 */
function evidenceName(appDir) {
  const conformance = readJson(join(appDir, 'conformance.json'));
  const slug = typeof conformance?.slug === 'string' ? conformance.slug : 'app';
  return `api-live-${slug}.json`;
}

/**
 * Write captured request/response pairs for the judge half.
 *
 * @param {string} appDir - App directory.
 * @param {object[]} results - Captured entries.
 * @returns {void}
 */
function writeEvidence(appDir, results) {
  const dir = join(appDir, EVIDENCE_DIR);
  mkdirSync(dir, { recursive: true });
  const payload = {
    _why:
      'Live request/response pairs captured by u-api-real-output against the real ' +
      'Workers runtime. The judge half of the rule reads THIS, not the source: the ' +
      'question it answers is whether these answers deliver what the product claims, ' +
      'which nothing static can decide.',
    routes: results.map((r) => ({
      route: r.route,
      path: r.path,
      method: r.example.method ?? 'GET',
      requestBody: r.example.body ?? null,
      expectation: r.example.expect ?? null,
      status: r.got.status,
      // Bounded: a judge needs the shape and the substance, not a megabyte.
      responseBody: r.got.text.slice(0, 4000),
      error: r.got.error
    }))
  };
  writeFileSync(join(dir, evidenceName(appDir)), JSON.stringify(payload, null, 2) + '\n');
}

/**
 * Boot the app on a free port, call every example, always kill the child.
 *
 * A leaked wrangler holds a port and wedges the machine, so the child is killed
 * in `finally` — including on readiness timeout and on throw.
 *
 * @param {string} appDir - App directory.
 * @param {object[]} plan - Routes and their examples.
 * @returns {Promise<{results: object[], error: string|null}>} Captured results.
 */
async function defaultBoot(appDir, plan) {
  const port = await pickFreePort();
  const { child, output } = spawnWranglerPagesDev(appDir, port);
  try {
    const ready = await waitForReady(port, READINESS_MS);
    if (!ready) {
      return {
        results: [],
        error: `the app never became ready on port ${port} within ${READINESS_MS}ms:\n${output.text.slice(-800)}`
      };
    }
    const results = [];
    for (const entry of plan) {
      // A route bound to a service the local runtime cannot authenticate to
      // (Workers AI answers "10000: Authentication error" under `wrangler pages
      // dev`) is not a route that returns bad data — it is a route this
      // environment cannot reach. Failing it would report a defect that does not
      // exist; passing it would credit a measurement that never happened. So it
      // is measured where the binding actually runs, and the example must name
      // that origin explicitly. There is no path here that skips a route.
      const origin = entry.example.remoteOrigin ?? null;
      const got = await callExample(port, entry.path, entry.example, origin);
      results.push({ ...entry, got, measuredAt: origin ?? 'local' });
    }
    return { results, error: null };
  } finally {
    if (child.pid !== undefined) killProcessTree(child.pid);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node u-api-real-output.mjs <appDir>');
    process.exit(2);
  }
  await runApiRealOutput(dir, {
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
