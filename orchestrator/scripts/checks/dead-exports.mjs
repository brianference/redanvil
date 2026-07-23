#!/usr/bin/env node
/**
 * Find exported symbols with no reference outside their own file and their own
 * test. Usage: node dead-exports.mjs <dir> [--allow a,b,c]
 *
 * Exit 0 = no dead exports, 1 = dead exports found, 2 = usage/infra error.
 *
 * This exists because `no-unused-vars` cannot see it. An exported symbol is
 * "used" as far as eslint is concerned, so two entire modules — the scoring
 * function the whole gate was supposed to run, and the autonomous build loop the
 * product is named for — sat fully unreferenced while a blocker rule named
 * "dead code" reported PASS on every run. A test importing a symbol is not a
 * caller: it proves the code works, not that anything runs it.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const args = process.argv.slice(2);
const dir = args[0];
if (!dir) {
  console.error('usage: node dead-exports.mjs <dir> [--allow a,b,c]');
  process.exit(2);
}
const allowIdx = args.indexOf('--allow');
const allowed = new Set(
  allowIdx === -1
    ? []
    : (args[allowIdx + 1] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
);

const SOURCE_EXT = new Set(['.ts', '.tsx', '.mts']);
const isTest = (f) => /\.(test|spec)\.[tj]sx?$/.test(f);

/** Recursively collect source files, skipping build output and dependencies. */
function walk(current, out = []) {
  let names;
  try {
    names = readdirSync(current);
  } catch (err) {
    console.error(`infra: cannot read ${current}: ${err instanceof Error ? err.message : err}`);
    process.exit(2);
  }
  for (const name of names) {
    if (name === 'node_modules' || name === 'dist' || name === '.git' || name === '.wrangler') {
      continue;
    }
    const p = join(current, name);
    try {
      const s = statSync(p);
      if (s.isDirectory()) walk(p, out);
      else if (SOURCE_EXT.has(extname(name))) out.push(p);
    } catch {
      continue;
    }
  }
  return out;
}

if (!existsSync(dir)) {
  console.error(`infra: no such directory: ${dir}`);
  process.exit(2);
}

const files = walk(dir);
const read = (f) => {
  try {
    return readFileSync(f, 'utf8');
  } catch {
    return '';
  }
};

/**
 * Exported symbol names declared in a file. Covers `export function|const|class|
 * interface|type|enum` and `export { a, b }`. Default exports are skipped: they
 * are referenced by an importer-chosen name and cannot be matched textually.
 */
function exportedNames(content) {
  const names = new Set();
  // Values only — `interface` and `type` are erased at compile time, so an
  // unreferenced type is unused API surface, not unreachable code. Flagging
  // them buries the signal this check exists for.
  const decl =
    /^\s*export\s+(?:async\s+)?(?:function|const|let|var|class|enum)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = decl.exec(content)) !== null) names.add(m[1]);
  const list = /^\s*export\s*\{([^}]*)\}/gm;
  while ((m = list.exec(content)) !== null) {
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  return names;
}

const contents = new Map(files.map((f) => [f, read(f)]));
const dead = [];

for (const [file, content] of contents) {
  if (isTest(file)) continue;
  const own = basename(file).replace(/\.[^.]+$/, '');
  for (const name of exportedNames(content)) {
    if (allowed.has(name)) continue;
    const ref = new RegExp(`\\b${name.replace(/[$]/g, '\\$')}\\b`);
    let referencedElsewhere = false;
    for (const [other, otherContent] of contents) {
      if (other === file) continue;
      if (isTest(other)) continue; // a test is not a caller
      if (ref.test(otherContent)) {
        referencedElsewhere = true;
        break;
      }
    }
    if (!referencedElsewhere) dead.push({ file, name, own });
  }
}

if (dead.length > 0) {
  console.error(`dead exports (no non-test reference outside their own file): ${dead.length}`);
  for (const d of dead.slice(0, 40)) console.error(`  ${d.file}: ${d.name}`);
  process.exit(1);
}
console.log(`no dead exports across ${files.length} files`);
