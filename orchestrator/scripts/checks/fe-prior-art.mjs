#!/usr/bin/env node
/**
 * fe-prior-art — SOURCES.md, INTEGRATIONS.md and COMPETITORS.md must exist and
 * must not still contain the scaffold/generator unwritten marker.
 *
 * Usage: node fe-prior-art.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = not applicable (no app frontend surface).
 *
 * Why: §7.3a and the prior-art skill require three artifacts before code
 * (R23/R29/R31). They lived only as prose, so an app could ship with no
 * SOURCES.md / INTEGRATIONS.md / COMPETITORS.md and still clear 90+. A missing
 * file means the step did not run; a file that still says "Fill this in." means
 * the step started and was abandoned (the exact COMPETITORS.md failure that
 * shipped four missing competitor filters).
 *
 * FAILS when any of the three files is missing, or when any still contains the
 * generator's unwritten-document marker.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Required prior-art artifacts at the app root. */
export const PRIOR_ART_FILES = ['SOURCES.md', 'INTEGRATIONS.md', 'COMPETITORS.md'];

/**
 * Scaffold / generator unwritten markers left for a human to replace.
 * "Fill this in." is first because it is the one that shipped in COMPETITORS.md.
 */
export const UNWRITTEN_MARKERS = [
  /^\s*Fill this in\.?\s*$/im,
  /Fill this in\s*[—–-]/i,
  /\*\*Build \/ integrate \/ hybrid:\*\*\s*…/,
  /\*\*Why:\*\*\s*…/,
  /\*\*Revisit when:\*\*\s*…/,
  /\[UNWRITTEN[^\]]*\]/i,
  /THIS DOCUMENT HAS NOT BEEN WRITTEN/i,
  /unwritten-document marker/i
];

/**
 * Whether the app has a frontend surface worth requiring prior-art for.
 *
 * @param {string} appDir App root.
 * @returns {boolean}
 */
function hasFrontendSurface(appDir) {
  for (const name of ['src', 'public', 'index.html', 'package.json']) {
    if (existsSync(join(appDir, name))) return true;
  }
  return false;
}

/**
 * Detect the first unwritten marker in a document.
 *
 * @param {string} doc File contents.
 * @returns {string | null} Description of the marker, or null if clean.
 */
export function findUnwrittenMarker(doc) {
  for (const re of UNWRITTEN_MARKERS) {
    if (re.test(doc)) {
      return re.source.slice(0, 60);
    }
  }
  return null;
}

/**
 * Run the check.
 *
 * @param {string} appDir App directory.
 * @param {{pass:()=>never, fail:(m?:string)=>never, notApplicable:(w?:string)=>never}} io
 */
export function runPriorArt(appDir, io) {
  if (!hasFrontendSurface(appDir)) {
    io.notApplicable('no frontend surface (src/public/index.html) to require prior-art for');
  }

  // A pure backend package with no pages is not this rule's target, but if the
  // directory is empty of everything, n/a rather than inventing a pass.
  try {
    if (statSync(appDir).isDirectory() && readdirSync(appDir).length === 0) {
      io.notApplicable('empty app directory');
    }
  } catch {
    io.notApplicable('app directory unreadable');
  }

  const failures = [];

  for (const name of PRIOR_ART_FILES) {
    const path = join(appDir, name);
    if (!existsSync(path)) {
      failures.push(
        `missing ${name} — prior-art step did not run (R23/R29/R31; §7.3a). ` +
          'A missing file means the step did not run.'
      );
      continue;
    }
    const doc = readFileSync(path, 'utf8');
    if (doc.trim().length < 40) {
      failures.push(
        `${name} exists but is empty or near-empty (${doc.trim().length} chars) — ` +
          'not a completed prior-art artifact'
      );
      continue;
    }
    const marker = findUnwrittenMarker(doc);
    if (marker) {
      failures.push(
        `${name} still contains the scaffold/generator unwritten marker ` +
          `(/${marker}/) — the assessment was never written. Complete it before shipping.`
      );
    }
  }

  if (failures.length > 0) {
    io.fail(failures.join('\n'));
  }

  console.log('SOURCES.md, INTEGRATIONS.md and COMPETITORS.md present without unwritten markers');
  io.pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node fe-prior-art.mjs <appDir>');
    process.exit(2);
  }
  runPriorArt(dir, {
    pass: () => process.exit(0),
    fail: (m) => {
      if (m) console.error(m);
      process.exit(1);
    },
    notApplicable: (w) => {
      if (w) console.error(`n/a: ${w}`);
      process.exit(3);
    }
  });
}
