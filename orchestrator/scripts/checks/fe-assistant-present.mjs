#!/usr/bin/env node
/**
 * fe-assistant-present — every app with queryable domain data ships an AI
 * assistant that answers about ITS OWN data.
 *
 * Usage: node fe-assistant-present.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = not applicable (no queryable domain data).
 *
 * Why: an app that cannot answer a question about its own data makes the user
 * do the reading. A stubbed or canned-response "assistant" is a fail — it must
 * call a model from the Worker (Cloudflare Workers AI by default) and ground
 * the answer in the app's database or structured domain query.
 *
 * Reference: QuickFlight's functions/api/assistant.ts (Workers AI + domain
 * filters; model id from a live binding, never a deprecated default).
 *
 * n/a ONLY when the app genuinely has no queryable domain data.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Endpoint file names that count as the assistant API. */
const ASSISTANT_FILE = /assistant|chat|ask/i;

/** UI / client signals that the assistant is reachable from the shell. */
const UI_AFFORDANCE = [
  /\/api\/assistant\b/,
  /\/api\/chat\b/,
  /\/api\/ask\b/,
  /\bAssistantSheet\b|\bAssistantPanel\b|\bChatAssistant\b|\bAskAssistant\b/,
  /aria-label\s*=\s*\{?['"`][^'"`]*(assistant|ask (the )?(ai|app)|chat)[^'"`]*['"`]/i,
  /placeholder\s*=\s*\{?['"`][^'"`]*(ask|assistant)[^'"`]*['"`]/i,
  /\b(assistantTitle|assistantPlaceholder|openAssistant|askAssistant)\b/
];

/** Model invocation shapes (Workers AI and common aliases). */
const MODEL_CALL =
  /\b(?:env\.)?AI\.run\s*\(|\bai\.run\s*\(|Workers\s*AI|@cf\/[\w./-]+/i;

/**
 * Grounding in app data: a REAL D1/database touch in the endpoint file.
 *
 * An independent review (evidence/independent-review-az-planting-calendar.json,
 * finding "fe-assistant-present's grounding proof is a weak regex") showed the
 * previous set was satisfiable without ever reading data: a bare word boundary
 * match on "filters" matched a variable literally named filters, and a match
 * on "SYSTEM_PROMPT" or "systemPrompt" matched any LLM system-prompt constant
 * regardless of what it did. The codebase's own PASS fixture
 * (feAssistantPresent.test.ts) proved the gap — its "grounded" endpoint
 * returned only `{ query: {}, summary: '...' }` and never touched `env.DB` at
 * all, yet passed on the bare words "query:" and "summary:" alone. Every
 * pattern here now requires an actual D1 binding reference or a prepared SQL
 * statement — nothing a stub can spell its way past without a real database
 * call.
 */
const GROUNDS_DATA = [
  /\benv\.DB\b/,
  /\bDB\.prepare\s*\(/,
  /\.prepare\s*\(\s*['"`](?:SELECT|WITH)/i,
  /\bD1Database\b/
];

/** Explicit stub / canned shapes that must fail even if a file exists. */
const STUB_SHAPES = [
  /return\s+(?:json|errorJson|Response\.json)\s*\(\s*[^,]+,\s*\{\s*(?:reply|answer|message)\s*:\s*['"`][^'"`]{0,80}['"`]/,
  /const\s+(?:CANNED|STUB|FAKE|MOCK)_?(?:REPLIES|RESPONSES|ANSWERS)\s*=/,
  /\/\/\s*(?:TODO|stub|fake)\s*(?:assistant|AI|model)/i,
  /assistant\s+not\s+implemented/i
];

/**
 * Collect source files under dir.
 *
 * @param {string} dir Root.
 * @param {string[]} [out] Accumulator.
 * @returns {string[]} Paths.
 */
function sourceFiles(dir, out = []) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Whether the app has queryable domain data (D1 + domain DDL, or domain queries).
 *
 * @param {string} appDir App root.
 * @returns {boolean}
 */
export function hasQueryableDomainData(appDir) {
  const wrangler = join(appDir, 'wrangler.toml');
  const migrations = join(appDir, 'migrations');
  const hasD1 =
    existsSync(wrangler) && /\[\[d1_databases\]\]/.test(readFileSync(wrangler, 'utf8'));

  if (hasD1 && existsSync(migrations) && statSync(migrations).isDirectory()) {
    const sqlPaths = readdirSync(migrations)
      .filter((n) => n.endsWith('.sql'))
      .map((n) => join(migrations, n));
    for (const f of sqlPaths) {
      // Any CREATE TABLE under a D1 binding is queryable domain or supporting data.
      if (/CREATE\s+TABLE/i.test(readFileSync(f, 'utf8'))) return true;
    }
  }

  // Domain queries without migrations still count.
  const functions = sourceFiles(join(appDir, 'functions'));
  for (const f of functions) {
    const c = readFileSync(f, 'utf8');
    if (/\b(?:env\.)?DB\.prepare\s*\(/.test(c) && /SELECT/i.test(c)) return true;
  }
  return false;
}

/**
 * Find assistant API endpoint files under functions/api.
 *
 * @param {string} appDir App root.
 * @returns {string[]} Absolute paths.
 */
export function findAssistantEndpoints(appDir) {
  const apiDir = join(appDir, 'functions', 'api');
  if (!existsSync(apiDir)) return [];
  return sourceFiles(apiDir).filter((f) => ASSISTANT_FILE.test(relative(apiDir, f)));
}

/**
 * Whether the UI exposes a chat/assistant affordance that hits the API.
 *
 * @param {string} joined Client + function source.
 * @returns {boolean}
 */
export function hasAssistantUi(joined) {
  return UI_AFFORDANCE.some((re) => re.test(joined));
}

/**
 * Whether the endpoint is a real model-backed, grounded assistant (not a stub).
 *
 * @param {string} endpointText File contents of the assistant handler.
 * @returns {{ ok: boolean, why?: string }}
 */
export function assessAssistantEndpoint(endpointText) {
  for (const re of STUB_SHAPES) {
    if (re.test(endpointText)) {
      return { ok: false, why: 'assistant endpoint looks stubbed or canned (fixed reply / STUB_RESPONSES)' };
    }
  }
  if (!MODEL_CALL.test(endpointText)) {
    return {
      ok: false,
      why: 'assistant endpoint never calls a model (expected env.AI.run / Workers AI in the Worker, not the browser)'
    };
  }
  if (!GROUNDS_DATA.some((re) => re.test(endpointText))) {
    return {
      ok: false,
      why: 'assistant does not ground answers in app data (no DB query, domain filter object, or data-bound system prompt)'
    };
  }
  // Binding must come from env, not a hardcoded secret/key.
  if (/api[_-]?key\s*[:=]\s*['"`][^'"`]+['"`]/i.test(endpointText) && !/process\.env|env\./.test(endpointText)) {
    return { ok: false, why: 'assistant hardcodes a secret; read the AI binding from env' };
  }
  return { ok: true };
}

/** How long a live grounding probe may take. */
const LIVE_FETCH_TIMEOUT_MS = 20_000;

/**
 * Read the deployed production URL from claims, if recorded.
 *
 * A local copy rather than a cross-file import (same choice lg-bindings-bound.mjs
 * made) so this check has no dependency on another check's internals.
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
 * Optional per-app live-grounding fixture: `tests/assistant-grounding.json`.
 *
 * This check runs across apps with unrelated domain models (flights, crops,
 * scholarships), so it cannot hardcode any one app's query schema. A fixture
 * declares a real NL message plus an independent, already-shipped API route
 * that must agree with the assistant's answer for the SAME query — the proof
 * the independent review asked for: "cross-check response against a live
 * /api/plantable or /api/crops call rather than against a hardcoded
 * expectation." Missing fixture or missing deploy URL means the live half is
 * not run (nothing to check against), never that it is faked as passing.
 *
 * @param {string} appDir App root.
 * @returns {{message:string, crossCheckPath:string, assistantField:string, crossCheckField:string} | null}
 */
export function readGroundingFixture(appDir) {
  const p = join(appDir, 'tests', 'assistant-grounding.json');
  if (!existsSync(p)) return null;
  try {
    const data = JSON.parse(readFileSync(p, 'utf8'));
    if (
      typeof data.message === 'string' &&
      typeof data.crossCheckPath === 'string' &&
      typeof data.assistantField === 'string' &&
      typeof data.crossCheckField === 'string'
    ) {
      return data;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Pull a list of string values out of JSON using one array hop plus a dotted
 * field path, e.g. "items[].crop.name" or "crops[].name". Not a general
 * JSONPath implementation — just enough for the shapes these fixtures need.
 *
 * @param {unknown} value Parsed JSON.
 * @param {string} path e.g. "items[].crop.name".
 * @returns {string[]} Extracted string values (non-string entries dropped).
 */
export function extractFieldList(value, path) {
  const arrowIdx = path.indexOf('[]');
  if (arrowIdx === -1) return [];
  const arrayPath = path
    .slice(0, arrowIdx)
    .split('.')
    .filter(Boolean);
  const fieldPath = path
    .slice(arrowIdx + 2)
    .replace(/^\./, '')
    .split('.')
    .filter(Boolean);

  /** @type {unknown} */
  let arr = value;
  for (const key of arrayPath) {
    if (arr === null || typeof arr !== 'object') return [];
    arr = /** @type {Record<string, unknown>} */ (arr)[key];
  }
  if (!Array.isArray(arr)) return [];

  const out = [];
  for (const item of arr) {
    /** @type {unknown} */
    let cur = item;
    for (const key of fieldPath) {
      if (cur === null || typeof cur !== 'object') {
        cur = undefined;
        break;
      }
      cur = /** @type {Record<string, unknown>} */ (cur)[key];
    }
    if (typeof cur === 'string') out.push(cur);
  }
  return out;
}

/**
 * Run the live grounding proof against a deployed assistant.
 *
 * FAILS — never silently skips — on a non-2xx assistant response, an
 * unparsable body, an empty extracted answer, or an answer whose data does
 * not exactly match what the app's own API independently returns for the
 * same query. This is deliberate: a missing Workers AI binding once made
 * every assistant call answer 503 in production for two months while every
 * other check passed (see lg-bindings-bound.mjs's own docstring for the same
 * incident class). A network-level failure to reach the deploy at all is
 * reported as infra, distinct from the app answering something wrong.
 *
 * @param {string} base Deployed origin, no trailing slash.
 * @param {{message:string, crossCheckPath:string, assistantField:string, crossCheckField:string}} fixture
 * @param {typeof fetch} [fetchImpl] Injectable for tests.
 * @returns {Promise<{ok:boolean, infra?:boolean, why?:string}>}
 */
export async function verifyLiveGrounding(base, fixture, fetchImpl = fetch) {
  const assistantController = new AbortController();
  const assistantTimer = setTimeout(() => assistantController.abort(), LIVE_FETCH_TIMEOUT_MS);
  let assistantRes;
  let assistantText;
  try {
    assistantRes = await fetchImpl(`${base}/api/assistant`, {
      method: 'POST',
      signal: assistantController.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: fixture.message })
    });
    assistantText = await assistantRes.text();
  } catch (err) {
    return {
      ok: false,
      infra: true,
      why: `could not reach ${base}/api/assistant: ${err instanceof Error ? err.message : String(err)}`
    };
  } finally {
    clearTimeout(assistantTimer);
  }

  if (!assistantRes.ok) {
    return {
      ok: false,
      why:
        `assistant endpoint answered HTTP ${assistantRes.status} for "${fixture.message}" ` +
        `instead of grounded data: ${assistantText.slice(0, 300)}`
    };
  }

  let assistantBody;
  try {
    assistantBody = JSON.parse(assistantText);
  } catch {
    return { ok: false, why: `assistant response is not JSON: ${assistantText.slice(0, 200)}` };
  }

  const assistantValues = extractFieldList(assistantBody, fixture.assistantField)
    .map((s) => s.trim().toLowerCase())
    .sort();
  if (assistantValues.length === 0) {
    return {
      ok: false,
      why:
        `assistant response has no values at "${fixture.assistantField}" — nothing to ` +
        `cross-check: ${assistantText.slice(0, 300)}`
    };
  }

  const crossController = new AbortController();
  const crossTimer = setTimeout(() => crossController.abort(), LIVE_FETCH_TIMEOUT_MS);
  let crossRes;
  let crossText;
  try {
    crossRes = await fetchImpl(`${base}${fixture.crossCheckPath}`, {
      signal: crossController.signal
    });
    crossText = await crossRes.text();
  } catch (err) {
    return {
      ok: false,
      infra: true,
      why: `could not reach ${base}${fixture.crossCheckPath}: ${err instanceof Error ? err.message : String(err)}`
    };
  } finally {
    clearTimeout(crossTimer);
  }

  if (!crossRes.ok) {
    return {
      ok: false,
      why:
        `cross-check route ${fixture.crossCheckPath} answered HTTP ${crossRes.status} — ` +
        `cannot verify grounding: ${crossText.slice(0, 300)}`
    };
  }

  let crossBody;
  try {
    crossBody = JSON.parse(crossText);
  } catch {
    return { ok: false, why: `cross-check response is not JSON: ${crossText.slice(0, 200)}` };
  }

  const crossValues = extractFieldList(crossBody, fixture.crossCheckField).map((s) =>
    s.trim().toLowerCase()
  );
  if (crossValues.length === 0) {
    return {
      ok: false,
      why: `cross-check route returned no values at "${fixture.crossCheckField}" — cannot verify grounding`
    };
  }
  const crossSet = new Set(crossValues);

  // Exact set match, both directions. A generic model (or a stub returning a
  // plausible fixed list) cannot reproduce this app's real row set on demand;
  // a real grounded answer can neither invent an extra row nor drop a real one.
  const invented = assistantValues.filter((v) => !crossSet.has(v));
  if (invented.length > 0) {
    return {
      ok: false,
      why:
        `assistant returned ${invented.length} value(s) absent from the app's own ` +
        `${fixture.crossCheckPath} data for the same query — not grounded in real data: ` +
        `${JSON.stringify(invented.slice(0, 10))}`
    };
  }
  const assistantSet = new Set(assistantValues);
  const omitted = [...crossSet].filter((v) => !assistantSet.has(v));
  if (omitted.length > 0) {
    return {
      ok: false,
      why:
        `assistant omitted ${omitted.length} value(s) the app's own ${fixture.crossCheckPath} ` +
        `data says belong in the same result: ${JSON.stringify(omitted.slice(0, 10))}`
    };
  }

  return { ok: true };
}

/**
 * Run the check.
 *
 * @param {string} appDir App directory.
 * @param {{pass:()=>never, fail:(m?:string)=>never, notApplicable:(w?:string)=>never, infra?:(m?:string)=>never}} io
 */
export async function runAssistantPresent(appDir, io) {
  if (!hasQueryableDomainData(appDir)) {
    io.notApplicable('no queryable domain data (no D1 domain schema / domain SELECT)');
  }

  const endpoints = findAssistantEndpoints(appDir);
  if (endpoints.length === 0) {
    io.fail(
      'app has queryable domain data but no assistant endpoint ' +
        '(expected functions/api/assistant.ts or similar under functions/api/)'
    );
  }

  const failures = [];
  let anyOk = false;
  for (const ep of endpoints) {
    const text = readFileSync(ep, 'utf8');
    const assessed = assessAssistantEndpoint(text);
    if (assessed.ok) {
      anyOk = true;
    } else {
      failures.push(`${relative(appDir, ep)}: ${assessed.why}`);
    }
  }
  if (!anyOk) {
    io.fail(
      `assistant endpoint present but not a real grounded model call:\n  ${failures.join('\n  ')}`
    );
  }

  const sources = [
    ...sourceFiles(join(appDir, 'src')),
    ...sourceFiles(join(appDir, 'functions'))
  ];
  const joined = sources.map((f) => readFileSync(f, 'utf8')).join('\n');
  if (!hasAssistantUi(joined)) {
    io.fail(
      'assistant API exists but no chat affordance is reachable from the shell ' +
        '(no /api/assistant client call, AssistantSheet, or accessible "ask/assistant" control)'
    );
  }

  // Static analysis proves the SOURCE calls a model and touches the database.
  // It cannot prove the DEPLOYED answer is actually derived from real rows —
  // that needs a live round trip. Run it whenever both a deploy URL and a
  // fixture exist; when either is absent the live half is unmeasured, not
  // faked as passing (mirrors lg-shipped/lg-bindings-bound's own infra rule).
  const deployUrl = readDeployUrl(appDir);
  const fixture = readGroundingFixture(appDir);
  if (deployUrl && fixture) {
    const live = await verifyLiveGrounding(deployUrl, fixture);
    if (!live.ok) {
      if (live.infra && io.infra) {
        io.infra(live.why);
      }
      io.fail(`live grounding proof failed against ${deployUrl}: ${live.why}`);
    }
    console.log(
      `assistant present (${relative(appDir, endpoints[0] ?? '')}); model-backed, statically ` +
        `grounded, and LIVE-verified against ${deployUrl}/api/assistant`
    );
    io.pass();
  }

  console.log(
    `assistant present (${relative(appDir, endpoints[0] ?? '')}); model-backed and grounded ` +
      '(static only — no deploy URL and/or tests/assistant-grounding.json fixture yet)'
  );
  io.pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node fe-assistant-present.mjs <appDir>');
    process.exit(2);
  }
  runAssistantPresent(dir, {
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
  }).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  });
}
