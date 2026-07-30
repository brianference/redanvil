#!/usr/bin/env node
/**
 * u-test-feature-audit — the app must run a control inventory audit, and every
 * claim it makes must resolve to a real test.
 *
 * Usage: node u-test-feature-audit.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = not applicable (no frontend to audit).
 *
 * Why this rule exists: `u-test-acceptance` proves the suite drives a browser
 * and asserts on results. It cannot prove the suite covers the app, because the
 * suite and the coverage claim come from the same mental model — the author
 * tests what the author remembered. A Search button with no visible response, a
 * public write endpoint and an assistant returning 502 for two months all
 * shipped from a repository whose acceptance tests were green.
 *
 * The audit inverts that: it crawls the RUNNING app, enumerates controls by
 * accessibility role, and fails on any control no test claims. That crawl needs
 * a live server, so it runs in `npm run test:features` / `npm run verify` rather
 * than here. What this rule decides deterministically is everything that makes
 * the crawl ENFORCING rather than decorative:
 *
 *   1. The audit script and the manifest both exist.
 *   2. The manifest names real controls, each with a non-empty test claim.
 *   3. Every claim resolves to a spec file that exists and a test title that is
 *      really in it. A claim pointing at nothing is fiction, and fiction in a
 *      coverage manifest is worse than an empty one.
 *   4. The audit is wired into `test:features` AND into `verify`, so it runs
 *      with everything else instead of only when someone remembers it.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Where the audit script is expected to live. */
const AUDIT_SCRIPT = join('scripts', 'feature-audit.mjs');
/** Where the control manifest is expected to live. */
const MANIFEST = join('tests', 'features.manifest.json');
/** Fields every manifest entry must carry. */
const REQUIRED_FIELDS = ['role', 'name', 'routes', 'test'];
/**
 * Text that looks like a claim but is not one. A manifest whose `test` field
 * reads "TODO" documents the gap instead of closing it, and the audit would
 * still exit 0 because the key was present.
 */
const EMPTY_CLAIM = /^(todo|tbd|n\/?a|none|pending|\?+)\b/i;

/**
 * Every spec file under a directory.
 *
 * @param {string} dir - Directory to walk.
 * @param {string[]} out - Accumulator.
 * @returns {string[]} Absolute spec paths.
 */
function specsIn(dir, out = []) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) specsIn(full, out);
    else if (/\.(spec|test|cy)\.(ts|tsx|js|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Resolve one manifest claim against the app's specs.
 *
 * A claim is written `<spec file> > <test title>`. Both halves are checked: the
 * file has to exist and the title has to appear in it, because a renamed test
 * leaves a claim that reads perfectly and proves nothing.
 *
 * @param {string} claim - The manifest `test` value.
 * @param {Map<string, string>} specText - Spec path (relative) to file contents.
 * @returns {string|null} Reason the claim does not resolve, or null when it does.
 */
function claimFailure(claim, specText) {
  const separator = claim.indexOf('>');
  if (separator === -1) {
    return 'is not in the form "<spec file> > <test title>"';
  }
  const file = claim.slice(0, separator).trim();
  const title = claim.slice(separator + 1).trim();
  if (file === '' || title === '') {
    return 'is missing the spec file or the test title';
  }
  const normalisedFile = file.replace(/\\/g, '/');
  const matches = [...specText.entries()].filter(([path]) => {
    const normalised = path.replace(/\\/g, '/');
    return normalised === normalisedFile || normalised.endsWith('/' + normalisedFile);
  });
  if (matches.length === 0) {
    return 'names spec file "' + file + '", which does not exist';
  }
  if (!matches.some(([, text]) => text.includes(title))) {
    return 'names test "' + title + '" in ' + file + ', which has no such test title';
  }
  return null;
}

/**
 * Run the check.
 *
 * @param {string} appDir - App directory.
 * @param {{pass:()=>never, fail:(m?:string)=>never, notApplicable:(w?:string)=>never}} io
 * @returns {void}
 */
export function runFeatureAudit(appDir, io) {
  // No frontend means no controls to inventory.
  if (!existsSync(join(appDir, 'src')) && !existsSync(join(appDir, 'index.html'))) {
    io.notApplicable('no frontend in this app');
  }

  const failures = [];

  const scriptPath = join(appDir, AUDIT_SCRIPT);
  if (!existsSync(scriptPath)) {
    failures.push(
      'no control audit at ' +
        AUDIT_SCRIPT +
        ' — without it the suite only checks what its author already had in mind, ' +
        'and a control nobody thought of is a control nobody tested'
    );
  }

  const manifestPath = join(appDir, MANIFEST);
  let controls = [];
  if (!existsSync(manifestPath)) {
    failures.push('no control manifest at ' + MANIFEST);
  } else {
    let manifest = null;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      failures.push(MANIFEST + ' is not valid JSON: ' + String(err).slice(0, 120));
    }
    if (manifest !== null) {
      if (!Array.isArray(manifest.controls)) {
        failures.push(MANIFEST + ' has no "controls" array');
      } else if (manifest.controls.length === 0) {
        failures.push(
          MANIFEST +
            ' claims zero controls. An app with a frontend has controls; an empty ' +
            'manifest passes the audit by having nothing to check'
        );
      } else {
        controls = manifest.controls;
      }
    }
  }

  const specPaths = ['tests', 'e2e', 'acceptance'].flatMap((d) => specsIn(join(appDir, d)));
  const specText = new Map(
    specPaths.map((p) => [relative(appDir, p), readFileSync(p, 'utf8')])
  );

  for (const [index, control] of controls.entries()) {
    const where = 'controls[' + index + ']';
    const missing = REQUIRED_FIELDS.filter(
      (f) => control[f] === undefined || control[f] === null || control[f] === ''
    );
    if (missing.length > 0) {
      failures.push(where + ' is missing: ' + missing.join(', '));
      continue;
    }
    if (!Array.isArray(control.routes) || control.routes.length === 0) {
      failures.push(where + ' (' + control.role + ':' + control.name + ') lists no routes');
    }
    const claim = String(control.test).trim();
    if (EMPTY_CLAIM.test(claim)) {
      failures.push(
        where +
          ' (' +
          control.role +
          ':' +
          control.name +
          ') records "' +
          claim +
          '" instead of a test — that documents the gap rather than closing it'
      );
      continue;
    }
    if (specText.size === 0) {
      failures.push(
        where + ' claims test "' + claim + '" but the app ships no spec files to hold it'
      );
      continue;
    }
    const reason = claimFailure(claim, specText);
    if (reason !== null) {
      failures.push(where + ' (' + control.role + ':' + control.name + ') ' + reason);
    }
  }

  const pkgPath = join(appDir, 'package.json');
  if (!existsSync(pkgPath)) {
    failures.push('no package.json, so nothing can run the audit');
  } else {
    let scripts = {};
    try {
      scripts = JSON.parse(readFileSync(pkgPath, 'utf8')).scripts ?? {};
    } catch (err) {
      failures.push('package.json is not valid JSON: ' + String(err).slice(0, 120));
    }
    const runsAudit = (value) =>
      typeof value === 'string' && /feature-audit\.mjs|\btest:features\b/.test(value);
    if (!runsAudit(scripts['test:features'])) {
      failures.push('package.json has no "test:features" script that runs ' + AUDIT_SCRIPT);
    }
    if (!runsAudit(scripts.verify)) {
      // An audit nobody runs is a file, not a gate. This is the difference
      // between the capability existing and the capability enforcing.
      failures.push(
        'package.json "verify" does not run the feature audit, so the inventory is ' +
          'only checked when someone remembers to ask for it'
      );
    }
  }

  if (failures.length > 0) {
    io.fail(failures.length + ' issue(s):\n  ' + failures.join('\n  '));
  }

  console.log(
    'feature audit wired: ' + controls.length + ' claimed control(s), every claim resolves'
  );
  io.pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node u-test-feature-audit.mjs <appDir>');
    process.exit(2);
  }
  runFeatureAudit(dir, {
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
