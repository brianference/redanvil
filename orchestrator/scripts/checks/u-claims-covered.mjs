#!/usr/bin/env node
/**
 * u-claims-covered — every capability the app claims is named by a test.
 *
 * Usage: node u-claims-covered.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = not applicable (no claims file).
 *
 * The third inversion, after controls and API routes.
 *
 * `u-test-feature-audit` takes its inventory from the RUNNING page, so a
 * control nobody thought of is untested-by-default. `u-api-real-output` takes
 * its inventory from `functions/api/**` on disk, so an endpoint nobody declared
 * is unproven-by-default. Both work because the inventory comes from the app
 * rather than from a list someone maintains.
 *
 * Neither can see a capability that was never built. A feature the PRD promised
 * and the builder skipped renders no control and serves no route, so it is
 * invisible to both — the app is simply smaller than its specification, and
 * every check agrees it is fine. That is how a product ships "flight search"
 * with a catalog of four route/date pairs: nothing compared what was built
 * against what was promised, because the promise only existed as prose.
 *
 * `.redanvil/claims.json` is that promise as data. The inventory here comes
 * from the app's own declaration, so an unimplemented claim fails loudly.
 *
 * WHAT THIS PROVES, and the limit is the point: a test NAMES the feature. It
 * does not prove the test is good, or that the feature works — `u-test-acceptance`
 * and `u-api-real-output` are the checks for that. This closes the gap where a
 * feature has no test at all, which is the one neither of them can see.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Where the app's own claims live. */
export const CLAIMS_FILE = join('.redanvil', 'claims.json');

/** Directories that may hold tests naming a feature. */
const TEST_DIRS = ['tests', 'src', 'functions'];

/** Files that are tests. */
const TEST_FILE = /\.(test|spec|cy)\.(ts|tsx|js|jsx|mjs)$/;

/**
 * Words too generic to prove a feature is covered.
 *
 * Matching a claim's whole name is too strict — a test title rarely repeats it
 * verbatim — and matching any single word is far too loose: "Browse & search
 * Flights" would be satisfied by any test containing "search". Significant
 * words are what remains after the filler, and a match needs enough of them.
 */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'the', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'by',
  'app', 'page', 'view', 'data', 'item', 'items', 'user', 'users', 'manage'
]);

/**
 * Significant lowercase words in a claim name.
 *
 * @param {string} name - Claim name.
 * @returns {string[]} Words worth matching on.
 */
export function significantWords(name) {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Whether a body of test text plausibly names a claim.
 *
 * Requires EVERY significant word to appear somewhere in the suite. That is
 * deliberately strict: a claim called "Browse & search Flights" is covered only
 * if both "browse" (or its stem) and "flights" appear, not merely "search".
 * A claim whose words are all filler cannot be matched at all, and is reported
 * as unmatchable rather than quietly passing.
 *
 * @param {string} haystack - All test text, lowercased.
 * @param {string[]} words - Significant words from the claim.
 * @returns {boolean} True when every word appears.
 */
export function claimIsNamed(haystack, words) {
  if (words.length === 0) return false;
  return words.every((w) => stems(w).some((v) => haystack.includes(v)));
}

/**
 * A word plus conservative morphological variants.
 *
 * Exact substring matching was too strict in a way a real case exposed
 * immediately: a claim named "Round trip pairing" went unmatched by a test
 * titled "a real round trip returns PAIRS whose total is out plus in". The
 * feature was covered; the check could not see it because English inflects.
 *
 * The variants are deliberately shallow - strip one common suffix, and only
 * when enough of the word survives. Aggressive stemming would make short words
 * match nearly anything, which is the failure in the opposite direction and far
 * harder to notice, because it shows up as a green check rather than a red one.
 *
 * @param {string} word - A significant word from a claim name.
 * @returns {string[]} The word and its accepted variants.
 */
export function stems(word) {
  const out = new Set([word]);
  for (const suffix of ['ing', 'ion', 'es', 'ed', 's']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 4) {
      out.add(word.slice(0, word.length - suffix.length));
    }
  }
  return [...out];
}

/**
 * Read every test file's text under an app.
 *
 * @param {string} appDir - App directory.
 * @returns {{text: string, files: number}} Concatenated lowercased text and file count.
 */
function readTestCorpus(appDir) {
  let text = '';
  let files = 0;
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = join(dir, entry.name);
      try {
        if (statSync(full).isDirectory()) walk(full);
        else if (TEST_FILE.test(entry.name)) {
          text += readFileSync(full, 'utf8').toLowerCase();
          files += 1;
        }
      } catch {
        continue;
      }
    }
  };
  for (const d of TEST_DIRS) walk(join(appDir, d));
  return { text, files };
}

/**
 * Decide u-claims-covered for one app.
 *
 * @param {string} appDir - App directory.
 * @param {{pass: Function, fail: Function, notApplicable: Function}} io - Outcome callbacks.
 * @returns {void}
 */
export function runClaimsCovered(appDir, io) {
  const { pass, fail, notApplicable } = io;
  const file = join(appDir, CLAIMS_FILE);
  if (!existsSync(file)) {
    // An app scaffolded before claims existed has nothing to check against.
    // n/a removes it from the denominator rather than inventing a pass.
    return notApplicable(`no ${CLAIMS_FILE}; nothing declares what this app claims to do`);
  }

  let claims;
  try {
    claims = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fail(`${CLAIMS_FILE} is not parseable JSON`);
  }
  const features = Array.isArray(claims?.features) ? claims.features : [];
  if (features.length === 0) {
    return notApplicable(`${CLAIMS_FILE} declares no features`);
  }

  const { text, files } = readTestCorpus(appDir);
  if (files === 0) {
    return fail(
      `${features.length} claimed feature(s) and not one test file in the app. ` +
        'A specification with no tests is a list of intentions.'
    );
  }

  const unnamed = [];
  const unmatchable = [];
  for (const feature of features) {
    const name = typeof feature?.name === 'string' ? feature.name : '';
    const words = significantWords(name);
    if (words.length === 0) {
      unmatchable.push(`${feature?.id ?? '?'} "${name}"`);
      continue;
    }
    if (!claimIsNamed(text, words)) {
      unnamed.push(`${feature?.id ?? '?'} "${name}" (looked for: ${words.join(', ')})`);
    }
  }

  if (unmatchable.length > 0) {
    return fail(
      `${unmatchable.length} claim(s) have no distinctive words to match on:\n` +
        unmatchable.map((u) => `  ${u}`).join('\n') +
        '\n\nRename the feature so it says what it does; a claim nothing can ' +
        'match is a claim nothing can check.'
    );
  }

  if (unnamed.length > 0) {
    return fail(
      `${unnamed.length} of ${features.length} claimed feature(s) are named by no test:\n` +
        unnamed.map((u) => `  ${u}`).join('\n') +
        `\n\nSearched ${files} test file(s). These were promised in the PRD and ` +
        'nothing demonstrates them. A feature the builder skipped renders no ' +
        'control and serves no route, so the control audit and the API check ' +
        'both see an app that is simply smaller than its specification.'
    );
  }

  return pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node u-claims-covered.mjs <appDir>');
    process.exit(2);
  }
  runClaimsCovered(dir, {
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
