#!/usr/bin/env node
/**
 * Auto-resolve a design gate when the run is unattended.
 *
 * This is OPT-IN (the generator only wires it when REDANVIL_AUTO_GATES is set).
 * It enumerates real candidates from disk, picks deterministically, and records
 * both the pick AND the alternatives not taken. It will not invent a candidate,
 * will not create a missing DECISION.md, and will not overwrite an owner's
 * already-recorded choice.
 *
 * Usage: node n8n-prototype/roles/auto-decide.mjs --axis=logo --slug=X --repoRoot=Y
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Parse `--key=value` arguments the same way decide.mjs does.
 * @param {string[]} argv raw process arguments
 * @returns {Record<string, string>} parsed flags
 */
function parseArgs(argv) {
  return Object.fromEntries(
    argv.flatMap((a) => {
      const m = /^--([^=]+)=([\s\S]*)$/.exec(a);
      return m ? [[m[1], m[2]]] : [];
    })
  );
}

/**
 * Axis table. Paths and tokens match decide.mjs / process-map.mjs -- not invented.
 * @typedef {{ file: string, token: string, dir: string }} AxisSpec
 * @type {Record<string, AxisSpec>}
 */
const AXES = {
  logo: { file: 'design-refs/logos/DECISION.md', token: 'CHOSEN', dir: 'design-refs/logos' },
  palette: {
    file: 'design-refs/palettes/DECISION.md',
    token: 'CHOSEN',
    dir: 'design-refs/palettes'
  },
  layout: {
    file: 'design-refs/design-options/DECISION.md',
    token: 'DECIDED',
    dir: 'design-refs/design-options'
  }
};

/**
 * @typedef {{ id: string, fileName: string | null }} Candidate
 */

/**
 * File names in a directory, empty when the directory is absent.
 * @param {string} dir directory to list
 * @returns {string[]} file names, not paths
 */
function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);
}

/**
 * Escape a string for use inside a RegExp.
 * @param {string} value raw string
 * @returns {string} escaped
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Logo candidates: every `*.png` in the logos directory. Id is the basename.
 * @param {string} dir design-refs/logos
 * @returns {Candidate[]}
 */
function enumerateLogo(dir) {
  return listFiles(dir)
    .filter((f) => /\.png$/i.test(f))
    .sort()
    .map((fileName) => ({ id: fileName.replace(/\.png$/i, ''), fileName }));
}

/**
 * Palette candidates: ids that literally occur in gallery.html, never a hardcoded list.
 * @param {string} dir design-refs/palettes
 * @returns {Candidate[]}
 */
function enumeratePalette(dir) {
  const gallery = join(dir, 'gallery.html');
  if (!existsSync(gallery)) return [];
  const html = readFileSync(gallery, 'utf8');
  const ids = new Set();
  for (const m of html.matchAll(/palette-\d+/gi)) ids.add(m[0]);
  return [...ids].sort().map((id) => ({ id, fileName: null }));
}

/**
 * Layout candidates: every `*.html` in design-options except gallery.html.
 * @param {string} dir design-refs/design-options
 * @returns {Candidate[]}
 */
function enumerateLayout(dir) {
  return listFiles(dir)
    .filter((f) => /\.html$/i.test(f) && f.toLowerCase() !== 'gallery.html')
    .sort()
    .map((fileName) => ({ id: fileName.replace(/\.html$/i, ''), fileName }));
}

/**
 * Enumerate real candidates for an axis from disk.
 * @param {string} axisName logo | palette | layout
 * @param {string} dir axis directory
 * @returns {Candidate[]}
 */
function enumerateCandidates(axisName, dir) {
  if (axisName === 'logo') return enumerateLogo(dir);
  if (axisName === 'palette') return enumeratePalette(dir);
  return enumerateLayout(dir);
}

/**
 * Whether DECISION.md already carries a real TOKEN: value line.
 * Same regex shape as decide.mjs: `\*{0,2}TOKEN\*{0,2}\s*:\s*\S+`
 * @param {string} text DECISION.md contents
 * @param {string} token CHOSEN or DECIDED
 * @returns {boolean}
 */
function hasRecordedToken(text, token) {
  const marker = new RegExp(`\\*{0,2}${token}\\*{0,2}\\s*:\\s*\\S+`, 'i');
  return text.split('\n').some((l) => marker.test(l));
}

/**
 * Pick a candidate deterministically. A recommendation/suggestion/strongest/lead
 * line that names an enumerated id wins; otherwise the first id in sorted order.
 * No randomness and no time-derived choice.
 * @param {string} text DECISION.md contents
 * @param {string[]} ids enumerated candidate ids, already sorted
 * @returns {{ id: string, reason: string }}
 */
function pickCandidate(text, ids) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!/recommend|suggest|strongest|lead/i.test(line)) continue;
    let best = /** @type {string | null} */ (null);
    let bestAt = Infinity;
    for (const id of ids) {
      const m = new RegExp(`\\b${escapeRegExp(id)}\\b`, 'i').exec(line);
      if (m && m.index < bestAt) {
        bestAt = m.index;
        best = id;
      }
    }
    if (best) return { id: best, reason: 'recommendation line' };
  }
  return { id: ids[0], reason: 'first in sorted order' };
}

/**
 * Append the auto-resolved block. Never rewrite the existing document.
 * @param {string} decisionPath DECISION.md
 * @param {string} token CHOSEN or DECIDED
 * @param {string} chosenId picked id
 * @param {string} why recommendation line, or first in sorted order
 * @param {string[]} alternatives ids not taken
 * @param {string} axisName logo | palette | layout
 * @param {string} resolvedAt ISO timestamp
 */
function appendDecision(decisionPath, token, chosenId, why, alternatives, axisName, resolvedAt) {
  const prev = readFileSync(decisionPath, 'utf8');
  const sep = prev.endsWith('\n') ? '' : '\n';
  const block =
    `${sep}\n` +
    `## AUTO-RESOLVED ${resolvedAt} -- pending owner review\n` +
    `\n` +
    `${token}: ${chosenId}\n` +
    `\n` +
    `Resolved without an owner because the run was unattended. This is a\n` +
    `provisional pick, not a preference.\n` +
    `\n` +
    `- Chosen: ${chosenId} -- ${why}\n` +
    `- Alternatives not taken: ${alternatives.join(', ')}\n` +
    `- To override: re-run the \`${axisName}\` step and record a real choice.\n`;
  writeFileSync(decisionPath, prev + block);
}

/**
 * Copy the chosen mark to `<slug>/public/brand-mark.png`.
 *
 * Same mkdir + copyFileSync as the provisional path in design-role.mjs
 * (around the `public/brand-mark.png` copy). That module cannot be imported:
 * loading it would spawn grok. This overwrites so the shipped file matches
 * THIS pick, not an earlier provisional copy of a different mark.
 * @param {string} appDir app root
 * @param {string} marksDir design-refs/logos
 * @param {string} fileName chosen png filename
 */
function copyChosenMark(appDir, marksDir, fileName) {
  const publicDir = join(appDir, 'public');
  mkdirSync(publicDir, { recursive: true });
  copyFileSync(join(marksDir, fileName), join(publicDir, 'brand-mark.png'));
}

/**
 * Merge this axis into evidence/auto-gate-decisions.json so three axes accumulate.
 * @param {string} appDir app root
 * @param {string} axisName logo | palette | layout
 * @param {{ chosen: string, alternatives: string[], reason: string, resolvedAt: string, provisional: true }} record
 */
function writeEvidence(appDir, axisName, record) {
  const evidenceDir = join(appDir, 'evidence');
  const path = join(evidenceDir, 'auto-gate-decisions.json');
  /** @type {Record<string, object>} */
  let existing = {};
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) existing = parsed;
    } catch {
      existing = {};
    }
  }
  existing[axisName] = record;
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(path, JSON.stringify(existing, null, 2) + '\n');
}

const args = parseArgs(process.argv.slice(2));
if (!args.slug || !args.axis || !AXES[args.axis]) {
  process.stderr.write(
    'usage: auto-decide.mjs --axis=logo|palette|layout --slug=X [--repoRoot=.]\n'
  );
  process.exit(2);
}

const axisName = args.axis;
const axis = AXES[axisName];
const appDir = join(resolve(args.repoRoot ?? process.cwd()), args.slug);
const candidateDir = join(appDir, axis.dir);
const decisionPath = join(appDir, axis.file);

const candidates = enumerateCandidates(axisName, candidateDir);
if (candidates.length === 0) {
  process.stderr.write(`auto-decide: no candidates in ${candidateDir}\n`);
  process.exit(1);
}

if (!existsSync(decisionPath)) {
  process.stderr.write(`auto-decide: no ${axis.file} -- will not create one\n`);
  process.exit(1);
}

const text = readFileSync(decisionPath, 'utf8');
if (hasRecordedToken(text, axis.token)) {
  console.log(`auto-decide: ${axisName} already decided -- leaving ${axis.file} unchanged`);
  process.exit(0);
}

const ids = candidates.map((c) => c.id);
const picked = pickCandidate(text, ids);
const alternatives = ids.filter((id) => id !== picked.id);
const resolvedAt = new Date().toISOString();

appendDecision(
  decisionPath,
  axis.token,
  picked.id,
  picked.reason,
  alternatives,
  axisName,
  resolvedAt
);

if (axisName === 'logo') {
  const chosen = candidates.find((c) => c.id === picked.id);
  if (!chosen?.fileName) {
    process.stderr.write(`auto-decide: chosen ${picked.id} has no file on disk\n`);
    process.exit(1);
  }
  copyChosenMark(appDir, candidateDir, chosen.fileName);
}

writeEvidence(appDir, axisName, {
  chosen: picked.id,
  alternatives,
  reason: picked.reason,
  resolvedAt,
  provisional: true
});

console.log(`auto-decide: ${axisName} -> ${picked.id} (${picked.reason})`);
