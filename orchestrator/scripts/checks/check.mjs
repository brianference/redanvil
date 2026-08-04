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
import { runCiActionlint } from './ci-actionlint.mjs';
import { runProcConventionalCommits } from './proc-conventional-commits.mjs';
import { runTestAcceptance } from './u-test-acceptance.mjs';
import { runFeatureAudit } from './u-test-feature-audit.mjs';
import { runTestPresence } from './u-test-presence.mjs';
import { runCoverageRatchet } from './u-test-coverage-ratchet.mjs';
import { runApiRealOutput } from './u-api-real-output.mjs';
import { runClaimsCovered } from './u-claims-covered.mjs';
import { runExitCodeIntegrity } from './ci-exit-code-integrity.mjs';
import { runNoPlaceholders } from './u-no-placeholders.mjs';
import { runVisibleResponse } from './fe-visible-response.mjs';
import { runIntegrationScan } from './u-integration-scan.mjs';
import { runCompetitorScan } from './u-competitor-scan.mjs';
import { runProcPrTitleTicket } from './proc-pr-title-ticket.mjs';
import { runLgShipped } from './lg-shipped.mjs';
import { runLgPushCadence } from './lg-push-cadence.mjs';
import { runSearchPresent } from './fe-search-present.mjs';
import { runAssistantPresent } from './fe-assistant-present.mjs';
import { runLightDark } from './fe-light-dark.mjs';
import { runBrandMark } from './fe-brand-mark.mjs';
import { runPriorArt } from './fe-prior-art.mjs';
import { runArtifactVerified } from './proc-artifact-verified.mjs';
import { runBuildSucceeds } from './u-build-succeeds.mjs';
import { runApiNotFound } from './u-api-not-found.mjs';
import { runApiNoSpaMask } from './u-api-no-spa-mask.mjs';
import { runLegalClaimsTrue } from './u-legal-claims-true.mjs';
import { runFaviconLegible } from './fe-favicon-legible.mjs';
import { runResultReproduces } from './lg-result-reproduces.mjs';
import { runMeasKnownBad } from './meas-known-bad.mjs';
import { runMeasTwoRun } from './meas-two-run.mjs';
import { runMeasRecheckFlattering } from './meas-recheck-flattering.mjs';
import { runMeasStandardTool } from './meas-standard-tool.mjs';
import { runMeasEngineNamed } from './meas-engine-named.mjs';
import { runBreadcrumbs } from './fe-breadcrumbs.mjs';
import { runDesignOptions } from './proc-design-options.mjs';
import { runLegalSubstance } from './fe-legal-substance.mjs';
import { runStructuredData } from './fe-structured-data.mjs';
import { runBindingsBound } from './lg-bindings-bound.mjs';
import { runBrandMarkSize } from './fe-brand-mark-size.mjs';
import { runResourceLinks } from './fe-resource-links.mjs';
import { runResultInViewport } from './fe-result-in-viewport.mjs';
import { runTestRunners } from './u-test-runners.mjs';
// The cross-app duplication pass already owns the definition of "the same code":
// comments stripped, whitespace collapsed, identifiers normalised, keywords kept.
// This check used to compare raw trimmed lines instead, so the two passes
// disagreed about what duplication means — a copy that renamed one variable was
// duplication across apps and not duplication inside one. One definition now.
import {
  normaliseSource,
  isMostlyStyleProps,
  MIN_BLOCK
} from '../../../.github/scripts/cross_app_duplication.mjs';

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

/**
 * Workflows that actually build and deploy this app, and the directory they
 * live in.
 *
 * The CI lane used to look only inside `appDir`. In a monorepo an app has no
 * `.github/workflows` of its own — the repo's workflows are what typecheck,
 * test, build and deploy it — so all four `ci-*` rules returned "no workflow
 * files" and left the denominator, while the workflows they describe existed
 * and were unexamined by that lane.
 *
 * Falls back to the enclosing git repository. A standalone scaffold with no
 * repo workflows still gets nothing, which is the correct n/a.
 *
 * @param {string} dir App directory.
 * @returns {{ root: string, files: string[] }}
 */
function resolveWorkflows(dir) {
  const own = trackedFiles(dir).filter((f) => /\.github[/\\]workflows[/\\].+\.ya?ml$/.test(f));
  if (own.length > 0) return { root: dir, files: own };
  let repoRoot = '';
  try {
    repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return { root: dir, files: [] };
  }
  if (repoRoot.length === 0) return { root: dir, files: [] };
  const repoFiles = trackedFiles(repoRoot).filter((f) =>
    /\.github[/\\]workflows[/\\].+\.ya?ml$/.test(f)
  );
  return { root: repoRoot, files: repoFiles };
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

/**
 * Blank out regex literals in a line, keeping its length and the rest of the code.
 *
 * A content scanner must not match the pattern that defines it. `u-data-no-placeholder`
 * failed on `const PLACEHOLDER_RE = /\b(TBD|TODO|lorem ipsum)\b/i` — the detector
 * flagging its own source, the same self-match that once blocked a secret-scanner's
 * install commit. This removes only regex literals, so placeholder text sitting in a
 * string, JSX, or seed object is still caught.
 */
function stripRegexLiterals(line) {
  // A literal starts after an operator/punctuator (never after an identifier or `)`,
  // where `/` is division) and runs to the next unescaped `/`, allowing char classes.
  return line.replace(
    /([=(,:[!&|?+]|\breturn\b|^)(\s*)\/(?![*/])(?:\\.|\[(?:\\.|[^\]\\])*\]|[^/\\])+\/[dgimsuy]*/g,
    (_m, lead, ws) => `${lead}${ws}/RE/`
  );
}

/** Any file matching pred → returns the first offending "file: line" or null. */
function firstMatch(files, re, skip = () => false, sanitize = (l) => l) {
  for (const f of files) {
    if (skip(f)) continue;
    const lines = read(f).split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (re.test(sanitize(lines[i]))) {
        return `${f}:${i + 1}: ${lines[i].trim().slice(0, 100)}`;
      }
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
 * Identifiers that hold fixed SQL structure (column lists, optional `?` clauses,
 * `?,?,?` placeholder runs) — not request values.
 *
 * Safe shapes in the same module/function:
 * - `const COLS = 'id, name'` / `` const COLS = `id, name` `` (no nested `${`)
 * - `const clause = cond ? ' AND x = ?' : ''` (both branches string literals)
 * - `const placeholders = ids.map(() => '?').join(',')` (only `?` markers; values
 *   are still bound separately)
 *
 * Parameters, request-derived expressions, and any other interpolation still fail.
 *
 * @param {string} content File source.
 * @returns {Set<string>} Identifier names.
 */
function safeSqlFragmentIdents(content) {
  /** @type {Set<string>} */
  const names = new Set();

  // const NAME = 'lit' / "lit" / `lit without ${}`
  const litRe =
    /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"`])([\s\S]*?)\2\s*;/g;
  let m;
  while ((m = litRe.exec(content)) !== null) {
    const quote = m[2];
    const body = m[3] ?? '';
    if (quote === '`' && /\$\{/.test(body)) continue;
    names.add(m[1]);
  }

  // Single-line only: const NAME = <simpleExpr> ? 'a' : 'b'
  // Branches must be ' or " literals (not backticks) so ${} cannot sneak in.
  // Multi-line / template branches are not treated as safe structure.
  const ternaryRe =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^\n;?=]+?\?\s*(['"])([^'"]*)\2\s*:\s*(['"])([^'"]*)\4\s*;/g;
  while ((m = ternaryRe.exec(content)) !== null) {
    names.add(m[1]);
  }

  // const placeholders = ids.map(() => '?').join(',')  — structure only, values bound later
  const phRe =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;]*?\.map\s*\(\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*['"`]\?['"`]\s*\)\s*\.join\s*\(\s*['"`],['"`]\s*\)/g;
  while ((m = phRe.exec(content)) !== null) {
    names.add(m[1]);
  }

  return names;
}

/**
 * True when every `${expr}` in a template is a bare identifier in the safe set.
 *
 * @param {string} templateLit Full template including backticks.
 * @param {Set<string>} safeIdents Safe fragment names.
 * @returns {boolean}
 */
function onlySafeConstInterpolations(templateLit, safeIdents) {
  const inner = templateLit.slice(1, -1);
  const exprRe = /\$\{([^}]*)\}/g;
  let m;
  let count = 0;
  while ((m = exprRe.exec(inner)) !== null) {
    count += 1;
    const expr = (m[1] ?? '').trim();
    // Bare identifier only — not id.x, not fn(), not a || b.
    if (!/^[A-Za-z_$][\w$]*$/.test(expr)) return false;
    if (!safeIdents.has(expr)) return false;
  }
  return count > 0;
}

/**
 * Find SQL built by string interpolation — in a template literal (`... ${x}`) OR
 * by concatenation (`"SELECT ... " + id`). The template-only version missed the
 * textbook `"SELECT * FROM t WHERE id = '" + id + "'"`, so a string-concat
 * injection cleared the blocker. Prose like "create, edit, and delete ${e}" is
 * ignored because it lacks SQL clause structure.
 *
 * Fixed structure fragments (module/local const column lists, optional `?`
 * clauses, `?,?,?` placeholder runs) are not findings — they cannot carry a
 * request value. Parameters, arguments, and any other expression still fail.
 *
 * @param {string} content File source.
 * @returns {string | null} Snippet of the finding, or null when clean.
 */
function findInterpolatedSql(content) {
  const safeIdents = safeSqlFragmentIdents(content);
  const templateRe = /`(?:\\[\s\S]|[^\\`])*`/g;
  let m;
  while ((m = templateRe.exec(content)) !== null) {
    const lit = m[0];
    if (!/\$\{/.test(lit) || !SQL_CLAUSE.test(lit)) continue;
    if (onlySafeConstInterpolations(lit, safeIdents)) continue;
    return lit.slice(0, 120).replace(/\s+/g, ' ');
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
    // Every file that calls fetch must itself carry an AbortSignal/timeout.
    //
    // This used to walk `functions/` only, so it returned n/a for both apps —
    // neither backend makes an outbound call — while the CLIENT made four, one
    // of them cross-origin to raw.githubusercontent.com with no timeout at all.
    // A hung request there left the dashboard on its loading skeleton forever:
    // a failure rendered as a clean pending state. The rule is about explicit
    // timeouts on calls that can hang, and a browser fetch hangs the same way a
    // server one does.
    const files = [...walk(functionsDir, ['.ts', '.js']), ...tsx()].filter((f) => !isTestFile(f));
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
    // Untrusted input must be validated with a real schema. JSON.parse alone,
    // or a hand-written chain of typeof checks, must never satisfy this rule.
    //
    // Two boundaries count, not one. This used to look at request bodies in
    // `functions/` only, so an app with no write endpoints was ruled n/a
    // entirely — and an independent judge pointed out that the dashboard's one
    // genuinely untrusted input, a CROSS-ORIGIN JSON feed pulled straight into
    // the client, was therefore never examined. It was being validated by a
    // typeof chain that happily accepted `NaN`, a negative count and an empty
    // id, because `typeof NaN === 'number'`.
    //
    // Same-origin responses from the app's own validated endpoints are
    // deliberately excluded: that data already crossed a validated boundary,
    // and firing here would be a second gate on the same input.
    const serverFiles = walk(functionsDir, ['.ts', '.js']).filter((f) => !isTestFile(f));
    const readsBody = serverFiles.filter((f) =>
      /await\s+\w+\.json\(\)|request\.json\(\)/.test(read(f))
    );
    const clientFiles = tsx().filter((f) => !isTestFile(f));
    const readsForeignJson = clientFiles.filter((f) => {
      const c = read(f);
      // A fetch of an absolute http(s) URL is another origin's data.
      return /fetch\s*\(\s*[`'"]https?:\/\//.test(c) || /https?:\/\/[^`'"\s]+/.test(c)
        ? /\.json\s*\(\s*\)/.test(c) && /fetch\s*\(/.test(c)
        : false;
    });
    const boundaries = [...readsBody, ...readsForeignJson];
    if (boundaries.length === 0) notApplicable('no request body and no cross-origin JSON read');

    /**
     * Whether a file validates itself, or hands the payload to a local module
     * that does.
     *
     * Delegating to a named parser is better design than inlining a schema at
     * every call site, so a per-file check that refused it would push toward
     * worse code. Only ONE hop is followed, and the imported module must both
     * contain real schema validation AND be called here — a mere import proves
     * nothing.
     */
    const validatesDirectlyOrByDelegation = (file) => {
      const c = read(file);
      if (hasSchemaValidation(c)) return true;
      const dir = file.slice(0, Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\')));
      for (const m of c.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
        const names = m[1]
          .split(',')
          .map(
            (n) =>
              n
                .trim()
                .replace(/^type\s+/, '')
                .split(/\s+as\s+/)[0]
          )
          .filter(Boolean);
        // The imported symbol has to actually be invoked on this path.
        if (!names.some((n) => new RegExp(`\\b${n}\\s*\\(`).test(c))) continue;
        for (const ext of ['.ts', '.tsx', '/index.ts']) {
          const target = join(dir, `${m[2]}${ext}`);
          if (existsSync(target) && hasSchemaValidation(read(target))) return true;
        }
      }
      return false;
    };

    for (const f of boundaries) {
      if (!validatesDirectlyOrByDelegation(f)) {
        fail(`untrusted JSON parsed without schema validation: ${f}`);
      }
    }
    pass();
    break;
  }
  case 'fe-theme-tokens-only': {
    // No raw hex colours anywhere a colour can be rendered from. Restricting the
    // scan to components/ and pages/ .tsx meant a hardcoded colour in a
    // stylesheet, in src/App.tsx, or in any other src module satisfied a rule
    // whose entire point is that colour comes from tokens.
    const files = walk(src, ['.ts', '.tsx', '.css']).filter((f) => !isTestFile(f));
    if (files.length === 0) notApplicable('no rendered source');
    const hit = firstMatch(files, /#[0-9a-fA-F]{3,8}\b/, isThemeFile);
    hit ? fail(`raw hex outside the token layer: ${hit}`) : pass();
    break;
  }
  case 'fe-no-unsanitized-html': {
    // EVERY occurrence, not just the first. `firstMatch` returned a single hit
    // for the whole app and only that file was asked whether it sanitizes, so a
    // sanitized file earlier in walk order hid every unsanitized use after it.
    for (const f of tsx()) {
      const c = read(f);
      if (!/dangerouslySetInnerHTML/.test(c)) continue;
      // Require a sanitizer CALL in the same file. Matching the bare word
      // `sanitize` anywhere also accepted a comment promising to sanitize later.
      if (!/\bDOMPurify\s*\.\s*sanitize\s*\(|\bsanitizeHtml\s*\(|\bsanitize\s*\(/i.test(c)) {
        fail(`unsanitized HTML: ${f}`);
      }
    }
    pass();
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
    // `images` and `screenshots` are included because both ARE asset
    // directories: the rule's intent is that images live somewhere designated
    // and stay inside a size budget, not that only three directory names exist.
    // Review screenshots in particular are load-bearing here — the gate refuses
    // a verdict whose evidence path does not exist, so they have to be
    // committed. The size budget below still applies to every one of them.
    // Running this against the repo, not only a generated app, surfaced it.
    const isAssetDir = (f) =>
      !underSrc(f) && /(^|[\\/])(public|assets|static|images|screenshots)[\\/]/.test(f);
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
    // Scans the WHOLE app, not just src/ and functions/. A credential is most
    // often committed in exactly the places this used to skip: wrangler.toml, a
    // JSON config, a workflow file, a shell script. Two source directories is
    // not a secret scan.
    //
    // `.env` and `.dev.vars` are deliberately NOT read. They are gitignored by
    // policy, `hyg-env-ignored` is the rule that covers them, and opening them
    // here would mean the checker itself reads secret files.
    const SCAN_EXT = [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.mjs',
      '.cjs',
      '.json',
      '.toml',
      '.yml',
      '.yaml',
      '.ini',
      '.cfg',
      '.sh',
      '.ps1',
      '.sql',
      '.md',
      '.txt',
      '.html'
    ];
    const isSecretFile = (f) => /(^|[\\/])\.(env|dev\.vars)/.test(f);
    const files = walk(appDir, SCAN_EXT).filter(
      (f) => !isSecretFile(f) && !/[\\/](dist|build|coverage)[\\/]/.test(f)
    );
    if (files.length === 0) notApplicable('no scannable files');
    // Provider key shapes. The original set covered four issuers and missed the
    // ones this environment actually uses (GitHub, Google, xAI, Anthropic).
    const SECRET =
      /-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{16,}|xox[baprs]-[0-9a-zA-Z-]{10,}|gh[pousr]_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{50,}|AIza[0-9A-Za-z_-]{30,}|xai-[0-9A-Za-z]{20,}|sk-ant-[0-9A-Za-z_-]{20,}|sk-proj-[0-9A-Za-z_-]{20,}|glpat-[0-9A-Za-z_-]{20,}/;
    // A redacted example in a doc is not a leak, and the detector must not match
    // the pattern that defines it.
    const REDACTED = /\bREDACTED\b|\bEXAMPLE\b|x{8,}|\.{3,}|<[a-z-]+>/i;
    for (const f of files) {
      const lines = read(f).split(EOL);
      for (let i = 0; i < lines.length; i++) {
        const line = stripRegexLiterals(lines[i]);
        if (!SECRET.test(line) || REDACTED.test(line)) continue;
        fail(`possible secret: ${f}:${i + 1}`);
      }
    }
    pass();
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
    // CI-lane checks over .github/workflows — the app's own, or the enclosing
    // repo's, because in a monorepo those are the workflows that build this app.
    // If neither exists the lane genuinely does not apply and must be waived by
    // the caller, not passed here.
    const resolved = resolveWorkflows(appDir);
    const wf = resolved.files;
    if (wf.length === 0) notApplicable('no workflow files');
    const read2 = (f) => read(join(resolved.root, f));
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
  case 'u-data-no-placeholder': {
    // per-app-pack: "Real data only. No dummy, fake, placeholder, or lorem ipsum
    // content." Previously unscored prose — a shipped lorem block passed the gate.
    const files = [...tsx(), ...walk(functionsDir, ['.ts', '.js'])].filter((f) => !isTestFile(f));
    if (files.length === 0) notApplicable('no source files');
    const PLACEHOLDER =
      /lorem\s+ipsum|dolor\s+sit\s+amet|foo@(example|test)\.com|john\.?doe@|TODO:\s*replace|REPLACE_ME|<placeholder>|xxx-xxx-xxx/i;
    const hit = firstMatch(files, PLACEHOLDER, () => false, stripRegexLiterals);
    hit ? fail(`placeholder / lorem data in shipped source: ${hit}`) : pass();
    break;
  }
  case 'fe-seo-assets': {
    // per-app-pack: "Full SEO: ... a real OG image, sitemap, robots.txt". These are
    // FILES — deterministically checkable, not something a reviewer should assert.
    const pub = join(appDir, 'public');
    if (!existsSync(pub)) notApplicable('no public/ directory');
    const need = ['sitemap.xml', 'robots.txt'];
    for (const n of need) {
      if (!existsSync(join(pub, n))) fail(`missing SEO asset: public/${n}`);
    }
    const og = readdirSync(pub).some((f) => /^og[.-]|og.*\.(png|jpg|webp)$/i.test(f));
    if (!og) fail('missing a real OG image in public/ (og.png or similar)');
    pass();
    break;
  }
  case 'u-plat-migrations': {
    // A D1 binding implies the schema must be reproducible from the repo. The app
    // shipped with no migrations/ at all and only a dump under backups/, so a
    // fresh database could not be recreated.
    const wrangler = join(appDir, 'wrangler.toml');
    if (!existsSync(wrangler)) notApplicable('no wrangler.toml');
    if (!/\[\[d1_databases\]\]/.test(read(wrangler))) notApplicable('no D1 binding');
    const mig = join(appDir, 'migrations');
    if (!existsSync(mig))
      fail('D1 binding present but no migrations/ directory — schema is not reproducible');
    const ddl = walk(mig, ['.sql']).some((f) => /CREATE\s+TABLE/i.test(read(f)));
    ddl ? pass() : fail('migrations/ contains no CREATE TABLE — schema is not reproducible');
    break;
  }
  case 'fe-no-inline-width': {
    // Width caps belong in CSS, where a media query can lift them.
    //
    // An inline style beats a class, so an inline cap is unliftable by
    // definition. This shipped FOUR separate times here — the template gallery,
    // the saved-PRD page, the wizard form, and the Saved page — and every time
    // it held a desktop layout to a third of the screen while every other check
    // passed, because the width check was measuring the container rather than
    // what is painted inside it.
    //
    // Scoped to `maxWidth`, deliberately. All four incidents were a maxWidth
    // ceiling on a layout container, and that is the shape a media query cannot
    // lift. A fixed `width` is how an icon, badge, avatar or 1px divider is
    // drawn — sizing a 36px status chip is not a layout decision, and flagging
    // it would push toward worse code for no gain. `minWidth: 0` is the
    // flexbox shrink idiom and removes a floor rather than imposing a ceiling.
    const files = tsx().filter((f) => !isTestFile(f));
    if (files.length === 0) notApplicable('no rendered source');
    // Quotes are optional on BOTH sides rather than back-referenced: a mangled
    // backreference made the first version match nothing at all, so it passed
    // both apps while a 40rem cap sat in each. A check that cannot fail is
    // worse than no check, which is why this one has a red test.
    const capRe = /\bmaxWidth\s*:\s*['"`]?\s*\d+(?:\.\d+)?\s*(?:rem|px|em|ch|pt)?\s*['"`]?\s*[,}]/;
    const hit = firstMatch(
      files,
      capRe,
      () => false,
      (line) => {
        // A `100%` / `100vw` ceiling is not a ceiling. Blank it before matching
        // so the rule cannot be "satisfied" by removing a legitimate one.
        if (/maxWidth\s*:\s*['"`]?\s*100\s*(%|vw)/.test(line)) return '';
        // A cap written inside a CSS template string is in exactly the right
        // place; this rule is only about JS style objects.
        if (/@media|min-width\s*:|max-width\s*:/.test(line)) return '';
        return line;
      }
    );
    if (hit !== null) {
      const { file, line, text } = parseHit(hit);
      fail(
        `inline width cap (move it to a CSS class so a media query can lift it): ${file}:${line}: ${text}`
      );
    }
    pass();
    break;
  }
  case 'fe-icon-button-labels': {
    // design rule R1.5: icon-only buttons need an accessible name. A button whose
    // children carry no text must have aria-label / aria-labelledby.
    const files = tsx().filter((f) => !isTestFile(f));
    if (files.length === 0) notApplicable('no component source');
    for (const f of files) {
      const c = read(f);
      // <button ...>{only an aria-hidden span / svg / entity}</button>
      const btnRe = /<button(\s[^>]*)?>([\s\S]*?)<\/button>/g;
      let m;
      while ((m = btnRe.exec(c)) !== null) {
        const attrs = m[1];
        const inner = m[2];
        if (/aria-label|aria-labelledby/.test(attrs)) continue;
        // Content inside an aria-hidden element provides NO accessible name, so
        // remove those subtrees first — otherwise a `<span aria-hidden>✕</span>`
        // glyph reads as text and an unlabelled icon button passes.
        const visible = inner.replace(
          /<([a-zA-Z][\w.-]*)\b[^>]*aria-hidden\s*=\s*["{]?true[^>]*>[\s\S]*?<\/\1>/g,
          ''
        );
        // A remaining JSX expression (`{copy.browseTemplates}`, `{label}`) renders
        // real text at runtime, so it DOES give the button a name. Treating it as
        // empty flagged a correctly-labelled i18n button. Stay conservative: only
        // fail when nothing but markup remains after aria-hidden content is gone.
        if (/\{[^}]*\}/.test(visible)) continue;
        const text = visible
          .replace(/<[^>]*>/g, '')
          .replace(/&[a-z]+;/gi, '')
          .trim();
        if (text.length === 0) {
          fail(`icon-only button without an accessible name: ${f}`);
        }
      }
    }
    pass();
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
  case 'u-typing-no-any': {
    // The gate ALSO runs `npx eslint .` for this rule, but an exit code of 0
    // from eslint proves nothing on its own: an app with no config, or a config
    // that never enables the rule, lints clean while being full of `any`. Two
    // separate blockers (this and u-conc-dead-code) were both decided by that
    // one invocation. This half checks the thing the rule is actually about —
    // that the config forbids `any` — so the pair now has distinct evidence.
    const files = tsx();
    if (files.length === 0) notApplicable('no typescript source to lint');
    const CONFIGS = [
      'eslint.config.js',
      'eslint.config.mjs',
      'eslint.config.cjs',
      'eslint.config.ts',
      '.eslintrc',
      '.eslintrc.js',
      '.eslintrc.cjs',
      '.eslintrc.json',
      '.eslintrc.yml'
    ];
    const found = CONFIGS.map((n) => join(appDir, n)).filter((p) => existsSync(p));
    if (found.length === 0) {
      fail('no eslint config in this app, so a clean eslint run is not evidence of anything');
    }
    const text = found.map(read).join(EOL);
    const RULE = /['"]?@typescript-eslint\/no-explicit-any['"]?\s*:\s*(['"])(off|warn|error)\1/;
    const m = RULE.exec(text);
    if (m === null) {
      // A shared preset may enable it without naming it; accept an explicit
      // strict/recommended-type-checked extend rather than demanding the literal.
      if (!/strictTypeChecked|recommendedTypeChecked|eslint:recommended.*typescript/i.test(text)) {
        fail(
          'eslint config does not enable @typescript-eslint/no-explicit-any, ' +
            'so the lint run cannot decide this rule'
        );
      }
    } else if (m[2] !== 'error') {
      fail(`@typescript-eslint/no-explicit-any is set to '${m[2]}', not 'error'`);
    }
    pass();
    break;
  }
  case 'u-conc-file-size': {
    // base-15 rule 8: "small, single-purpose files and functions, sized from the
    // corpus norm", and lg-role-architecture asks for "file and function size
    // within caps". Both were prose. Nothing measured size, so the largest file
    // in this repo reached 1365 lines with two exported functions and no check
    // ever mentioned it.
    //
    // Tests are exempt: a thorough test file is long for a good reason, and
    // capping it pushes people to delete cases.
    const MAX_SOURCE_LINES = 600;
    const files = [...tsx(), ...walk(functionsDir, ['.ts', '.js'])].filter((f) => !isTestFile(f));
    if (files.length === 0) notApplicable('no source files');
    for (const f of files) {
      const lines = read(f).split(EOL).length;
      if (lines > MAX_SOURCE_LINES) {
        fail(`file over ${MAX_SOURCE_LINES} lines: ${f} (${lines} lines)`);
      }
    }
    pass();
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
    //
    // Test files are excluded: shared vi.mock setups and zone fixtures are not
    // product duplication, and collapsing them would not improve the app.
    const files = [...tsx(), ...walk(functionsDir, ['.ts', '.js'])].filter(
      (f) => !isTestFile(f)
    );
    const seen = new Map();
    // Framework-mandated boilerplate that cannot (and must not) be abstracted:
    // Cloudflare Pages Function handler signatures are exported per-route by design.
    const isBoilerplate = (l) =>
      /onRequest(Post|Get|Put|Delete|Patch)?\b|Promise<Response>|export async function/.test(l);
    for (const f of files) {
      const lines = normaliseSource(read(f)).filter((l) => l.length > 0);
      for (let i = 0; i + MIN_BLOCK <= lines.length; i++) {
        const win = lines.slice(i, i + MIN_BLOCK);
        // Two style objects both reading shared theme tokens is consistent token
        // use, not harmful duplication — collapsing them would trip the
        // no-speculative-abstraction rule instead.
        if (isMostlyStyleProps(win)) continue;
        if (win.some(isBoilerplate)) continue;
        const block = win.join('\n');
        const prev = seen.get(block);
        if (prev && prev !== f) fail(`duplicated code across ${prev} and ${f}`);
        if (!prev) seen.set(block, f);
      }
    }
    pass();
    break;
  }
  case 'ci-actionlint': {
    // Structural workflow lint in JS — never silent-pass when actionlint is missing.
    // Linted against the directory that actually holds this app's workflows,
    // which in a monorepo is the repo root, not the app.
    runCiActionlint(resolveWorkflows(appDir).root, { pass, fail, notApplicable, EOL });
    break;
  }
  case 'u-test-acceptance': {
    runTestAcceptance(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'u-test-feature-audit': {
    runFeatureAudit(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'u-test-presence': {
    runTestPresence(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'u-test-coverage-ratchet': {
    runCoverageRatchet(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'ci-exit-code-integrity': {
    runExitCodeIntegrity(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'u-claims-covered': {
    runClaimsCovered(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'u-api-real-output': {
    await runApiRealOutput(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'u-no-placeholders': {
    runNoPlaceholders(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'fe-visible-response': {
    runVisibleResponse(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'u-integration-scan': {
    runIntegrationScan(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'u-competitor-scan': {
    runCompetitorScan(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'proc-conventional-commits': {
    runProcConventionalCommits(appDir, { pass, fail, notApplicable, EOL });
    break;
  }
  case 'proc-pr-title-ticket': {
    // `gh pr view` first, then the REST API — a machine without the CLI is a
    // tooling gap, not a property of the code, and this rule spent its whole
    // life reporting "gh not available" because of one. Still n/a when both
    // agree there is no PR; on a repo that pushes straight to master there is
    // nothing to measure and inventing a pass would be fabrication.
    await runProcPrTitleTicket(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'lg-shipped': {
    // Shipping proof: GitHub remote, pushed HEAD, live URL 200, hash match.
    // Exit 2 = infra (network / no dist) — map through so the gate does not
    // treat "cannot reach the network" as a rule violation with no detail.
    await runLgShipped(appDir, {
      pass,
      fail,
      notApplicable,
      infra: (m) => {
        if (m) console.error(`infra: ${m}`);
        process.exit(2);
      }
    });
    break;
  }
  case 'lg-push-cadence': {
    // Unpushed backlog over the threshold is a defect. Pre-push defers the
    // fail (same REDANVIL_PRE_PUSH shape as lg-shipped condition 2) so the
    // rule cannot deadlock the push it exists to force.
    runLgPushCadence(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'fe-search-present': {
    // Collection views need real TEXT search that narrows — Playwright proof.
    await runSearchPresent(appDir, {
      pass,
      fail,
      notApplicable,
      infra: (m) => {
        if (m) console.error(`infra: ${m}`);
        process.exit(2);
      }
    });
    break;
  }
  case 'proc-artifact-verified': {
    // Verdict evidence must be real OUTPUT, not a plan/spec/empty file.
    runArtifactVerified(appDir, { pass, fail, notApplicable, infra: (m) => {
      if (m) console.error(`infra: ${m}`);
      process.exit(2);
    } });
    break;
  }
  case 'fe-assistant-present': {
    // Apps with domain data ship a model-backed assistant grounded in that
    // data — proven statically, and (when a deploy URL and a
    // tests/assistant-grounding.json fixture exist) live against the
    // deployed backend's own API responses.
    await runAssistantPresent(appDir, {
      pass,
      fail,
      notApplicable,
      infra: (m) => {
        if (m) console.error(`infra: ${m}`);
        process.exit(2);
      }
    });
    break;
  }
  case 'fe-brand-mark': {
    // Real brand mark + substantive favicon/OG; text-span and emoji marks fail.
    runBrandMark(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'fe-prior-art': {
    // SOURCES / INTEGRATIONS / COMPETITORS present without unwritten markers.
    runPriorArt(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'fe-light-dark': {
    // Paint-based: landmark backgrounds must change between themes. Exit 2 =
    // infra (no playwright / no dist) — map through like lg-shipped.
    await runLightDark(appDir, {
      pass,
      fail,
      notApplicable,
      infra: (m) => {
        if (m) console.error(`infra: ${m}`);
        process.exit(2);
      }
    });
    break;
  }
  case 'u-build-succeeds': {
    runBuildSucceeds(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'u-api-not-found': {
    await runApiNotFound(appDir, {
      pass,
      fail,
      notApplicable,
      infra: (m) => {
        if (m) console.error(`infra: ${m}`);
        process.exit(2);
      }
    });
    break;
  }
  case 'u-api-no-spa-mask': {
    await runApiNoSpaMask(appDir, {
      pass,
      fail,
      notApplicable,
      infra: (m) => {
        if (m) console.error(`infra: ${m}`);
        process.exit(2);
      }
    });
    break;
  }
  case 'u-legal-claims-true': {
    runLegalClaimsTrue(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'fe-favicon-legible': {
    await runFaviconLegible(appDir, {
      pass,
      fail,
      notApplicable,
      infra: (m) => {
        if (m) console.error(`infra: ${m}`);
        process.exit(2);
      }
    });
    break;
  }
  case 'lg-result-reproduces': {
    runResultReproduces(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'meas-known-bad': {
    runMeasKnownBad(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'meas-two-run': {
    runMeasTwoRun(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'meas-recheck-flattering': {
    runMeasRecheckFlattering(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'meas-standard-tool': {
    runMeasStandardTool(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'meas-engine-named': {
    runMeasEngineNamed(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'fe-breadcrumbs': {
    await runBreadcrumbs(appDir, {
      pass,
      fail,
      notApplicable,
      infra: (m) => {
        if (m) console.error(`infra: ${m}`);
        process.exit(2);
      }
    });
    break;
  }
  case 'proc-design-options': {
    runDesignOptions(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'fe-legal-substance': {
    await runLegalSubstance(appDir, {
      pass,
      fail,
      notApplicable,
      infra: (m) => {
        if (m) console.error(`infra: ${m}`);
        process.exit(2);
      }
    });
    break;
  }
  case 'fe-structured-data': {
    runStructuredData(appDir, { pass, fail, notApplicable });
    break;
  }
  case 'lg-bindings-bound': {
    await runBindingsBound(appDir, {
      pass,
      fail,
      notApplicable,
      infra: (m) => {
        if (m) console.error(`infra: ${m}`);
        process.exit(2);
      }
    });
    break;
  }
  case 'fe-brand-mark-size': {
    await runBrandMarkSize(appDir, {
      pass,
      fail,
      notApplicable,
      infra: (m) => {
        if (m) console.error(`infra: ${m}`);
        process.exit(2);
      }
    });
    break;
  }
  case 'fe-resource-links': {
    await runResourceLinks(appDir, {
      pass,
      fail,
      notApplicable,
      infra: (m) => {
        if (m) console.error(`infra: ${m}`);
        process.exit(2);
      }
    });
    break;
  }
  case 'fe-result-in-viewport': {
    await runResultInViewport(appDir, {
      pass,
      fail,
      notApplicable,
      infra: (m) => {
        if (m) console.error(`infra: ${m}`);
        process.exit(2);
      }
    });
    break;
  }
  case 'u-test-runners': {
    runTestRunners(appDir, {
      pass,
      fail,
      notApplicable,
      infra: (m) => {
        if (m) console.error(`infra: ${m}`);
        process.exit(2);
      }
    });
    break;
  }
  default:
    console.error(`unknown rule: ${ruleId}`);
    process.exit(2);
}
