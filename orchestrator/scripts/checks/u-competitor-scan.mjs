#!/usr/bin/env node
/**
 * u-competitor-scan — the competitor study was actually completed (R31).
 *
 * Usage: node u-competitor-scan.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = not applicable.
 *
 * Why this exists: `COMPETITORS.md` was generated with real scraped section
 * structure from Southwest and Kayak, and an `## Assessment` body reading
 * "Fill this in." It shipped that way. Nobody noticed, because the file existed,
 * was long, and contained genuine competitor data — every signal a presence
 * check looks at was green.
 *
 * The consequence was not cosmetic. The assessment is the step that turns a
 * scrape into a work list, so with it unwritten the app shipped without airline
 * filtering, a maximum-price filter, nearby-airport search or flexible dates —
 * four controls every competitor ships. The user found them missing, not the gate.
 *
 * So this checks the CONCLUSIONS, not the evidence. A scrape nobody drew a
 * conclusion from is the same as no scrape.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Sections the assessment must actually answer. */
const REQUIRED_SECTIONS = [
  { re: /###\s*Features and controls we are missing/i, name: 'Features and controls we are missing' },
  { re: /###\s*Components worth borrowing/i, name: 'Components worth borrowing' },
  { re: /###\s*What we deliberately will not do/i, name: 'What we deliberately will not do' }
];

/**
 * Template text the generator leaves for a human to replace.
 *
 * "Fill this in." is first because it is the one that shipped.
 */
const UNFILLED = [
  /^\s*Fill this in\.?\s*$/im,
  /^\s*List what their PRODUCT screen has/im,
  /^\s*Section count, table of contents/im,
  /^\s*Name each one and say how you will change/im,
  /^\s*And why\.?\s*$/im,
  /\bTBD\b|\bTODO\b/
];

/** Prose length below which a section cannot have said anything. */
const MIN_SECTION_CHARS = 220;

/**
 * Body text of the section starting at `re`, up to the next heading of the same
 * or higher level.
 */
function sectionBody(doc, re) {
  const start = doc.search(re);
  if (start === -1) return null;
  const after = doc.slice(start);
  const nextHeading = after.slice(1).search(/\n##+\s/);
  return nextHeading === -1 ? after : after.slice(0, nextHeading + 1);
}

/**
 * Run the check.
 *
 * @param {string} appDir App directory.
 * @param {{pass:()=>never, fail:(m?:string)=>never, notApplicable:(w?:string)=>never}} io
 */
export function runCompetitorScan(appDir, io) {
  const path = join(appDir, 'COMPETITORS.md');
  if (!existsSync(path)) {
    io.notApplicable('no COMPETITORS.md; R31 applies once a competitor scan has been run');
  }

  const doc = readFileSync(path, 'utf8');

  if (!/##\s*Assessment/i.test(doc)) {
    io.fail(
      'COMPETITORS.md has no "## Assessment" section — a scrape of competitor pages is ' +
        'evidence, not a conclusion. Say what they ship that we do not (R31).'
    );
  }

  const stub = UNFILLED.find((re) => re.test(doc));
  if (stub !== undefined) {
    io.fail(
      'COMPETITORS.md still contains generator template text — the assessment was never ' +
        'written. This exact stub ("Fill this in.") shipped once and cost four filters ' +
        'every competitor ships. Complete it (R31).'
    );
  }

  const missing = REQUIRED_SECTIONS.filter(({ re }) => !re.test(doc)).map(({ name }) => name);
  if (missing.length > 0) {
    io.fail(`COMPETITORS.md is missing required section(s): ${missing.join(', ')} (R31)`);
  }

  const thin = REQUIRED_SECTIONS.map(({ re, name }) => ({
    name,
    chars: (sectionBody(doc, re) ?? '').trim().length
  })).filter(({ chars }) => chars < MIN_SECTION_CHARS);

  if (thin.length > 0) {
    io.fail(
      `section(s) too thin to be a real finding: ${thin
        .map(({ name, chars }) => `${name} (${chars} chars)`)
        .join(', ')} (R31)`
    );
  }

  // The missing-features section is the work list. If it names nothing concrete,
  // the study concluded "we are already fine", which is almost never true and
  // must at least be stated deliberately rather than by omission.
  const missingBody = sectionBody(doc, REQUIRED_SECTIONS[0].re) ?? '';
  if (!/\|/.test(missingBody) && !/^\s*[-*]\s+\S/m.test(missingBody)) {
    io.fail(
      'the "Features and controls we are missing" section lists no items — name each ' +
        'missing control in a table or list, or the study produced no work (R31)'
    );
  }

  io.pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node u-competitor-scan.mjs <appDir>');
    process.exit(2);
  }
  runCompetitorScan(dir, {
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
