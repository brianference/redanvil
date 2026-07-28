#!/usr/bin/env node
/**
 * fe-visible-response — an action must produce a visible response (R34).
 *
 * Usage: node fe-visible-response.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = not applicable.
 *
 * Why: three defects in one product, all reported by a user against a green
 * test suite.
 *
 *  - Pressing Search rendered its outcome at y=1341 in a 1000px viewport, so
 *    nothing visible changed and the button read as dead. The "no flights
 *    match" notice was correct and 341px below the fold.
 *  - Following a footer link kept the scroll position, landing the reader
 *    1,044px into a document they had never opened. A browser resets scroll on
 *    navigation; a client-side router does not.
 *  - Tabbing out of a typeahead left an unresolved fragment in the field.
 *
 * Checks two things a grep can actually decide:
 *   1. A client-side router resets scroll on route change.
 *   2. The acceptance suite asserts something is ON SCREEN, not merely present.
 *
 * It cannot decide whether every control scrolls to its own result -- that
 * needs a rendered page -- so the visual review still owns the general case.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Source files, excluding tests. */
function sourceFiles(dir, out = []) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Test/spec files under tests/. */
function specFiles(dir, out = []) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) specFiles(full, out);
    else if (/\.(spec|test)\.(tsx?|jsx?|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Run the check.
 *
 * @param {string} appDir App directory.
 * @param {{pass:()=>never, fail:(m?:string)=>never, notApplicable:(w?:string)=>never}} io
 */
export function runVisibleResponse(appDir, io) {
  const sources = sourceFiles(join(appDir, 'src'));
  if (sources.length === 0) io.notApplicable('no src/ to inspect');

  const joined = sources.map((f) => readFileSync(f, 'utf8')).join('\n');

  // Only applies to a client-side router. A server-rendered app gets scroll
  // reset from the browser and needs nothing.
  const hasRouter = /react-router|createBrowserRouter|BrowserRouter|useLocation|vue-router|@sveltejs\/kit/.test(
    joined
  );
  if (!hasRouter) {
    io.notApplicable('no client-side router; the browser resets scroll on navigation');
  }

  const failures = [];

  // 1. Scroll reset on route change. Any of these shapes counts: an explicit
  //    scrollTo tied to location, React Router's ScrollRestoration, or the
  //    Next.js/Nuxt built-ins that do it for you.
  const resetsScroll =
    /window\.scrollTo\s*\(/.test(joined) ||
    /<ScrollRestoration/.test(joined) ||
    /scrollRestoration/.test(joined) ||
    /scrollBehavior\s*\(/.test(joined);
  if (!resetsScroll) {
    failures.push(
      'the app uses a client-side router but never resets scroll on route change — ' +
        'following a link from far down a page lands the reader mid-document in a page ' +
        'they have not seen (R34)'
    );
  }

  // 2. The acceptance suite must assert visibility on screen somewhere. This is
  //    the check that would have caught the dead-looking Search button:
  //    toBeVisible() passes for an element 341px below the fold.
  const specs = specFiles(join(appDir, 'tests'));
  if (specs.length > 0) {
    const specText = specs.map((f) => readFileSync(f, 'utf8')).join('\n');
    const assertsViewport =
      /toBeInViewport\s*\(/.test(specText) ||
      /innerHeight/.test(specText) ||
      /boundingBox\s*\(/.test(specText) ||
      /scrollY/.test(specText);
    if (!assertsViewport) {
      failures.push(
        'no acceptance test asserts that anything is ON SCREEN — toBeVisible() passes for ' +
          'an element far below the fold, which is exactly how a working Search button was ' +
          'reported as doing nothing. Use toBeInViewport(), or compare a boundingBox ' +
          'against window.innerHeight (R34)'
      );
    }
  }

  if (failures.length > 0) {
    io.fail(`${failures.length} issue(s):\n  ${failures.join('\n  ')}`);
  }

  const where = sources.find((f) => /window\.scrollTo|ScrollRestoration/.test(readFileSync(f, 'utf8')));
  console.log(`scroll reset present${where ? ` (${relative(appDir, where)})` : ''}`);
  io.pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node fe-visible-response.mjs <appDir>');
    process.exit(2);
  }
  runVisibleResponse(dir, {
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
