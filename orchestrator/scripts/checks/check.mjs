#!/usr/bin/env node
/**
 * Deterministic rule checker. Usage: node check.mjs <ruleId> <appDir>
 * Exit 0 = rule passes, 1 = rule fails (violation), 2 = unknown rule / usage / I/O infra error.
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

/**
 * Recursively collect files under dir matching one of exts, skipping node_modules/dist.
 * Per-entry I/O errors are skipped (not treated as rule violations). If the root
 * directory cannot be listed at all, exit 2 so infra failure is distinct from a fail.
 */
function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  let names;
  try {
    names = readdirSync(dir);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`infra: cannot read directory ${dir}: ${msg}`);
    process.exit(2);
  }
  for (const name of names) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const p = join(dir, name);
    try {
      const s = statSync(p);
      if (s.isDirectory()) walk(p, exts, out);
      else if (exts.includes(extname(name))) out.push(p);
    } catch {
      // Unreadable entry (permissions, broken symlink) — skip, do not crash as violation.
      continue;
    }
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

/**
 * Parse a firstMatch hit string of the form `path:line: text`.
 * Do not split on the first colon — Windows absolute paths use a drive letter (`C:\...`).
 */
function parseHit(hit) {
  const m = /^(.*):(\d+): (.*)$/.exec(hit);
  if (!m) return { file: hit, line: 0, text: '' };
  return { file: m[1], line: Number(m[2]), text: m[3] };
}

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

/** True when content has real schema validation (zod / safeParse / non-JSON .parse). */
function hasSchemaValidation(content) {
  if (/\.safeParse\s*\(/.test(content)) return true;
  // z.object(...).parse(...) or similar chained schema.parse
  if (/\)\s*\.parse\s*\(/.test(content)) return true;
  // identifier.parse( where identifier is not JSON (JSON.parse must never count)
  if (/\b(?!JSON\b)[A-Za-z_$][\w$]*\s*\.\s*parse\s*\(/.test(content)) return true;
  return false;
}

/**
 * Find a template literal that contains real SQL syntax AND a ${ interpolation.
 * Scans the whole file so multi-line SQL is caught. Prose like "create, edit, and
 * delete ${e}" does not match because it lacks SQL clause structure.
 */
function findInterpolatedSql(content) {
  const templateRe = /`(?:\\[\s\S]|[^\\`])*`/g;
  let m;
  while ((m = templateRe.exec(content)) !== null) {
    const lit = m[0];
    if (!/\$\{/.test(lit)) continue;
    if (
      /(\bSELECT\b[\s\S]*?\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\b[\s\S]*?\bSET\b|\bDELETE\s+FROM\b)/i.test(
        lit
      )
    ) {
      return lit.slice(0, 120).replace(/\s+/g, ' ');
    }
  }
  return null;
}

/** Auth/permission-related function name. */
function isAuthLikeName(name) {
  return /auth|permission|authoriz|isAdmin|canAccess/i.test(name);
}

/**
 * Detect an auth-named function whose body unconditionally returns a truthy constant
 * (no comment required). Also used alongside comment-tagged stub patterns.
 */
function findUnconditionalAuthStub(content) {
  // function checkAuth(...): boolean { return true; }  (body with no nested braces)
  // The `(?::\s*[^{;=]+)?` is the TypeScript return-type annotation. Without it
  // the pattern only matched untyped JS, so in a strict-TS codebase — where every
  // function is annotated — this detector matched nothing at all and every
  // always-true auth guard passed.
  const fnRe =
    /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::\s*[^{;=]+)?\s*\{([^{}]*)\}/g;
  let m;
  while ((m = fnRe.exec(content)) !== null) {
    if (!isAuthLikeName(m[1])) continue;
    if (/^\s*return\s+(true|!0|1)\s*;?\s*$/.test(m[2])) {
      return m[1];
    }
  }
  // const checkAuth = (): boolean => true  /  async (x): Promise<boolean> => { return true; }
  const arrowRe =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::\s*[^=]+?)?=>\s*(?:\{\s*return\s+(true|!0|1)\s*;?\s*\}|(true|!0|1))\s*;?/g;
  while ((m = arrowRe.exec(content)) !== null) {
    if (isAuthLikeName(m[1])) return m[1];
  }
  return null;
}

/**
 * Hardcoded sentence-length text in JSX (including Prettier multi-line form).
 * Ignores expressions like {copy.x} / {en.x} and non-text children.
 */
function findHardcodedJsxCopy(content) {
  // > optional whitespace/newlines, then 5+ capitalized-start words, then <
  // No `{` in the text span so centralized {copy.foo} expressions never match.
  const re = />\s*([A-Z][a-z]+(?:\s+[A-Za-z,]+){4,}[.?!]?)\s*</g;
  const m = re.exec(content);
  if (!m) return null;
  return m[1].slice(0, 100);
}

switch (ruleId) {
  case 'u-typing-scoped-ignores': {
    // Bare @ts-ignore / @ts-nocheck / @ts-expect-error with no trailing justification fails.
    const hit = firstMatch(tsx(), /@ts-(ignore|nocheck|expect-error)\s*$/);
    hit ? fail(`unscoped ts-ignore: ${hit}`) : pass();
    break;
  }
  case 'u-sec-param-sql': {
    // SQL built by string interpolation inside a template literal (multi-line OK).
    // Require real SQL syntax so prose like "create, edit, and delete ${x}" is not flagged.
    const files = [...tsx(), ...walk(functionsDir, ['.ts', '.js'])];
    for (const f of files) {
      const snippet = findInterpolatedSql(read(f));
      if (snippet) fail(`interpolated SQL: ${f}: ${snippet}`);
    }
    pass();
    break;
  }
  case 'u-sec-no-stub-paths': {
    // Stubbed auth / always-true guards (comment-tagged OR auth-named unconditional true).
    const files = [...tsx(), ...walk(functionsDir, ['.ts', '.js'])];
    const hit = firstMatch(
      files,
      /(return\s+true;?\s*\/\/\s*(auth|stub))|(\/\/\s*TODO:?\s*(auth|secure|validate))|stubbedAuth/i
    );
    if (hit) fail(`stubbed auth path: ${hit}`);
    for (const f of files) {
      const name = findUnconditionalAuthStub(read(f));
      if (name) fail(`stubbed auth path: ${f}: unconditional truthy return in ${name}`);
    }
    pass();
    break;
  }
  case 'u-sec-timeouts': {
    // Each function file that calls fetch must itself carry an AbortSignal/timeout.
    const files = walk(functionsDir, ['.ts', '.js']);
    const fetchFiles = files.filter((f) => /\bfetch\s*\(/.test(read(f)));
    if (fetchFiles.length === 0) pass(); // no outbound calls → N/A, passes
    for (const f of fetchFiles) {
      const c = read(f);
      if (!/AbortController|signal:|AbortSignal\.timeout/.test(c)) {
        fail(`fetch without AbortSignal/timeout: ${f}`);
      }
    }
    pass();
    break;
  }
  case 'u-sec-headers-cors': {
    // Each function file that constructs a Response must set security headers in that file.
    // Shared helpers that build Response with headers pass; raw new Response without headers fail.
    // Files that only call a helper (no direct Response construction) are not checked here.
    const files = walk(functionsDir, ['.ts', '.js']);
    if (files.length === 0) pass();
    const constructsResponse = (c) =>
      /\bnew\s+Response\b|\bResponse\.json\s*\(|\bResponse\.redirect\s*\(/.test(c);
    const hasHeaders = (c) =>
      /X-Content-Type-Options|Content-Security-Policy|Access-Control-Allow-Origin|Referrer-Policy/i.test(
        c
      );
    for (const f of files) {
      const c = read(f);
      if (!constructsResponse(c)) continue;
      if (!hasHeaders(c)) fail(`no security/CORS headers: ${f}`);
    }
    pass();
    break;
  }
  case 'u-val-input-validation': {
    // Function handlers that read a request body should validate with a real schema.
    // JSON.parse alone must never satisfy this rule.
    const files = walk(functionsDir, ['.ts', '.js']);
    const readsBody = files.filter((f) => /await\s+\w+\.json\(\)|request\.json\(\)/.test(read(f)));
    if (readsBody.length === 0) pass();
    for (const f of readsBody) {
      if (!hasSchemaValidation(read(f))) {
        fail(`request body parsed without schema validation: ${f}`);
      }
    }
    pass();
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
    const { file: f } = parseHit(hit);
    /DOMPurify|sanitize/i.test(read(f)) ? pass() : fail(`unsanitized HTML: ${hit}`);
    break;
  }
  case 'hyg-no-binaries': {
    // No committed binaries under src.
    const bins = walk(src, [
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.webp',
      '.ico',
      '.mp4',
      '.zip',
      '.exe',
      '.wasm'
    ]);
    bins.length ? fail(`binary under src: ${bins[0]}`) : pass();
    break;
  }
  case 'hyg-secret-scan': {
    const files = [...tsx(), ...walk(functionsDir, ['.ts', '.js'])];
    const hit = firstMatch(
      files,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{16,}|xox[baprs]-[0-9a-zA-Z-]{10,}/
    );
    hit ? fail(`possible secret: ${hit}`) : pass();
    break;
  }
  case 'fe-i18n-central-copy': {
    // Heuristic: no long hardcoded sentence text directly in JSX (should use the i18n bundle).
    // Multi-line JSX (Prettier) is scanned on the whole file, not line-by-line.
    const files = tsx().filter((f) => f.endsWith('.tsx') && !/i18n|\.test\./.test(f));
    for (const f of files) {
      const snippet = findHardcodedJsxCopy(read(f));
      if (snippet) fail(`hardcoded JSX copy: ${f}: ${snippet}`);
    }
    pass();
    break;
  }
  case 'u-sec-sast': {
    // Lightweight SAST: dangerous sinks in app/function source.
    const files = [...tsx(), ...walk(functionsDir, ['.ts', '.js'])];
    const hit = firstMatch(
      files,
      /\beval\s*\(|new\s+Function\s*\(|child_process|\.innerHTML\s*=|document\.write\s*\(/
    );
    hit ? fail(`SAST sink: ${hit}`) : pass();
    break;
  }
  case 'u-conc-no-padding': {
    // No gratuitous padding: 3+ consecutive blank lines.
    const files = tsx();
    for (const f of files) {
      if (/\n[ \t]*\n[ \t]*\n[ \t]*\n/.test(read(f))) fail(`3+ blank lines: ${f}`);
    }
    pass();
    break;
  }
  case 'hyg-no-duplication': {
    // Real copy-paste: the same 8-line block of SUBSTANTIVE code in 2+ files.
    // Pure style-property runs (`key: value,`) are excluded — two style objects
    // both reading values from shared theme tokens is consistent token usage, not
    // harmful duplication, and forcing them into a shared abstraction would trip
    // the no-speculative-abstraction rule. This mirrors token-based tools (jscpd).
    const files = [...tsx(), ...walk(functionsDir, ['.ts', '.js'])];
    const seen = new Map();
    const WIN = 8;
    const isPropLine = (l) => /^[\w'"[\]-]+\s*:\s*.+,?$/.test(l); // style/object property
    for (const f of files) {
      const lines = read(f)
        .split('\n')
        .map((l) => l.trim())
        .filter(
          (l) =>
            l.length > 8 && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('import')
        );
      // Framework-mandated boilerplate that cannot (and must not) be abstracted:
      // Cloudflare Pages Function handler signatures are exported per-route by design.
      const isBoilerplate = (l) =>
        /onRequest(Post|Get|Put|Delete|Patch)?\b|:\s*Promise<Response>|export async function/.test(
          l
        );
      for (let i = 0; i + WIN <= lines.length; i++) {
        const win = lines.slice(i, i + WIN);
        const propShare = win.filter(isPropLine).length / WIN;
        if (propShare > 0.6) continue; // mostly style props → not substantive duplication
        if (win.some(isBoilerplate)) continue; // platform-required handler signatures
        const block = win.join('\n');
        const prev = seen.get(block);
        if (prev && prev !== f) fail(`duplicated code across ${prev} and ${f}`);
        if (!prev) seen.set(block, f);
      }
    }
    pass();
    break;
  }
  default:
    console.error(`unknown rule: ${ruleId}`);
    process.exit(2);
}
