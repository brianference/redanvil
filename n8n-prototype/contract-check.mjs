#!/usr/bin/env node
/**
 * Evaluate the artifact contract for one process step, or for the whole map.
 *
 * The rule this enforces: a step is NOT done because it ran. It is done when the
 * artifacts it promised exist, carry substance, and satisfy their assertions.
 * An unrecorded or unreadable outcome is FAILED -- never "probably fine".
 *
 * And ordering: a step whose dependencies are not DONE cannot start. A gate can
 * only refuse what was built; it cannot ask for what was never started. That is
 * why the logo role could be skipped while the gate still reported 100/100.
 *
 * Exit 0 only when every requested step passes.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { orderedSteps, PROCESS } from './process-map.mjs';

/**
 * @typedef {object} ContractResult
 * @property {string} path
 * @property {boolean} ok
 * @property {string[]} reasons
 */

/** A sha256 hex digest, used to tell a real evidence record from a list of names. */
const SHA256_HEX = /^[a-f0-9]{64}$/i;

/**
 * Verify an evidence manifest records enough DISTINCT content hashes.
 *
 * A manifest of filenames proves nothing -- anyone can write twelve names, which
 * is the "artifact exists != work was done" trap moved up a level. Distinct
 * sha256 values cannot be produced without distinct files. Twelve identical
 * hashes means one image recorded twelve times, and that fails here.
 *
 * @param {string} full absolute path to the manifest
 * @param {import('./process-map.mjs').ArtifactContract} c the contract
 * @returns {string[]} reasons, empty when satisfied
 */
function distinctHashReasons(full, c) {
  const need = c.jsonDistinctHashes ?? 0;
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(full, 'utf8'));
  } catch (err) {
    return [`${c.path} is not parseable JSON (${String(err).slice(0, 60)}) -- ${c.why}`];
  }

  /** @type {string[]} */
  const hashes = [];
  /** @param {unknown} node */
  const walk = (node) => {
    if (typeof node === 'string') {
      if (SHA256_HEX.test(node)) hashes.push(node.toLowerCase());
      return;
    }
    if (Array.isArray(node)) {
      for (const v of node) walk(v);
      return;
    }
    if (node && typeof node === 'object') {
      for (const v of Object.values(node)) walk(v);
    }
  };
  walk(parsed);

  const distinct = new Set(hashes);
  if (distinct.size < need) {
    return [
      `${c.path} records ${distinct.size} distinct content hash(es), needs ${need}` +
        (hashes.length === 0
          ? ' -- it lists names but no hashes, which proves nothing about what was rendered'
          : '') +
        ` -- ${c.why}`
    ];
  }
  return [];
}

/**
 * Verify a results file's provenance describes THIS commit and a clean tree.
 *
 * Fail-closed on every unknown: an unreadable file, an absent provenance block,
 * or a git call that does not answer all mean FAILED. "Could not tell" must
 * never read as "fine" -- that is how stale evidence earned credit for commits
 * it never saw.
 *
 * @param {string} full absolute path to the results file
 * @param {string} appDir app directory, used to locate the repo
 * @param {import('./process-map.mjs').ArtifactContract} c the contract
 * @returns {string[]} reasons, empty when the evidence is fresh
 */
function provenanceFreshnessReasons(full, appDir, c) {
  /** @type {{provenance?: {commit?: string, dirty?: boolean}}} */
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(full, 'utf8'));
  } catch (err) {
    return [`${c.path} is not parseable JSON (${String(err).slice(0, 60)}) -- ${c.why}`];
  }

  const prov = parsed.provenance;
  if (!prov?.commit) return [`${c.path} records no provenance commit -- ${c.why}`];

  let head = '';
  try {
    head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: appDir, encoding: 'utf8' }).trim();
  } catch {
    return [`${c.path}: cannot resolve HEAD to compare provenance against -- ${c.why}`];
  }

  /** @type {string[]} */
  const reasons = [];
  if (prov.commit !== head) {
    reasons.push(
      `${c.path} provenance is commit ${prov.commit.slice(0, 12)} but HEAD is ${head.slice(0, 12)} -- ${c.why}`
    );
  }
  if (prov.dirty === true) {
    reasons.push(`${c.path} was measured against a DIRTY tree, so it describes no commit -- ${c.why}`);
  }
  return reasons;
}

/**
 * Check a single artifact contract against the app directory.
 * @param {string} appDir absolute app directory
 * @param {import('./process-map.mjs').ArtifactContract} c the contract
 * @returns {ContractResult} outcome with reasons
 */
export function checkContract(appDir, c) {
  const full = join(appDir, c.path);
  /** @type {string[]} */
  const reasons = [];

  if (!existsSync(full)) {
    reasons.push(`missing ${c.path} -- ${c.why}`);
    return { path: c.path, ok: false, reasons };
  }

  if (c.kind === 'dir') {
    if (!statSync(full).isDirectory()) {
      reasons.push(`${c.path} is not a directory`);
      return { path: c.path, ok: false, reasons };
    }
    const entries = readdirSync(full, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((n) => (c.glob ? n.toLowerCase().endsWith(c.glob) : true));
    if (c.minCount !== undefined && entries.length < c.minCount) {
      reasons.push(
        `${c.path} has ${entries.length} ${c.glob ?? 'file'}(s), needs ${c.minCount} -- ${c.why}`
      );
    }
    return { path: c.path, ok: reasons.length === 0, reasons };
  }

  const size = statSync(full).size;
  if (c.minBytes !== undefined && size < c.minBytes) {
    reasons.push(`${c.path} is ${size}B, needs ${c.minBytes}B -- ${c.why}`);
  }

  if (c.jsonDistinctHashes !== undefined) {
    reasons.push(...distinctHashReasons(full, c));
  }

  if (c.provenanceMatchesHead) {
    reasons.push(...provenanceFreshnessReasons(full, appDir, c));
  }

  // Only read text when there is something to assert about its contents.
  if (c.mustContain?.length || c.mustNotContain?.length) {
    let text = '';
    try {
      text = readFileSync(full, 'utf8');
    } catch (err) {
      reasons.push(`${c.path} unreadable as text: ${String(err)}`);
      return { path: c.path, ok: false, reasons };
    }
    // Case-insensitive, matching mustNotContain. They disagreed at first, and a
    // document whose heading read "Specifically forbidden" failed a contract
    // looking for "Forbidden".
    const haystack = text.toLowerCase();
    for (const needle of c.mustContain ?? []) {
      if (!haystack.includes(needle.toLowerCase())) {
        reasons.push(`${c.path} does not record "${needle}" -- ${c.why}`);
      }
    }
    // Strip the places where a marker is being NAMED rather than left unfilled.
    // Two real false failures came from this: a brief saying "not emoji or letter
    // placeholders", and a PRD checklist item reading
    // "- [x] No placeholder tokens (TBD/TODO/lorem) in body". A document
    // certifying it has no placeholders was failed for listing them.
    const scannable = text
      .split('\n')
      .filter((line) => !/^\s*[-*]\s*\[[ xX]\]/.test(line)) // checklist items are meta
      .join('\n')
      .replace(/`[^`\n]*`/g, '') // inline code spans quote markers, never leave them
      .replace(/\([^)\n]*\)/g, ''); // parentheticals enumerate them: "(TBD/TODO/lorem)"

    for (const bad of c.mustNotContain ?? []) {
      const pattern = new RegExp(`\\b${bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(scannable)) {
        reasons.push(`${c.path} still contains unfilled marker "${bad}" -- ${c.why}`);
      }
    }
  }

  return { path: c.path, ok: reasons.length === 0, reasons };
}

/**
 * Evaluate every step, honouring dependency order.
 * @param {string} appDir absolute app directory
 * @returns {{step: string, role: string, status: 'DONE'|'FAILED'|'BLOCKED', reasons: string[]}[]} per-step outcomes
 */
export function evaluateProcess(appDir) {
  /** @type {{step: string, role: string, status: 'DONE'|'FAILED'|'BLOCKED', reasons: string[]}[]} */
  const results = [];
  /** @type {Set<string>} */
  const doneIds = new Set();

  for (const step of orderedSteps()) {
    const blockedBy = step.dependsOn.filter((d) => !doneIds.has(d));
    if (blockedBy.length) {
      results.push({
        step: step.id,
        role: step.role,
        status: 'BLOCKED',
        reasons: [`cannot start until ${blockedBy.join(', ')} is DONE`]
      });
      continue;
    }

    const reasons = step.requires.flatMap((c) => checkContract(appDir, c).reasons);
    if (reasons.length === 0) {
      doneIds.add(step.id);
      results.push({ step: step.id, role: step.role, status: 'DONE', reasons: [] });
    } else {
      results.push({ step: step.id, role: step.role, status: 'FAILED', reasons });
    }
  }
  return results;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  const appDir = resolve(process.argv[2] ?? '.');
  const results = evaluateProcess(appDir);
  for (const r of results) {
    const mark = r.status === 'DONE' ? 'DONE   ' : r.status === 'BLOCKED' ? 'BLOCKED' : 'FAILED ';
    console.log(`${mark} ${r.step.padEnd(8)} (${r.role})`);
    for (const reason of r.reasons) console.log(`        - ${reason}`);
  }
  const bad = results.filter((r) => r.status !== 'DONE');
  console.log(
    bad.length
      ? `\n${bad.length}/${PROCESS.length} step(s) not done. The process cannot be reported complete.`
      : `\nAll ${PROCESS.length} steps done.`
  );
  process.exit(bad.length ? 1 : 0);
}
