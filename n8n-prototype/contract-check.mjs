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
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { orderedSteps, PROCESS } from './process-map.mjs';

/**
 * @typedef {object} ContractResult
 * @property {string} path
 * @property {boolean} ok
 * @property {string[]} reasons
 */

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
    for (const bad of c.mustNotContain ?? []) {
      // Whole-word match. A substring match flagged a brief that said "not emoji
      // or letter placeholders" -- a document forbidding placeholders was failed
      // for containing the word.
      const pattern = new RegExp(`\\b${bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(text)) {
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
