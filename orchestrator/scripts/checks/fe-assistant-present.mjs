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

/** Grounding in app data: DB access, domain filter object, or loaded context. */
const GROUNDS_DATA = [
  /\benv\.DB\b/,
  /\bDB\.prepare\s*\(/,
  /\.prepare\s*\(\s*['"`](?:SELECT|WITH)/i,
  /\bquery\s*:\s*/,
  /\bsummary\s*:\s*/,
  /\bfilters?\b/,
  /ground(?:ed|ing)|from (?:the )?(?:database|catalog|stored|app data)/i,
  /SYSTEM_PROMPT|systemPrompt|system:\s*['"`]/
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

/**
 * Run the check.
 *
 * @param {string} appDir App directory.
 * @param {{pass:()=>never, fail:(m?:string)=>never, notApplicable:(w?:string)=>never}} io
 */
export function runAssistantPresent(appDir, io) {
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

  console.log(
    `assistant present (${relative(appDir, endpoints[0] ?? '')}); model-backed and grounded`
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
    }
  });
}
