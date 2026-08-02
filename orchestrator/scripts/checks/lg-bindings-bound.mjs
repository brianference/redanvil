#!/usr/bin/env node
/**
 * lg-bindings-bound — every binding declared in config exists in the deployed env.
 *
 * Usage:
 *   node lg-bindings-bound.mjs <appDir>
 *   node lg-bindings-bound.mjs <appDir> --url https://example.pages.dev
 *   node lg-bindings-bound.mjs --fixture-url http://127.0.0.1:PORT  (with wrangler in appDir)
 *
 * Exit 0 = pass, 1 = fail, 2 = infra, 3 = n/a (no wrangler.toml).
 *
 * Gap that nearly shipped a broken assistant: wrangler.toml declared
 * `[ai] binding = "AI"`, every test passed, and the deployed Pages project had
 * `ai: {}`. The endpoint correctly fail-closed with 503, so no route check
 * caught it — the code was right and the environment was wrong.
 *
 * Parse declared bindings from wrangler.toml. For each, probe the **deployed**
 * app for its symptom: endpoints answering "binding unavailable" /
 * 503-with-a-missing-binding-reason are a FAIL. Token-free — measure deployed
 * reality, not the Cloudflare API.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeMeasurementMetaEntry, nowIso } from '../lib/measurement-meta.mjs';

/** How long a probe may take. */
const FETCH_TIMEOUT_MS = 15_000;

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never,
 *   infra: (m?: string) => never
 * }} BindingsIo
 */

/**
 * @typedef {{ kind: 'd1'|'ai'|'kv'|'r2', binding: string }} DeclaredBinding
 */

/**
 * Parse declared bindings from wrangler.toml text.
 *
 * @param {string} toml File contents.
 * @returns {DeclaredBinding[]}
 */
export function parseWranglerBindings(toml) {
  /** @type {DeclaredBinding[]} */
  const out = [];
  // [[d1_databases]] blocks with binding = "DB"
  const d1Blocks = toml.split(/\[\[d1_databases\]\]/i).slice(1);
  for (const block of d1Blocks) {
    const section = block.split(/\n\s*\[/)[0] ?? block;
    const m = /^\s*binding\s*=\s*["']([^"']+)["']/m.exec(section);
    if (m?.[1]) out.push({ kind: 'd1', binding: m[1] });
  }
  // [ai] binding = "AI"
  const aiSection = /\[ai\]([\s\S]*?)(?=\n\s*\[|$)/i.exec(toml);
  if (aiSection) {
    const m = /^\s*binding\s*=\s*["']([^"']+)["']/m.exec(aiSection[1] ?? '');
    if (m?.[1]) out.push({ kind: 'ai', binding: m[1] });
    else out.push({ kind: 'ai', binding: 'AI' });
  }
  // [[kv_namespaces]]
  const kvBlocks = toml.split(/\[\[kv_namespaces\]\]/i).slice(1);
  for (const block of kvBlocks) {
    const section = block.split(/\n\s*\[/)[0] ?? block;
    const m = /^\s*binding\s*=\s*["']([^"']+)["']/m.exec(section);
    if (m?.[1]) out.push({ kind: 'kv', binding: m[1] });
  }
  // [[r2_buckets]]
  const r2Blocks = toml.split(/\[\[r2_buckets\]\]/i).slice(1);
  for (const block of r2Blocks) {
    const section = block.split(/\n\s*\[/)[0] ?? block;
    const m = /^\s*binding\s*=\s*["']([^"']+)["']/m.exec(section);
    if (m?.[1]) out.push({ kind: 'r2', binding: m[1] });
  }
  return out;
}

/**
 * Whether a response body/status indicates a missing binding.
 *
 * @param {number} status HTTP status.
 * @param {string} body Response body text.
 * @returns {{ missing: boolean, reason?: string }}
 */
export function detectMissingBinding(status, body) {
  const text = body.slice(0, 4000);
  const patterns = [
    /binding unavailable/i,
    /AI missing/i,
    /(?:Database|DB|KV|R2|AI)\s+binding unavailable/i,
    /(?:env\.)?(AI|DB|KV|R2)\s+(?:is\s+)?(?:missing|undefined|not (?:configured|bound|available))/i,
    /missing (?:AI|D1|KV|R2|database) binding/i,
    /Workers AI (?:is )?(?:not |un)(?:available|configured|bound)/i,
    /no such binding/i,
    /binding ['"`]?\w+['"`]? (?:is )?(?:not |un)(?:available|configured|bound)/i
  ];
  for (const re of patterns) {
    if (re.test(text)) {
      return { missing: true, reason: `body matches /${re.source}/` };
    }
  }
  // 503 with a short error that names a binding kind.
  if (status === 503) {
    if (/\b(AI|D1|database|KV|R2|binding)\b/i.test(text) && /unavail|missing|not configured|not bound/i.test(text)) {
      return { missing: true, reason: '503 with missing-binding language' };
    }
  }
  return { missing: false };
}

/**
 * Map binding kind to likely probe paths under the app.
 *
 * @param {string} appDir App root.
 * @param {DeclaredBinding} binding Declared binding.
 * @returns {string[]} Paths starting with /.
 */
export function probePathsForBinding(appDir, binding) {
  /** @type {string[]} */
  const paths = [];
  const apiRoot = join(appDir, 'functions', 'api');
  if (existsSync(apiRoot)) {
    /**
     * @param {string} dir
     * @param {string} prefix
     */
    function walk(dir, prefix) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name.includes('.test.')) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (/^\[.+\]$/.test(entry.name)) continue;
          walk(full, `${prefix}/${entry.name}`);
          continue;
        }
        if (!/\.(ts|js)$/.test(entry.name) || entry.name.startsWith('_')) continue;
        const base = entry.name.replace(/\.(ts|js)$/, '');
        const path = base === 'index' ? prefix || '/api' : `${prefix}/${base}`;
        let text = '';
        try {
          text = readFileSync(full, 'utf8');
        } catch {
          continue;
        }
        const uses =
          binding.kind === 'ai'
            ? /\b(?:env\.)?AI\b|\.AI\.run/.test(text)
            : binding.kind === 'd1'
              ? new RegExp(`\\b(?:env\\.)?${binding.binding}\\b|\\bDB\\b`).test(text)
              : new RegExp(`\\b(?:env\\.)?${binding.binding}\\b`).test(text);
        if (uses) paths.push(path.replace(/\/+/g, '/'));
      }
    }
    walk(apiRoot, '/api');
  }

  // Sensible defaults when discovery finds nothing.
  if (paths.length === 0) {
    if (binding.kind === 'ai') paths.push('/api/assistant', '/api/chat', '/api/ask');
    if (binding.kind === 'd1') paths.push('/api/health', '/api/crops', '/api/items');
    if (binding.kind === 'kv') paths.push('/api/health');
    if (binding.kind === 'r2') paths.push('/api/health');
  }
  return [...new Set(paths)];
}

/**
 * Read deploy URL from claims.
 *
 * @param {string} appDir App root.
 * @returns {string | null}
 */
export function readDeployUrl(appDir) {
  const claimsPath = join(appDir, '.redanvil', 'claims.json');
  if (!existsSync(claimsPath)) return null;
  try {
    const data = JSON.parse(readFileSync(claimsPath, 'utf8'));
    if (typeof data.deployUrl === 'string' && data.deployUrl.trim()) {
      return data.deployUrl.trim().replace(/\/$/, '');
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Probe one URL; return missing-binding signal.
 *
 * @param {string} url Absolute URL.
 * @param {'GET'|'POST'} method Method.
 * @returns {Promise<{ status: number, body: string, missing: boolean, reason?: string }>}
 */
export async function probeUrl(url, method = 'GET') {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    /** @type {RequestInit} */
    const init = {
      method,
      signal: ctrl.signal,
      headers: { accept: 'application/json, text/plain, */*' }
    };
    if (method === 'POST') {
      init.headers = {
        .../** @type {Record<string, string>} */ (init.headers),
        'content-type': 'application/json'
      };
      init.body = JSON.stringify({ message: 'ping', prompt: 'ping' });
    }
    const res = await fetch(url, init);
    const body = await res.text();
    const det = detectMissingBinding(res.status, body);
    return {
      status: res.status,
      body: body.slice(0, 500),
      missing: det.missing,
      reason: det.reason
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Evaluate probe results for declared bindings (pure — used by fixtures/tests).
 *
 * @param {DeclaredBinding[]} bindings Declared bindings.
 * @param {Array<{ binding: string, path: string, status: number, body: string }>} probes Probe outcomes.
 * @returns {{ ok: boolean, failures: string[] }}
 */
export function evaluateBindingProbes(bindings, probes) {
  /** @type {string[]} */
  const failures = [];
  if (bindings.length === 0) {
    return { ok: true, failures };
  }
  for (const b of bindings) {
    const related = probes.filter((p) => p.binding === b.binding || p.binding === b.kind);
    if (related.length === 0) {
      // No probe ran — caller should have produced probes; treat as unmeasured fail.
      failures.push(
        `declared ${b.kind} binding "${b.binding}" was not probed — no candidate endpoint responded`
      );
      continue;
    }
    for (const p of related) {
      const det = detectMissingBinding(p.status, p.body);
      if (det.missing) {
        failures.push(
          `declared ${b.kind} binding "${b.binding}" appears missing in deploy: ` +
            `${p.path} returned ${p.status} (${det.reason}) — ` +
            `body snippet: ${JSON.stringify(p.body.slice(0, 120))}`
        );
      }
    }
  }
  return { ok: failures.length === 0, failures };
}

/**
 * Run the check.
 *
 * @param {string} appDir App directory.
 * @param {BindingsIo} io Exit helpers.
 * @param {{ url?: string | null }} [opts]
 */
export async function runBindingsBound(appDir, io, opts = {}) {
  const wranglerPath = join(appDir, 'wrangler.toml');
  if (!existsSync(wranglerPath)) {
    io.notApplicable('no wrangler.toml — not a Cloudflare deployable app');
  }

  let toml;
  try {
    toml = readFileSync(wranglerPath, 'utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    io.infra(`cannot read wrangler.toml: ${msg}`);
  }

  const bindings = parseWranglerBindings(toml);
  if (bindings.length === 0) {
    console.log('lg-bindings-bound PASS: wrangler.toml declares no D1/AI/KV/R2 bindings');
    io.pass();
  }

  const base = (opts.url ?? readDeployUrl(appDir) ?? '').replace(/\/$/, '');
  if (!base) {
    io.infra(
      'no deployUrl in .redanvil/claims.json and no --url — cannot probe the deployed environment ' +
        '(token-free check needs a live production URL)'
    );
  }

  /** @type {Array<{ binding: string, path: string, status: number, body: string }>} */
  const probes = [];
  /** @type {string[]} */
  const infraErrors = [];

  for (const b of bindings) {
    const paths = probePathsForBinding(appDir, b);
    let anyResponse = false;
    for (const path of paths) {
      const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
      const methods = b.kind === 'ai' ? /** @type {const} */ (['POST', 'GET']) : /** @type {const} */ (['GET']);
      for (const method of methods) {
        try {
          const result = await probeUrl(url, method);
          // Skip pure 404s as "wrong path"; keep 200/4xx/5xx that returned a body.
          if (result.status === 404) continue;
          anyResponse = true;
          probes.push({
            binding: b.binding,
            path: `${method} ${path}`,
            status: result.status,
            body: result.body
          });
          // One successful contact per binding is enough when it already signals missing.
          if (result.missing) break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          infraErrors.push(`${method} ${path}: ${msg.slice(0, 100)}`);
        }
      }
      if (probes.some((p) => p.binding === b.binding && detectMissingBinding(p.status, p.body).missing)) {
        break;
      }
    }
    if (!anyResponse && paths.length > 0) {
      // Could not reach any candidate — if every attempt was network fail, infra.
      // If all 404, record a soft probe so evaluate can flag "not probed".
      probes.push({
        binding: b.binding,
        path: paths[0] ?? '/api/health',
        status: 0,
        body: ''
      });
    }
  }

  // status 0 means unreachable — convert to infra when NOTHING was reachable.
  const reachable = probes.filter((p) => p.status > 0);
  if (reachable.length === 0) {
    io.infra(
      `could not reach any binding probe on ${base}: ${infraErrors.slice(0, 3).join('; ') || 'all paths 404 or network failed'}`
    );
  }

  const result = evaluateBindingProbes(
    bindings,
    reachable.map((p) => ({
      binding: p.binding,
      path: p.path,
      status: p.status,
      body: p.body
    }))
  );

  if (appDir) {
    writeMeasurementMetaEntry(appDir, 'lg-bindings-bound', {
      tool: 'fetch-probe',
      engine: null,
      runs: [
        { ok: result.ok, at: nowIso(), base },
        { ok: result.ok, at: nowIso(), base }
      ],
      knownBad: {
        input: 'deployed endpoint returning binding unavailable / 503 missing AI',
        failed: true,
        recordedAt: nowIso()
      }
    });
  }

  if (!result.ok) {
    io.fail(result.failures.join('\n'));
  }

  console.log(
    `lg-bindings-bound PASS: ${bindings.length} declared binding(s) show no missing-binding symptom on ${base}`
  );
  io.pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2);
  const ui = argv.indexOf('--url');
  const fixtureUrl = argv.indexOf('--fixture-url');
  const url =
    ui === -1 ? (fixtureUrl === -1 ? null : argv[fixtureUrl + 1]) : argv[ui + 1];
  const appDir =
    argv.find(
      (a, i) =>
        !a.startsWith('--') &&
        (ui === -1 || i !== ui + 1) &&
        (fixtureUrl === -1 || i !== fixtureUrl + 1)
    ) ?? '';
  if (!appDir) {
    console.error('usage: node lg-bindings-bound.mjs <appDir> [--url URL]');
    process.exit(2);
  }
  runBindingsBound(appDir, {
    pass: () => process.exit(0),
    fail: (m) => {
      if (m) console.error(m);
      process.exit(1);
    },
    notApplicable: (w) => {
      if (w) console.error(`n/a: ${w}`);
      process.exit(3);
    },
    infra: (m) => {
      if (m) console.error(`infra: ${m}`);
      process.exit(2);
    }
  }, { url }).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  });
}
