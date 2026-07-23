#!/usr/bin/env node
/**
 * Build `results/all.json` — the feed the public dashboard fetches — from the
 * per-run result files that the gate actually wrote.
 *
 * Usage:
 *   node .github/scripts/build_feed.mjs            # write the feed
 *   node .github/scripts/build_feed.mjs --check    # fail if the committed feed differs
 *
 * The dashboard reads this file directly from raw.githubusercontent, but nothing
 * generated it and CI verified only `results/app-builder.json`. So the one
 * artifact CI reproduced rule-by-rule was not the artifact the public site
 * displayed: hand-editing the feed changed every number on the dashboard and no
 * check fired. Deriving it, and diffing it in CI, closes that.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RESULTS_DIR = 'results';
const FEED = join(RESULTS_DIR, 'all.json');
const checkOnly = process.argv.includes('--check');

/** Per-run result files, i.e. everything in results/ except the feed itself. */
function runFiles() {
  return readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'all.json' && !f.endsWith('.verify.json'))
    .sort()
    .map((f) => join(RESULTS_DIR, f));
}

const runs = [];
for (const file of runFiles()) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`FEED BUILD FAILED: ${file} is not valid JSON: ${err.message}`);
    process.exit(1);
  }
  if (parsed.kind !== 'results') {
    console.error(`FEED BUILD FAILED: ${file} is not a results payload (kind=${parsed.kind}).`);
    process.exit(1);
  }
  if (!parsed.provenance) {
    console.error(`FEED BUILD FAILED: ${file} has no provenance — it cannot be published.`);
    process.exit(1);
  }
  runs.push(parsed);
}

if (runs.length === 0) {
  console.error('FEED BUILD FAILED: no result files found in results/.');
  process.exit(1);
}

// Newest first, so the dashboard's most recent run leads.
runs.sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)));

const rendered = JSON.stringify(runs, null, 2) + '\n';

if (checkOnly) {
  let committed;
  try {
    committed = readFileSync(FEED, 'utf8');
  } catch {
    console.error(
      `FEED CHECK FAILED: ${FEED} is missing. Run: node .github/scripts/build_feed.mjs`
    );
    process.exit(1);
  }
  if (committed.replace(/\r\n/g, '\n') !== rendered) {
    console.error(
      `FEED CHECK FAILED: ${FEED} does not match the per-run result files.\n` +
        `  The dashboard reads this file, so a hand-edit would change every number it shows.\n` +
        `  Fix: node .github/scripts/build_feed.mjs`
    );
    process.exit(1);
  }
  console.log(`feed matches ${runs.length} result file(s)`);
  process.exit(0);
}

writeFileSync(FEED, rendered);
console.log(`wrote ${FEED} from ${runs.length} result file(s)`);
