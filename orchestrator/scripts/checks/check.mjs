#!/usr/bin/env node
/**
 * Deterministic rule checker. Usage: node check.mjs <ruleId> <appDir>
 * Exit 0 = rule passes, 1 = rule fails, 2 = unknown rule.
 *
 * Each case is a real, conservative static check against the app source. The goal
 * is genuine measurement of as many rubric rules as can be decided deterministically;
 * judge-method and visual-method rules are scored elsewhere (judge pass / visual review).
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const [, , ruleId, appDir] = process.argv;
if (!ruleId || !appDir) {
  console.error('usage: node check.mjs <ruleId> <appDir>');
  process.exit(2);
}

/** Recursively collect files under dir matching one of exts, skipping node_modules/dist. */
function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, exts, out);
    else if (exts.includes(extname(name))) out.push(p);
  }
  return out;
}

const src = join(appDir, 'src');
const functionsDir = join(appDir, 'functions');
const tsx = () => walk(src, ['.ts', '.tsx']);
const read = (f) => {
  try {
    return readFileSync(f, 'utf8');
  } catch {
    return '';
  }
};
/** Files whose raw literals are legitimately allowed (token/theme definitions). */
const isThemeFile = (f) => /theme\.(ts|css)$|tokens?\.(ts|json)$/.test(f);
const pass = () => process.exit(0);
const fail = (msg) => {
  if (msg) console.error(msg);
  process.exit(1);
};

/** Any file matching pred → returns the first offending "file: line" or null. */
function firstMatch(files, re, skip = () => false) {
  for (const f of files) {
    if (skip(f)) continue;
    const lines = read(f).split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) return `${f}:${i + 1}: ${lines[i].trim().slice(0, 100)}`;
    }
  }
  return null;
}

switch (ruleId) {
  case 'u-typing-scoped-ignores': {
    // A bare @ts-ignore / @ts-nocheck with no trailing justification fails.
    const hit = firstMatch(tsx(), /@ts-(ignore|nocheck)\s*$/);
    hit ? fail(`unscoped ts-ignore: ${hit}`) : pass();
    break;
  }
  case 'u-sec-param-sql': {
    // SQL built by string interpolation. Require real SQL syntax (SELECT..FROM,
    // INSERT INTO, UPDATE..SET, DELETE FROM) with a ${...} in the same literal, so
    // prose like "create, edit, and delete ${x}" is not flagged.
    const files = [...tsx(), ...walk(functionsDir, ['.ts', '.js'])];
    const hit = firstMatch(
      files,
      /`[^`]*(\bSELECT\b[^`]*\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\b[^`]*\bSET\b|\bDELETE\s+FROM\b)[^`]*\$\{/i
    );
    hit ? fail(`interpolated SQL: ${hit}`) : pass();
    break;
  }
  case 'u-sec-no-stub-paths': {
    // Stubbed auth / always-true guards.
    const files = [...tsx(), ...walk(functionsDir, ['.ts', '.js'])];
    const hit = firstMatch(files, /(return\s+true;?\s*\/\/\s*(auth|stub))|(\/\/\s*TODO:?\s*(auth|secure|validate))|stubbedAuth/i);
    hit ? fail(`stubbed auth path: ${hit}`) : pass();
    break;
  }
  case 'u-sec-timeouts': {
    // Outbound fetch in functions must carry an AbortSignal/timeout.
    const files = walk(functionsDir, ['.ts', '.js']);
    const usesFetch = files.some((f) => /\bfetch\s*\(/.test(read(f)));
    if (!usesFetch) pass(); // no outbound calls → N/A, passes
    const hasSignal = files.some((f) => /AbortController|signal:|AbortSignal\.timeout/.test(read(f)));
    hasSignal ? pass() : fail('fetch without AbortSignal/timeout in functions');
    break;
  }
  case 'u-sec-headers-cors': {
    // If there are functions, responses should set security headers somewhere.
    const files = walk(functionsDir, ['.ts', '.js']);
    if (files.length === 0) pass();
    const hasHeaders = files.some((f) =>
      /X-Content-Type-Options|Content-Security-Policy|Access-Control-Allow-Origin|Referrer-Policy/i.test(read(f))
    );
    hasHeaders ? pass() : fail('no security/CORS headers set in functions');
    break;
  }
  case 'u-val-input-validation': {
    // Function handlers that read a request body should validate with zod.
    const files = walk(functionsDir, ['.ts', '.js']);
    const readsBody = files.filter((f) => /await\s+\w+\.json\(\)|request\.json\(\)/.test(read(f)));
    if (readsBody.length === 0) pass();
    const allValidate = readsBody.every((f) => /zod|\.parse\(|\.safeParse\(/.test(read(f)));
    allValidate ? pass() : fail('request body parsed without zod validation');
    break;
  }
  case 'fe-theme-tokens-only': {
    // No raw hex colors in components/pages (theme/token files exempt).
    const files = tsx().filter((f) => /[\\/](components|pages)[\\/]/.test(f));
    const hit = firstMatch(files, /#[0-9a-fA-F]{3,8}\b/, isThemeFile);
    hit ? fail(`raw hex in component: ${hit}`) : pass();
    break;
  }
  case 'fe-no-unsanitized-html': {
    const hit = firstMatch(tsx(), /dangerouslySetInnerHTML/);
    if (!hit) pass();
    // Allowed only if a sanitizer is imported in the same file.
    const f = hit.split(':')[0];
    /DOMPurify|sanitize/i.test(read(f)) ? pass() : fail(`unsanitized HTML: ${hit}`);
    break;
  }
  case 'hyg-no-binaries': {
    // No committed binaries under src.
    const bins = walk(src, ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.mp4', '.zip', '.exe', '.wasm']);
    bins.length ? fail(`binary under src: ${bins[0]}`) : pass();
    break;
  }
  case 'hyg-secret-scan': {
    const files = [...tsx(), ...walk(functionsDir, ['.ts', '.js'])];
    const hit = firstMatch(files, /-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{16,}|xox[baprs]-[0-9a-zA-Z-]{10,}/);
    hit ? fail(`possible secret: ${hit}`) : pass();
    break;
  }
  case 'fe-i18n-central-copy': {
    // Heuristic: no long hardcoded sentence text directly in JSX (should use the i18n bundle).
    const files = tsx().filter((f) => f.endsWith('.tsx') && !/i18n|\.test\./.test(f));
    const hit = firstMatch(files, />\s*[A-Z][a-z]+(\s+[A-Za-z,]+){4,}[.?!]?\s*</);
    hit ? fail(`hardcoded JSX copy: ${hit}`) : pass();
    break;
  }
  default:
    console.error(`unknown rule: ${ruleId}`);
    process.exit(2);
}
