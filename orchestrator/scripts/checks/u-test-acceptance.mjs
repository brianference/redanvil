#!/usr/bin/env node
/**
 * u-test-acceptance — the app must have acceptance tests that drive the real UI.
 *
 * Usage: node u-test-acceptance.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = not applicable (no frontend to drive).
 *
 * Why this rule exists (R27): unit tests over pure functions prove the functions
 * are right, not that a user can reach them. QuickFlight shipped with 49 green
 * unit tests, 12/12 design rules and zero axe violations, and its calendar could
 * not select a date range while its route could not be changed at all — the
 * route strip was a static display styled to look like a control. The filter
 * logic was correct and simply never wired to anything a user could click.
 *
 * This checks three things, all of which were absent in that build:
 *
 *  1. Acceptance specs exist at all.
 *  2. They actually drive a browser — a spec that only imports functions is a
 *     unit test in a different folder.
 *  3. They assert on OBSERVABLE RESULTS rather than on the control's own
 *     appearance. A test that clicks a filter and checks the button changed
 *     class tells you nothing about whether the list filtered.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Directories an acceptance suite conventionally lives in. */
const TEST_DIRS = ['tests', 'e2e', 'acceptance', join('src', '__acceptance__')];

/** Marks a spec as actually driving a browser rather than importing modules. */
const DRIVES_UI = [/@playwright\/test/, /\bpage\.goto\(/, /\bcy\.visit\(/, /puppeteer/];

/** Marks a spec as asserting on results rather than on the control itself. */
const ASSERTS_RESULTS = [
  /toBeVisible\(/,
  /toHaveText\(/,
  /toHaveValue\(/,
  /expect\s*\.\s*poll\(/,
  /evaluateAll\(/,
  /\.count\(\)/
];

/**
 * Every file under dir matching the spec naming convention.
 *
 * @param {string} dir Directory to walk.
 * @returns {string[]} Absolute spec paths.
 */
function specsIn(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...specsIn(full));
    else if (/\.(spec|test|cy)\.(ts|tsx|js|mjs)$/.test(entry.name)) found.push(full);
  }
  return found;
}

/**
 * Run the check.
 *
 * @param {string} appDir App directory.
 * @param {{pass:()=>never, fail:(m?:string)=>never, notApplicable:(w?:string)=>never}} io
 */
export function runTestAcceptance(appDir, io) {
  // No frontend, nothing to drive.
  if (!existsSync(join(appDir, 'src')) && !existsSync(join(appDir, 'index.html'))) {
    io.notApplicable('no frontend in this app');
  }

  const specs = TEST_DIRS.flatMap((d) => specsIn(join(appDir, d)));
  if (specs.length === 0) {
    io.fail(
      `no acceptance specs found in ${TEST_DIRS.join(', ')} — unit tests do not prove a ` +
        'control is wired to anything a user can reach (R27)'
    );
  }

  const bodies = specs.map((f) => ({ f, src: readFileSync(f, 'utf8') }));

  const driving = bodies.filter(({ src }) => DRIVES_UI.some((re) => re.test(src)));
  if (driving.length === 0) {
    io.fail(
      `${specs.length} spec(s) found but none drive a browser — an acceptance test that ` +
        'never loads the page is a unit test in a different folder'
    );
  }

  const asserting = driving.filter(({ src }) => ASSERTS_RESULTS.some((re) => re.test(src)));
  if (asserting.length === 0) {
    io.fail(
      'acceptance specs drive the UI but assert nothing observable — assert on the ' +
        'RESULT (rows, values, visible state), not on the control changing its own class'
    );
  }

  // A suite that never clicks anything is a smoke test, not acceptance.
  const interacts = driving.filter(({ src }) =>
    /\.(click|fill|press|check|selectOption)\(/.test(src)
  );
  if (interacts.length === 0) {
    io.fail('acceptance specs load pages but never interact — nothing is being accepted');
  }

  io.pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node u-test-acceptance.mjs <appDir>');
    process.exit(2);
  }
  runTestAcceptance(dir, {
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
