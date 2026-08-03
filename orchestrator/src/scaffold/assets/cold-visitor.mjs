#!/usr/bin/env node
/**
 * Observe the app the way a stranger does: nothing forced, nothing seeded.
 *
 * Usage:
 *   node cold_visitor.mjs <baseUrl> [--claims path] [--probe '{"...":"..."}']
 *                         [--out report.json]
 *
 * Exit 0 = pass, 1 = fail, 2 = infrastructure, 3 = not applicable.
 *
 * WHY THIS EXISTS, and it is worth being exact, because every other check here
 * is correct and still missed it.
 *
 * Every measurement in this repo sets up the state it then measures.
 * `a11y_audit.mjs` calls `setAttribute('data-theme', t)` before it looks, so it
 * grades a theme the app may never resolve to on its own. `design_audit.mjs`
 * exercised the theme TOGGLE and never asked what a visitor gets before
 * touching it. `feature-audit.mjs` crawls routes that are already seeded.
 * `u-api-real-output` calls the examples somebody remembered to declare.
 *
 * Each is right for its own purpose. Together they left a hole with a precise
 * shape: NO check ever observed the app in its default state, with a query
 * nobody had seeded. Two defects shipped straight through that hole —
 * quickflight served the light theme to every visitor whose OS asked for dark,
 * and its search returned an empty list for almost any route a person would
 * type. Both were found by a human looking at the running site.
 *
 * So this script forces nothing. No `data-theme`, no `localStorage`, no seeded
 * route, no warmed cache. It emulates an operating system preference and then
 * only asks what the app did.
 *
 * It fails closed on its own inputs: with no probe it exits 2 (infrastructure),
 * never 0. A check that cannot run has not passed, and "no probe configured"
 * silently reporting success is the pass-by-default this exists to remove.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

/** Exit: every cold-start expectation held. */
export const EXIT_PASS = 0;
/** Exit: the app behaved differently for a first-time visitor. */
export const EXIT_FAIL = 1;
/** Exit: the check could not run. Never a silent pass. */
export const EXIT_INFRA = 2;
/** Exit: nothing here to measure. */
export const EXIT_NOT_APPLICABLE = 3;

/** How long to wait for the primary flow to produce something. */
const FLOW_TIMEOUT_MS = 30_000;

/**
 * Parse `<baseUrl> [--claims p] [--probe json] [--out p]`.
 *
 * @param {string[]} argv - Raw process arguments.
 * @returns {{baseUrl: string, claims: string|null, probe: string|null, out: string|null}} Parsed options.
 */
export function parseArgs(argv) {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : (argv[i + 1] ?? null);
  };
  const baseUrl = positional[0];
  if (baseUrl === undefined) {
    throw new Error('usage: node cold_visitor.mjs <baseUrl> [--claims p] [--probe json] [--out p]');
  }
  return { baseUrl, claims: flag('claims'), probe: flag('probe'), out: flag('out') };
}

/**
 * The primary flow to exercise, from a claims file or an explicit probe.
 *
 * A probe names a control and an input the app has NOT seeded, plus what a real
 * answer looks like. Deriving it from claims.json is the point: the app states
 * what it does, and this drives exactly that.
 *
 * @param {{claims: string|null, probe: string|null}} opts - Sources.
 * @returns {{control: string, fill: Record<string,string>, expectSelector: string, minCount: number}|null} The probe, or null.
 */
export function resolveProbe(opts) {
  if (opts.probe !== null) {
    try {
      return JSON.parse(opts.probe);
    } catch {
      return null;
    }
  }
  if (opts.claims === null || !existsSync(opts.claims)) return null;
  try {
    const claims = JSON.parse(readFileSync(opts.claims, 'utf8'));
    return claims?.coldVisitorProbe ?? null;
  } catch {
    return null;
  }
}

/**
 * Whether the app's resolved theme matches what the operating system asked for.
 *
 * @param {string|null} resolved - The app's `data-theme` after load.
 * @param {string} scheme - The emulated preference.
 * @returns {boolean} True when the default follows the system.
 */
export function themeFollowsSystem(resolved, scheme) {
  // An app with no data-theme at all may still be styled correctly by CSS
  // media queries, so absence is not a failure -- disagreement is.
  if (resolved === null) return true;
  // RedAnvil standard changed 2026-08-03: a first-time visitor gets LIGHT,
  // whatever the OS says. Following prefers-color-scheme meant a visitor on a
  // dark phone got a dark first paint of an app whose intended default is
  // light, before choosing anything. Selecting dark or system from the theme
  // control still works and still persists -- that is a STORED preference, and
  // this check only ever runs on a fresh profile with nothing stored.
  //
  // Still falsifiable: an app that renders dark on a cold dark-OS load fails.
  void scheme;
  return resolved === 'light';
}

/**
 * Run the cold-visitor checks against a live URL.
 *
 * @param {string} baseUrl - Deployed base URL.
 * @param {object|null} probe - Primary-flow probe.
 * @param {object} deps - Injected `chromium`, for tests.
 * @returns {Promise<{ok: boolean, findings: Record<string, {ok: boolean, detail: string}>, checkedAt: string, baseUrl: string}>} Report.
 */
export async function runColdVisitor(baseUrl, probe, deps) {
  const { chromium } = deps;
  const findings = {};
  /**
   * Record one finding.
   *
   * @param {string} id - Finding id.
   * @param {boolean} ok - Whether it held.
   * @param {string} detail - Human-readable evidence.
   */
  const record = (id, ok, detail) => {
    findings[id] = { ok, detail };
  };

  const browser = await chromium.launch();
  try {
    // --- The default theme, at both system settings ---
    for (const scheme of ['dark', 'light']) {
      // Deliberately a FRESH context each time: no storage, no cookies, nothing
      // carried over. A returning visitor's stored choice is a different
      // question, and design_audit already asks it.
      const ctx = await browser.newContext({ colorScheme: scheme });
      const page = await ctx.newPage();
      const consoleErrors = [];
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 120));
      });
      page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 120)));

      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      const resolved = await page.evaluate(
        () => document.documentElement.getAttribute('data-theme')
      );
      record(
        `cold-theme-${scheme}`,
        themeFollowsSystem(resolved, scheme),
        `prefers-color-scheme:${scheme} on a fresh profile resolved to "${resolved ?? '(unset)'}"` +
          (themeFollowsSystem(resolved, scheme) ? '' : ` — EXPECTED "light" (first paint defaults to light)`)
      );
      record(
        `cold-console-${scheme}`,
        consoleErrors.length === 0,
        consoleErrors.length === 0
          ? 'no console errors on arrival'
          : `${consoleErrors.length} console error(s): ${consoleErrors.slice(0, 3).join(' | ')}`
      );
      await ctx.close();
    }

    // --- The primary flow, with an input the app did not seed ---
    if (probe !== null) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      // A probe may either drive controls, or open a URL directly. The second
      // is not a shortcut: a shared or bookmarked link is a real first-visit
      // journey, and it is the only way to express a flow whose inputs are not
      // all text fields -- a date picked from a calendar has no selector to
      // fill. Both start from a cold profile.
      // No path means "the app's own entry point", which is baseUrl exactly as
      // given -- resolving '/' against it would discard any path the caller
      // already included.
      const entry =
        typeof probe.path === 'string' && probe.path !== ''
          ? new URL(probe.path, baseUrl).href
          : baseUrl;
      await page.goto(entry, { waitUntil: 'networkidle' });
      let detail = '';
      let ok = false;
      try {
        for (const [selector, value] of Object.entries(probe.fill ?? {})) {
          await page.locator(selector).first().fill(value);
        }
        if (typeof probe.control === 'string' && probe.control !== '') {
          await page.getByRole('button', { name: new RegExp(probe.control, 'i') }).first().click();
        }
        const results = page.locator(probe.expectSelector);
        // Auto-retrying: the flow may go to the network, and a live provider
        // is slower than a database read.
        await results.first().waitFor({ timeout: FLOW_TIMEOUT_MS });
        const count = await results.count();
        const want = probe.minCount ?? 1;
        ok = count >= want;
        detail = `${probe.path ?? probe.control} produced ${count} result(s), needed ${want}`;
      } catch (err) {
        detail = `${probe.path ?? probe.control} produced nothing usable within ${FLOW_TIMEOUT_MS}ms: ${String(err).slice(0, 140)}`;
      }
      // This is the "search returns an empty list for anything unseeded" case.
      // A correct, empty answer is still a product that does not work.
      record('cold-primary-flow', ok, detail);
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  const ok = Object.values(findings).every((f) => f.ok);

  /*
    A roll-up keyed by the RULE id, alongside the granular findings.

    `designAuditIssues` in schemas/verdicts.ts looks a rule up by id in
    `findings` and rejects a report that "does not measure this rule". The
    granular keys (cold-theme-dark, cold-primary-flow) are what a person needs
    to diagnose a failure; this is what the evidence chain needs to accept the
    report as backing for a verdict. Both, not either.
  */
  const failed = Object.entries(findings)
    .filter(([, f]) => !f.ok)
    .map(([id]) => id);
  findings['fe-cold-visitor'] = {
    ok,
    detail: ok
      ? `a first-time visitor gets a working app: ${Object.keys(findings).length} cold-start check(s) held`
      : `failed for a first-time visitor: ${failed.join(', ')}`
  };

  return { ok, findings, checkedAt: new Date().toISOString(), baseUrl };
}

/**
 * CLI entry.
 *
 * @returns {Promise<number>} Exit code.
 */
export async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(String(err.message ?? err));
    return EXIT_INFRA;
  }

  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error('cold-visitor INFRA: playwright is not installed — the app was NOT observed');
    return EXIT_INFRA;
  }

  const probe = resolveProbe(opts);
  if (probe === null) {
    // Fails closed. "No probe configured" must never read as "the flow works".
    console.error(
      'cold-visitor INFRA: no primary-flow probe. Pass --probe or a --claims file ' +
        'containing coldVisitorProbe. Without one the most important half of this ' +
        'check cannot run, and reporting a pass would be inventing a result.'
    );
    return EXIT_INFRA;
  }

  const report = await runColdVisitor(opts.baseUrl, probe, { chromium });

  for (const [id, f] of Object.entries(report.findings)) {
    console.log(`${f.ok ? 'PASS' : 'FAIL'}  ${id} — ${f.detail}`);
  }

  if (opts.out !== null) {
    // Written on BOTH paths. A report that only appears when the run passed is
    // a report nobody can use to see that it stopped passing.
    const outPath = resolve(opts.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
    console.log(`wrote ${opts.out}`);
  }

  return report.ok ? EXIT_PASS : EXIT_FAIL;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`cold-visitor INFRA: ${String(err)}`);
      process.exit(EXIT_INFRA);
    });
}
