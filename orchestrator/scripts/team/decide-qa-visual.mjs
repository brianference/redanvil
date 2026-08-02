#!/usr/bin/env node
/**
 * CLI entry for the pure QA-visual decision -- used by pytest/hypothesis so
 * both runners exercise the same code path.
 *
 * Usage:
 *   node decide-qa-visual.mjs '{"observations":[...]}'
 *   node decide-qa-visual.mjs --file path.json
 *
 * Prints JSON: { verdict, failReasons }
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Inline pure decision (mirrors src/team/qaVisual.ts decideQaVisual) so pytest
 * does not need tsx. Keep in lockstep with the TypeScript source.
 *
 * @param {Array<Record<string, unknown>>} observations
 * @returns {{ verdict: 'pass'|'fail', failReasons: string[] }}
 */
export function decideQaVisual(observations) {
  if (!observations || observations.length === 0) {
    return {
      verdict: 'fail',
      failReasons: ['no observations supplied -- missing measurement is a fail']
    };
  }
  /** @type {string[]} */
  const failReasons = [];
  for (const m of observations) {
    failReasons.push(...reasonsForObservation(/** @type {any} */ (m)));
  }
  return {
    verdict: failReasons.length === 0 ? 'pass' : 'fail',
    failReasons
  };
}

/**
 * @param {{
 *   viewportWidth: number,
 *   viewportHeight: number,
 *   primaryResultY: number | null,
 *   primaryResultHeight?: number,
 *   brandMarkHeight: number,
 *   truncatedElementCount?: number,
 *   primaryActionAboveFold: boolean,
 *   route?: string,
 *   theme?: string
 * }} m
 * @returns {string[]}
 */
function reasonsForObservation(m) {
  /** @type {string[]} */
  const reasons = [];
  const label = [
    m.route ?? 'route?',
    `${m.viewportWidth}x${m.viewportHeight}`,
    m.theme ?? 'theme?'
  ].join(' ');
  const vh = m.viewportHeight;
  const y = m.primaryResultY;
  if (y === null || y === undefined) {
    reasons.push(`${label}: primary result y is missing (fail closed)`);
  } else if (!isYInViewport(y, vh, m.primaryResultHeight ?? 0)) {
    reasons.push(
      `${label}: primary result y=${y} is outside viewport height ${vh}`
    );
  }
  if (m.primaryActionAboveFold !== true) {
    reasons.push(`${label}: primary action is not above the fold`);
  }
  const minMark = m.viewportWidth >= 1280 ? 48 : 32;
  if (!Number.isFinite(m.brandMarkHeight) || m.brandMarkHeight < minMark) {
    reasons.push(
      `${label}: brand-mark height ${m.brandMarkHeight}px is below floor ${minMark}px`
    );
  }
  if ((m.truncatedElementCount ?? 0) > 0) {
    reasons.push(
      `${label}: ${m.truncatedElementCount} truncated/placeholder element(s) visible`
    );
  }
  return reasons;
}

/**
 * @param {number} y
 * @param {number} viewportHeight
 * @param {number} [elementHeight]
 * @returns {boolean}
 */
function isYInViewport(y, viewportHeight, elementHeight = 0) {
  if (!Number.isFinite(y) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return false;
  }
  const bottom = y + Math.max(0, elementHeight);
  if (y >= viewportHeight) return false;
  if (bottom <= 0) return false;
  return true;
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  let raw;
  if (process.argv[2] === '--file') {
    raw = readFileSync(process.argv[3], 'utf8');
  } else if (process.argv[2]) {
    raw = process.argv[2];
  } else {
    raw = readFileSync(0, 'utf8');
  }
  const input = JSON.parse(raw);
  const observations = Array.isArray(input) ? input : input.observations;
  const result = decideQaVisual(observations);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(result.verdict === 'pass' ? 0 : 1);
}
