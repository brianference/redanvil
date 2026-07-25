#!/usr/bin/env node
/**
 * Cross-app source duplication pass.
 *
 * `hyg-no-duplication` walks a single app's `src`/`functions`, so copy-paste
 * between apps is invisible. This script discovers every sibling directory that
 * has both `package.json` and `src/`, compares each pair of `src` trees, and
 * reports normalised blocks of >= 8 lines.
 *
 * Normalisation strips comments, collapses whitespace, and replaces identifiers
 * with a placeholder so a rename does not defeat the detector. String literals
 * and language keywords are kept. The budget is a ratchet (cannot grow silently),
 * not a ban — lower it as shared code is extracted.
 *
 * Usage:
 *   node .github/scripts/cross_app_duplication.mjs [--json out.json] [--max N] [repoRoot]
 *
 * Exit 0 when total duplicated lines <= budget; exit 1 when over budget.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Minimum consecutive normalised lines that count as a duplicated block. */
export const MIN_BLOCK = 8;

/**
 * Default budget: the measured total on this repo. Ratcheted 805 -> 772 (shared
 * shell CSS) -> 646 (shared useDrawerA11y, once npm workspaces hoisted react to
 * one copy and React-dependent code could finally move) -> 393.
 *
 * The last step is NOT 253 lines of deduplication and must not be read as one.
 * The source did not change; the measurement was wrong. Identifier
 * normalisation flattened every React props interface and component signature
 * into the same punctuation, and multi-line import bodies survived the
 * import filter, so shared *shape* was being counted as shared *code*. Fixing
 * both dropped the honest total to 393, and the shared banners/helpers took it to 387. See `isDeclarationSkeleton`.
 *
 * Lower it again whenever real duplication is removed; never raise it to make a
 * run pass. Override with `--max N` for local experiments.
 */
export const DEFAULT_BUDGET = 387;

/** Source extensions scanned under each app's `src/`. */
const SRC_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

/**
 * Language / TypeScript keywords kept during identifier normalisation.
 * Anything else that matches an identifier pattern becomes `$`.
 * @type {ReadonlySet<string>}
 */
const KEYWORDS = new Set([
  'abstract',
  'any',
  'as',
  'asserts',
  'async',
  'await',
  'bigint',
  'boolean',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'constructor',
  'continue',
  'debugger',
  'declare',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'get',
  'global',
  'if',
  'implements',
  'import',
  'in',
  'infer',
  'instanceof',
  'interface',
  'is',
  'keyof',
  'let',
  'module',
  'namespace',
  'never',
  'new',
  'null',
  'number',
  'object',
  'of',
  'out',
  'override',
  'package',
  'private',
  'protected',
  'public',
  'readonly',
  'require',
  'return',
  'satisfies',
  'set',
  'static',
  'string',
  'super',
  'switch',
  'symbol',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'undefined',
  'unique',
  'unknown',
  'var',
  'void',
  'while',
  'with',
  'yield'
]);

/**
 * True when this file was invoked directly as the Node entrypoint.
 * @returns {boolean}
 */
function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(resolve(entry)).href;
  } catch {
    return false;
  }
}

/**
 * Parse CLI args: `[repoRoot] [--json out.json] [--max N]`.
 * @param {string[]} argv process.argv.slice(2)
 * @returns {{ repoRoot: string, jsonPath: string | null, max: number | null }}
 */
export function parseArgs(argv) {
  const args = [...argv];
  /** @type {string | null} */
  let jsonPath = null;
  /** @type {number | null} */
  let max = null;
  /** @type {string[]} */
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') {
      jsonPath = args[++i] ?? null;
      if (!jsonPath) throw new Error('usage: --json requires a path');
      continue;
    }
    if (a === '--max') {
      const raw = args[++i];
      if (raw === undefined) throw new Error('usage: --max requires a number');
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0)
        throw new Error(`--max must be a non-negative number, got ${raw}`);
      max = n;
      continue;
    }
    if (a.startsWith('-')) {
      throw new Error(`unknown flag: ${a}`);
    }
    positional.push(a);
  }

  const repoRoot = resolve(positional[0] ?? process.cwd());
  return {
    repoRoot,
    jsonPath: jsonPath ? resolve(jsonPath) : null,
    max
  };
}

/**
 * Discover app directories: immediate children of `repoRoot` that contain both
 * `package.json` and `src/`. Does not hard-code app names.
 * @param {string} repoRoot Repository root.
 * @returns {string[]} Absolute paths, sorted by directory name.
 */
export function discoverApps(repoRoot) {
  if (!existsSync(repoRoot)) return [];
  /** @type {string[]} */
  const apps = [];
  let names;
  try {
    names = readdirSync(repoRoot);
  } catch {
    return [];
  }
  for (const name of names) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const dir = join(repoRoot, name);
    let st;
    try {
      st = statSync(dir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    if (!existsSync(join(dir, 'package.json'))) continue;
    if (!existsSync(join(dir, 'src'))) continue;
    apps.push(dir);
  }
  apps.sort((a, b) => a.localeCompare(b));
  return apps;
}

/**
 * Recursively collect source files under `srcDir`.
 * Skips `node_modules`, `dist`, and test/spec files.
 * @param {string} srcDir Absolute `src` directory.
 * @returns {string[]} Absolute file paths, sorted.
 */
export function collectSrcFiles(srcDir) {
  /** @type {string[]} */
  const out = [];
  /**
   * @param {string} dir
   */
  function walk(dir) {
    let names;
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
      const p = join(dir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(p);
        continue;
      }
      const dot = name.lastIndexOf('.');
      if (dot < 0) continue;
      const ext = name.slice(dot).toLowerCase();
      if (!SRC_EXTS.has(ext)) continue;
      // Skip tests — shared fixtures are not cross-app product duplication.
      if (/\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(name)) continue;
      out.push(p);
    }
  }
  if (existsSync(srcDir)) walk(srcDir);
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

/**
 * Strip block comments (`/* ... *\/`) and full-line/trailing `//` comments
 * without treating comment markers inside string literals as real comments.
 * @param {string} source Raw file text.
 * @returns {string} Source with comments removed (structure preserved as spaces/newlines).
 */
export function stripComments(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    const next = i + 1 < n ? source[i + 1] : '';

    // Line comment
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < n && source[i] !== '\n' && source[i] !== '\r') i++;
      continue;
    }

    // Block comment
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < n) {
        if (source[i] === '*' && i + 1 < n && source[i + 1] === '/') {
          i += 2;
          break;
        }
        // Preserve newlines so line structure stays aligned for reporting.
        if (source[i] === '\n') out += '\n';
        i++;
      }
      continue;
    }

    // String / template literal — copy through, honour escapes.
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      out += ch;
      i++;
      while (i < n) {
        const c = source[i];
        out += c;
        if (c === '\\' && i + 1 < n) {
          out += source[i + 1];
          i += 2;
          continue;
        }
        if (c === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

/**
 * Normalise a single code line: collapse whitespace, keep string literals and
 * keywords, replace every other identifier with `$`.
 * @param {string} line One physical line (comments already stripped).
 * @returns {string} Normalised line, or empty string if nothing substantive remains.
 */
export function normaliseLine(line) {
  const raw = line.replace(/\s+/g, ' ').trim();
  if (!raw) return '';

  /** @type {string[]} */
  const tokens = [];
  let i = 0;
  const n = raw.length;

  while (i < n) {
    const ch = raw[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // String or template literal — keep whole literal including quotes.
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let j = i + 1;
      let lit = ch;
      while (j < n) {
        const c = raw[j];
        lit += c;
        if (c === '\\' && j + 1 < n) {
          lit += raw[j + 1];
          j += 2;
          continue;
        }
        if (c === quote) {
          j++;
          break;
        }
        j++;
      }
      tokens.push(lit);
      i = j;
      continue;
    }

    // Number (incl. simple decimals).
    if (/\d/.test(ch) || (ch === '.' && i + 1 < n && /\d/.test(raw[i + 1]))) {
      let j = i;
      while (j < n && /[\d._xXoObBnNeE+-]/.test(raw[j])) j++;
      tokens.push(raw.slice(i, j));
      i = j;
      continue;
    }

    // Identifier or keyword.
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_$]/.test(raw[j])) j++;
      const word = raw.slice(i, j);
      tokens.push(KEYWORDS.has(word) ? word : '$');
      i = j;
      continue;
    }

    // Multi-char punctuation we care about as single tokens for stability.
    if (i + 1 < n) {
      const two = raw.slice(i, i + 2);
      if (
        two === '=>' ||
        two === '==' ||
        two === '!=' ||
        two === '<=' ||
        two === '>=' ||
        two === '&&' ||
        two === '||' ||
        two === '??' ||
        two === '?.' ||
        two === '++' ||
        two === '--' ||
        two === '+=' ||
        two === '-=' ||
        two === '*=' ||
        two === '/=' ||
        two === '**' ||
        two === '<<' ||
        two === '>>'
      ) {
        tokens.push(two);
        i += 2;
        continue;
      }
    }
    if (i + 2 < n) {
      const three = raw.slice(i, i + 3);
      if (three === '===' || three === '!==' || three === '>>>' || three === '...') {
        tokens.push(three);
        i += 3;
        continue;
      }
    }

    tokens.push(ch);
    i++;
  }

  return tokens.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Normalise a whole source file into substantive structural lines.
 * Drops empty lines and import-only lines (framework-mandated wiring, not logic).
 * @param {string} source Raw file text.
 * @returns {string[]} Normalised lines.
 */
export function normaliseSource(source) {
  const stripped = stripComments(source.replace(/\r\n/g, '\n').replace(/\r/g, '\n'));
  // Imports are wiring, not duplicated product logic. Dropping only lines that
  // START with `import` missed the body of a multi-line one, so two sibling
  // components importing from the same './styles' matched on
  //   `$ ,` `$ ,` `$ ,` `} from './styles' ;`
  // and the module specifier — a real string literal — made the block look
  // substantive. Whole statements go, not just their first line.
  const withoutImports = stripped.replace(
    /^[ \t]*(?:import|export)\b[^;'"`]*?from[ \t]*['"`][^'"`]*['"`][ \t]*;?[ \t]*$/gms,
    ''
  );
  /** @type {string[]} */
  const lines = [];
  for (const physical of withoutImports.split('\n')) {
    const norm = normaliseLine(physical);
    if (!norm) continue;
    if (/^import\b/.test(norm)) continue;
    lines.push(norm);
  }
  return lines;
}

/**
 * True when a normalised line looks like an object/style property
 * (`$ : value` or `$ : value ,`). Pure style-property runs are consistent
 * token usage across components, not harmful product-logic duplication — the
 * same carve-out `hyg-no-duplication` uses.
 * @param {string} line Normalised line.
 * @returns {boolean}
 */
export function isStylePropLine(line) {
  // `$ : ...` after identifier normalisation of `key: value,`
  return /^\$\s*:\s*.+$/.test(line);
}

/**
 * True when a normalised line is low-substance boilerplate around style
 * objects: property lines, brace-only lines, or `const $ : $ = {` wrappers.
 * @param {string} line Normalised line.
 * @returns {boolean}
 */
export function isLowSubstanceLine(line) {
  if (isStylePropLine(line)) return true;
  const compact = line.replace(/\s+/g, '');
  if (/^[{}();,]+$/.test(compact)) return true;
  if (/^(export\s+)?(const|let|var)\s+\$\s*(:\s*\$\s*)?=\s*\{$/.test(line)) return true;
  return false;
}

/**
 * Keywords that only ever describe a declaration's shape. A line built purely
 * from these, `$`, literals-free punctuation and type punctuation carries no
 * evidence of copy-paste: every React component in the repo has the same one.
 */
const DECLARATION_KEYWORDS = new Set([
  'export',
  'import',
  'from',
  'default',
  'function',
  'const',
  'let',
  'var',
  'class',
  'interface',
  'type',
  'enum',
  'extends',
  'implements',
  'readonly',
  'public',
  'private',
  'protected',
  'static',
  'declare',
  'async',
  'void',
  'string',
  'number',
  'boolean',
  'unknown',
  'any',
  'never',
  'null',
  'undefined',
  'this'
]);

/**
 * True when a normalised line is nothing but declaration scaffolding.
 *
 * Identifier normalisation is lossy on purpose — it is what lets the pass see a
 * renamed copy — but it also flattens `interface Props { onClose: () => void }`
 * plus `export function Header({ a, b, c }: Props): JSX.Element {` into pure
 * punctuation. Every component file in both apps matches that, so it was being
 * counted as duplication in the cross-app total. Real duplicated logic keeps a
 * literal or a control-flow keyword; a declaration skeleton keeps neither.
 *
 * @param {string} line Normalised line.
 * @returns {boolean}
 */
export function isDeclarationSkeleton(line) {
  const words = line.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  if (/['"`]/.test(line)) return false; // a string literal is real content
  if (/\b\d/.test(line)) return false; // so is a numeric literal
  return words.every((w) => DECLARATION_KEYWORDS.has(w));
}

/**
 * Whether a block is mostly style/low-substance lines, or is nothing but
 * declaration scaffolding (skip as non-product in both cases).
 * @param {string[]} lines Slice of normalised lines in the block.
 * @returns {boolean}
 */
export function isMostlyStyleProps(lines) {
  if (lines.length === 0) return false;
  const low = lines.filter(isLowSubstanceLine).length;
  if (low / lines.length > 0.6) return true;
  const substantive = lines.filter(
    (l) => !isLowSubstanceLine(l) && !isDeclarationSkeleton(l)
  ).length;
  // Fewer than two lines of real content is a shape, not a copy.
  return substantive < 2;
}

/**
 * Find runs of >= `minBlock` equal consecutive normalised lines between two
 * line arrays. Uses a sliding window so a long style-heavy maximal run can
 * still yield a substantive sub-block. Windows that are mostly style-property
 * lines are skipped (same carve-out as `hyg-no-duplication`). Overlapping
 * windows on the same diagonal are merged into one block.
 * @param {string[]} linesA Normalised lines from file A.
 * @param {string[]} linesB Normalised lines from file B.
 * @param {number} [minBlock=MIN_BLOCK] Minimum run length.
 * @returns {{ aStart: number, bStart: number, length: number }[]}
 */
export function findDuplicatedBlocks(linesA, linesB, minBlock = MIN_BLOCK) {
  /** @type {{ aStart: number, bStart: number, endA: number }[]} */
  const windows = [];
  for (let i = 0; i <= linesA.length - minBlock; i++) {
    for (let j = 0; j <= linesB.length - minBlock; j++) {
      let match = true;
      for (let t = 0; t < minBlock; t++) {
        if (linesA[i + t] !== linesB[j + t]) {
          match = false;
          break;
        }
      }
      if (!match) continue;
      if (isMostlyStyleProps(linesA.slice(i, i + minBlock))) continue;
      windows.push({ aStart: i, bStart: j, endA: i + minBlock });
    }
  }

  windows.sort((x, y) => x.aStart - x.bStart - (y.aStart - y.bStart) || x.aStart - y.aStart);

  /** @type {{ aStart: number, bStart: number, length: number }[]} */
  const blocks = [];
  for (const w of windows) {
    const diag = w.aStart - w.bStart;
    const last = blocks[blocks.length - 1];
    if (last && last.aStart - last.bStart === diag && w.aStart <= last.aStart + last.length) {
      const newEnd = Math.max(last.aStart + last.length, w.endA);
      last.length = newEnd - last.aStart;
    } else {
      blocks.push({
        aStart: w.aStart,
        bStart: w.bStart,
        length: w.endA - w.aStart
      });
    }
  }
  return blocks;
}

/**
 * Compare two absolute files; return duplicated line count and blocks, or null
 * when nothing meets the threshold.
 * @param {string} pathA Absolute path A.
 * @param {string} pathB Absolute path B.
 * @param {number} [minBlock=MIN_BLOCK]
 * @returns {{ duplicatedLines: number, blocks: { aStart: number, bStart: number, length: number }[] } | null}
 */
export function compareFiles(pathA, pathB, minBlock = MIN_BLOCK) {
  let textA;
  let textB;
  try {
    textA = readFileSync(pathA, 'utf8');
    textB = readFileSync(pathB, 'utf8');
  } catch {
    return null;
  }
  const linesA = normaliseSource(textA);
  const linesB = normaliseSource(textB);
  if (linesA.length < minBlock || linesB.length < minBlock) return null;
  const blocks = findDuplicatedBlocks(linesA, linesB, minBlock);
  if (blocks.length === 0) return null;
  // Sum of maximal-run lengths. Same A-line matching two B regions counts twice
  // on purpose: more clone instances are worse for a growth ratchet.
  const duplicatedLines = blocks.reduce((sum, b) => sum + b.length, 0);
  return { duplicatedLines, blocks };
}

/**
 * Compare every src file in appA against every src file in appB.
 * @param {string} appA Absolute app directory.
 * @param {string} appB Absolute app directory.
 * @param {string} repoRoot Repo root for relative paths in the report.
 * @param {number} [minBlock=MIN_BLOCK]
 * @returns {{ a: string, b: string, duplicatedLines: number, blocks: { aStart: number, bStart: number, length: number }[] }[]}
 */
export function compareAppPair(appA, appB, repoRoot, minBlock = MIN_BLOCK) {
  const filesA = collectSrcFiles(join(appA, 'src'));
  const filesB = collectSrcFiles(join(appB, 'src'));
  /** @type {{ a: string, b: string, duplicatedLines: number, blocks: { aStart: number, bStart: number, length: number }[] }[]} */
  const pairs = [];
  for (const fa of filesA) {
    for (const fb of filesB) {
      const result = compareFiles(fa, fb, minBlock);
      if (!result) continue;
      pairs.push({
        a: relative(repoRoot, fa).replace(/\\/g, '/'),
        b: relative(repoRoot, fb).replace(/\\/g, '/'),
        duplicatedLines: result.duplicatedLines,
        blocks: result.blocks
      });
    }
  }
  pairs.sort((x, y) => y.duplicatedLines - x.duplicatedLines || x.a.localeCompare(y.a));
  return pairs;
}

/**
 * Run the full cross-app scan.
 * @param {string} repoRoot Repository root.
 * @param {{ budget?: number, minBlock?: number }} [opts]
 * @returns {{
 *   checkedAt: string,
 *   pairs: { a: string, b: string, duplicatedLines: number, blocks: { aStart: number, bStart: number, length: number }[] }[],
 *   totalDuplicatedLines: number,
 *   budget: number,
 *   ok: boolean,
 *   apps: string[]
 * }}
 */
export function runCrossAppDuplication(repoRoot, opts = {}) {
  const budget = opts.budget ?? DEFAULT_BUDGET;
  const minBlock = opts.minBlock ?? MIN_BLOCK;
  const apps = discoverApps(repoRoot);
  /** @type {{ a: string, b: string, duplicatedLines: number, blocks: { aStart: number, bStart: number, length: number }[] }[]} */
  const pairs = [];

  for (let i = 0; i < apps.length; i++) {
    for (let j = i + 1; j < apps.length; j++) {
      pairs.push(...compareAppPair(apps[i], apps[j], repoRoot, minBlock));
    }
  }

  pairs.sort((x, y) => y.duplicatedLines - x.duplicatedLines || x.a.localeCompare(y.a));
  const totalDuplicatedLines = pairs.reduce((sum, p) => sum + p.duplicatedLines, 0);
  const ok = totalDuplicatedLines <= budget;

  return {
    checkedAt: new Date().toISOString(),
    pairs,
    totalDuplicatedLines,
    budget,
    ok,
    apps: apps.map((a) => relative(repoRoot, a).replace(/\\/g, '/') || a)
  };
}

/**
 * Format a human-readable summary (worst offenders + budget headroom).
 * @param {ReturnType<typeof runCrossAppDuplication>} report
 * @param {number} [topN=15] How many file pairs to list.
 * @returns {string}
 */
export function formatReport(report, topN = 15) {
  const lines = [];
  lines.push('cross-app duplication (normalised blocks >= 8 lines)');
  lines.push(`apps: ${report.apps.length ? report.apps.join(', ') : '(none)'}`);
  lines.push(`total duplicated lines: ${report.totalDuplicatedLines}`);
  lines.push(`budget: ${report.budget} (ratchet to lower — not a target)`);
  const headroom = report.budget - report.totalDuplicatedLines;
  if (headroom >= 0) {
    lines.push(`headroom: ${headroom} line(s) before the budget fails`);
  } else {
    lines.push(`OVER BUDGET by ${-headroom} line(s)`);
  }
  lines.push('');
  if (report.pairs.length === 0) {
    lines.push('no duplicated blocks found');
  } else {
    lines.push('worst offenders:');
    const show = report.pairs.slice(0, topN);
    for (const p of show) {
      const blockNote =
        p.blocks.length === 1
          ? `1 block @${p.blocks[0].length}`
          : `${p.blocks.length} blocks (max ${Math.max(...p.blocks.map((b) => b.length))})`;
      lines.push(
        `  ${p.duplicatedLines.toString().padStart(5)}  ${p.a}  ↔  ${p.b}  (${blockNote})`
      );
    }
    if (report.pairs.length > topN) {
      lines.push(`  ... and ${report.pairs.length - topN} more file pair(s)`);
    }
  }
  lines.push('');
  lines.push(
    report.ok
      ? `PASS  cross-app-duplication (${report.totalDuplicatedLines} <= ${report.budget})`
      : `FAIL  cross-app-duplication (${report.totalDuplicatedLines} > ${report.budget})`
  );
  return lines.join('\n');
}

/**
 * Build the machine-readable evidence payload (same shape other scripts use).
 * @param {ReturnType<typeof runCrossAppDuplication>} report
 * @returns {{
 *   checkedAt: string,
 *   pairs: { a: string, b: string, duplicatedLines: number, blocks: { aStart: number, bStart: number, length: number }[] }[],
 *   totalDuplicatedLines: number,
 *   budget: number,
 *   ok: boolean
 * }}
 */
export function toJsonReport(report) {
  return {
    checkedAt: report.checkedAt,
    pairs: report.pairs,
    totalDuplicatedLines: report.totalDuplicatedLines,
    budget: report.budget,
    ok: report.ok
  };
}

/**
 * CLI entry: scan, print, optional JSON, exit 0/1 by budget.
 * @param {string[]} argv process.argv.slice(2)
 * @returns {number} Exit code.
 */
export function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    console.error('usage: node cross_app_duplication.mjs [--json out.json] [--max N] [repoRoot]');
    return 2;
  }

  const report = runCrossAppDuplication(parsed.repoRoot, {
    budget: parsed.max ?? DEFAULT_BUDGET
  });
  const text = formatReport(report);
  if (report.ok) {
    console.log(text);
  } else {
    console.error(text);
  }

  if (parsed.jsonPath) {
    mkdirSync(dirname(parsed.jsonPath), { recursive: true });
    writeFileSync(parsed.jsonPath, `${JSON.stringify(toJsonReport(report), null, 2)}\n`, 'utf8');
    console.log(`wrote ${parsed.jsonPath}`);
  }

  return report.ok ? 0 : 1;
}

if (isMainModule()) {
  process.exit(main(process.argv.slice(2)));
}
