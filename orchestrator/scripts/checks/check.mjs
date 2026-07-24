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
import { execFileSync } from 'node:child_process';
import { join, extname } from 'node:path';

/** NUL separator for `git ls-files -z`, built from a code point so no text transform can mangle it. */
const NUL = String.fromCharCode(0);
/** Line-feed, built from a code point so no heredoc or text transform can mangle it. */
const EOL = String.fromCharCode(10);

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
/** Test files. They construct request bodies and fixtures on purpose, so
 *  handler-shaped rules (input validation, auth stubs, headers) must not be
 *  applied to them — a test asserting a 400 is not an unvalidated endpoint. */
const isTestFile = (f) => /\.(test|spec)\.(ts|tsx|js|mjs)$/.test(f);

/**
 * Files tracked by git under `dir`, as absolute-ish repo paths.
 * Returns an empty list outside a git repo, in which case the caller's rule is
 * simply not decidable and must not invent a verdict.
 */
function trackedFiles(dir) {
  try {
    // Run git INSIDE the target directory. Running it in the caller's cwd asks
    // the wrong repository, so a target outside that repo returns nothing and
    // the rule silently measures an empty file list.
    const out = execFileSync('git', ['ls-files', '-z'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    // -z is NUL-separated so paths containing spaces survive intact.
    return out.split(NUL).filter(Boolean);
  } catch {
    return [];
  }
}

/** Files whose raw literals are legitimately allowed (token/theme definitions). */
const isThemeFile = (f) => /theme\.(ts|css)$|tokens?\.(ts|json)$/.test(f);
/**
 * The rule's subject does not exist in this app, so there is nothing to measure.
 *
 * Exit 3, NOT 0. Reporting `pass` for a rule that was never exercised inflates
 * the numerator with unearned credit — the README explicitly promises that an
 * inapplicable rule is "excluded from the denominator instead of inventing a
 * pass for it", and three checks were doing the opposite. The runner records
 * this as not-applicable, so the rule leaves the score entirely.
 */
const notApplicable = (why) => {
  if (why) console.error(`n/a: ${why}`);
  process.exit(3);
};

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

/** SQL clause structure that marks a string as an actual query, not prose. */
const SQL_CLAUSE =
  /(\bSELECT\b[\s\S]*?\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\b[\s\S]*?\bSET\b|\bDELETE\s+FROM\b)/i;

/**
 * Find SQL built by string interpolation — in a template literal (`... ${x}`) OR
 * by concatenation (`"SELECT ... " + id`). The template-only version missed the
 * textbook `"SELECT * FROM t WHERE id = '" + id + "'"`, so a string-concat
 * injection cleared the blocker. Prose like "create, edit, and delete ${e}" is
 * ignored because it lacks SQL clause structure.
 */
function findInterpolatedSql(content) {
  const templateRe = /`(?:\\[\s\S]|[^\\`])*`/g;
  let m;
  while ((m = templateRe.exec(content)) !== null) {
    const lit = m[0];
    if (/\$\{/.test(lit) && SQL_CLAUSE.test(lit)) {
      return lit.slice(0, 120).replace(/\s+/g, ' ');
    }
  }
  // Concatenation: a SQL-clause string literal adjacent to a `+`, i.e. a query
  // string being glued to a variable. `'...' + x` or `x + '...'`.
  const concatRe = /(['"])((?:\\.|(?!\1).)*)\1/g;
  while ((m = concatRe.exec(content)) !== null) {
    if (!SQL_CLAUSE.test(m[2])) continue;
    const before = content.slice(Math.max(0, m.index - 3), m.index);
    const after = content.slice(concatRe.lastIndex, concatRe.lastIndex + 3);
    if (/\+\s*$/.test(before) || /^\s*\+/.test(after)) {
      return m[0].slice(0, 120);
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
    if (isAuthLikeName(m[1]) && bodyAlwaysReturnsTrue(m[2])) return m[1];
  }
  // const checkAuth = (): boolean => true  /  async (x): Promise<boolean> => { return true; }
  const arrowRe =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::\s*[^=]+?)?=>\s*(?:\{([^{}]*)\}|(true|!0|1))\s*;?/g;
  while ((m = arrowRe.exec(content)) !== null) {
    if (!isAuthLikeName(m[1])) continue;
    if (m[3] !== undefined || (m[2] !== undefined && bodyAlwaysReturnsTrue(m[2]))) return m[1];
  }
  return null;
}

/**
 * True when a function body unconditionally yields a truthy result — not only a
 * bare `return true`, but a body that logs/does other statements and then
 * returns true, or a `return <anything> || true` that can never be false. The
 * original "body is exactly `return true`" test let `{ log(x); return true; }`
 * and `return role === 'admin' || true` through.
 */
function bodyAlwaysReturnsTrue(body) {
  // A `... || true` / `|| !0` / `|| 1` return is always truthy.
  if (/return\s[^;]*\|\|\s*(true|!0|1)\s*;?/.test(body)) return true;
  // The last return in the body is a truthy constant, regardless of preceding
  // statements — as long as there is no earlier conditional return that could
  // return something else first (a real guard has a `return false`/`return null`
  // path). If any `return` in the body yields a non-truthy value, it is not an
  // unconditional stub.
  const returns = [...body.matchAll(/return\s+([^;]+);?/g)].map((r) => r[1].trim());
  if (returns.length === 0) return false;
  const truthy = (r) => /^(true|!0|1)$/.test(r);
  return returns.every(truthy);
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
    if (fetchFiles.length === 0) notApplicable('no outbound fetch in this app');
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
    const files = walk(functionsDir, ['.ts', '.js']).filter((f) => !isTestFile(f));
    if (files.length === 0) notApplicable('no function files in this app');
    const constructsResponse = (c) =>
      /\bnew\s+Response\b|\bResponse\.json\s*\(|\bResponse\.redirect\s*\(/.test(c);
    // nosniff is required on every constructed Response. Matching ANY ONE of
    // four headers meant a file that set only an ACAO satisfied a rule about
    // content-type sniffing.
    const hasNosniff = (c) => /X-Content-Type-Options/i.test(c);
    // The prose forbids CORS "wider than needed", but the old check accepted the
    // literal header name anywhere in the file — so a handler setting
    // `'Access-Control-Allow-Origin': '*'` PASSED the rule that exists to
    // forbid exactly that.
    const wildcardCors = /Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*['"]/i;
    for (const f of files) {
      const c = read(f);
      if (!constructsResponse(c)) continue;
      if (wildcardCors.test(c)) {
        fail(`wildcard CORS origin (Access-Control-Allow-Origin: *): ${f}`);
      }
      if (!hasNosniff(c)) fail(`no X-Content-Type-Options header on a Response: ${f}`);
    }
    pass();
    break;
  }
  case 'u-val-input-validation': {
    // Function handlers that read a request body should validate with a real schema.
    // JSON.parse alone must never satisfy this rule.
    const files = walk(functionsDir, ['.ts', '.js']).filter((f) => !isTestFile(f));
    const readsBody = files.filter((f) => /await\s+\w+\.json\(\)|request\.json\(\)/.test(read(f)));
    if (readsBody.length === 0) notApplicable('no handler reads a request body');
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
    // Scans the WHOLE app, not just src/. Scoping this to src/ meant the rule
    // could not see the ~1.9 MB of tracked PNGs sitting one directory over in
    // public/, and reported PASS on every run. An app legitimately ships brand
    // and OG art, so the rule is an allowlisted-directory + size budget rather
    // than a blanket ban — which is also what the prose ("past size and
    // extension thresholds") always said, though no threshold was implemented.
    const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.avif', '.svg'];
    const FORBIDDEN_EXT = ['.mp4', '.mov', '.zip', '.tar', '.gz', '.exe', '.dll', '.wasm', '.pdf'];
    /** Asset directories where shipping an image is expected. */
    // `git ls-files` yields repo-relative paths with no leading separator, so
    // the segment must be anchored to start-or-separator, not separator only.
    // Anything under src/ is source, not an asset directory — `src/assets/` is
    // still a binary committed into source, which is what this rule forbids.
    const underSrc = (f) => /(^|[\\/])src[\\/]/.test(f);
    const isAssetDir = (f) => !underSrc(f) && /(^|[\\/])(public|assets|static)[\\/]/.test(f);
    /** Largest single asset an app should ship. */
    const MAX_ASSET_BYTES = 750 * 1024;

    // Only TRACKED files count. The rule is about what is committed, and a
    // filesystem walk also sees local scratch (generated logo variants, review
    // screenshots) that git ignores — flagging those is a false failure, which
    // trains people to ignore the gate.
    const tracked = trackedFiles(appDir);
    const withExt = (exts) => tracked.filter((f) => exts.includes(extname(f).toLowerCase()));

    const forbidden = withExt(FORBIDDEN_EXT).filter((f) => !isTestFile(f));
    if (forbidden.length > 0) fail(`forbidden binary committed: ${forbidden[0]}`);

    const images = withExt(IMAGE_EXT);
    for (const f of images) {
      if (!isAssetDir(f)) fail(`image outside an asset directory: ${f}`);
      let bytes = 0;
      try {
        bytes = statSync(join(appDir, f)).size;
      } catch {
        continue;
      }
      if (bytes > MAX_ASSET_BYTES) {
        fail(
          `asset over ${Math.round(MAX_ASSET_BYTES / 1024)}KB: ${f} (${Math.round(bytes / 1024)}KB)`
        );
      }
    }
    pass();
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
  case 'ci-sha-pinned':
  case 'ci-least-privilege':
  case 'ci-no-injection': {
    // CI-lane checks over .github/workflows. If the target ships no workflows the
    // lane does not apply and must be waived by the caller, not passed here.
    const wf = trackedFiles(appDir).filter((f) => /\.github[\/]workflows[\/].+\.ya?ml$/.test(f));
    if (wf.length === 0) notApplicable('no workflow files');
    const read2 = (f) => read(join(appDir, f));
    if (ruleId === 'ci-sha-pinned') {
      // Every third-party `uses:` must pin a 40-hex SHA (with a version comment).
      for (const f of wf) {
        for (const line of read2(f).split(EOL)) {
          const m = /uses:\s*([^@\s]+)@(\S+)/.exec(line);
          if (!m) continue;
          if (m[1].startsWith('./') || m[1].startsWith('actions/')) {
            // still require a pin even for actions/*; a tag is not a pin
          }
          if (!/^[0-9a-f]{40}$/.test(m[2]))
            fail(`unpinned action (not a 40-hex SHA): ${f}: ${m[1]}@${m[2]}`);
        }
      }
      pass();
    }
    if (ruleId === 'ci-least-privilege') {
      for (const f of wf) {
        const c = read2(f);
        if (!/^permissions:/m.test(c)) fail(`no top-level permissions block: ${f}`);
        if (/permissions:\s*write-all/.test(c))
          fail(`permissions: write-all is not least-privilege: ${f}`);
        if (/uses:\s*actions\/checkout/.test(c) && !/persist-credentials:\s*false/.test(c)) {
          fail(`checkout without persist-credentials: false: ${f}`);
        }
      }
      pass();
    }
    if (ruleId === 'ci-no-injection') {
      for (const f of wf) {
        const c = read2(f);
        if (/pull_request_target/.test(c) && /actions\/checkout/.test(c)) {
          fail(`pull_request_target with a checkout is an injection surface: ${f}`);
        }
        // Untrusted interpolation directly into a run: script (single line).
        const inject = new RegExp(
          'run:[^' +
            EOL +
            ']*\\$\\{\\{\\s*(github\\.event\\.(issue|pull_request|comment)|github\\.head_ref)'
        );
        if (inject.test(c)) fail(`untrusted \${{ }} interpolated into a run script: ${f}`);
      }
      pass();
    }
    break;
  }
  case 'u-plat-worker-runtime': {
    // Node-only globals and modules in Worker or browser code. Unit tests run in
    // Node, where all of these exist, so a passing suite proves nothing here --
    // the failure only appears at runtime in Workers or the browser.
    const files = [...tsx(), ...walk(functionsDir, ['.ts', '.js'])].filter((f) => !isTestFile(f));
    if (files.length === 0) notApplicable('no worker or browser source');
    const NODE_GLOBALS = /(^|[^.\w$])(process|Buffer|__dirname|__filename)\s*[.[(]/;
    const NODE_MODULES =
      /from\s+['"](node:)?(fs|path|os|child_process|crypto|net|tls|http|https|stream|zlib)['"]|require\s*\(\s*['"](node:)?(fs|path|os|child_process|crypto)['"]/;
    const NATIVE_DEPS = /from\s+['"](bcrypt|jsonwebtoken|better-sqlite3|sqlite3|node-fetch)['"]/;
    for (const f of files) {
      const c = read(f);
      // `import.meta.env` and Vite's `process.env` shim are compile-time; only
      // flag a real runtime reference.
      const code = c.replace(/import\.meta\.env[\w.]*/g, '');
      if (NODE_GLOBALS.test(code)) fail(`Node-only global in worker/browser code: ${f}`);
      if (NODE_MODULES.test(code)) fail(`Node-only module import in worker/browser code: ${f}`);
      if (NATIVE_DEPS.test(code)) fail(`native/Node-only dependency in worker/browser code: ${f}`);
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
