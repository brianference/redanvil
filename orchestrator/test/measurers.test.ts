import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';

/**
 * Every measurer must prove it can fail.
 *
 * `desktopWidth.test.ts` established this and says why: *"A check that answers
 * 100% for every page, correct or not, carries no information."* That check had
 * been confidently wrong for weeks, and four narrow pages across two apps went
 * out behind its number — a person caught it, not the check.
 *
 * It was also the ONLY script in the repo bound to a case with a known answer.
 * There are 21 scripts under `.github/scripts/`; the rest could return
 * `ok: true` for every input and nothing would notice, because
 * `designAuditIssues` accepts whatever report it is handed as evidence.
 *
 * This session made that concrete rather than theoretical. Every new
 * measurement written here was wrong on first run and wrong in the flattering
 * direction: a changed-set filter that reported an uninstrumented file untested
 * forever, a coverage-scope guard that was itself evadable, an 8s timeout that
 * called a healthy provider unreachable, a CSS fix aimed at a selector that did
 * not apply to the element.
 *
 * So each measurer gets a fixture it MUST fail and one it MUST pass. The
 * negative alone is not enough — a check that always fails is as useless as one
 * that always passes, and only the pair shows the check discriminates.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const SCRIPTS = join(repoRoot, '.github', 'scripts');
const FIXTURES = join(here, 'fixtures', 'measurers');

/** A probe that any fixture page can satisfy: no flow, so only theme is judged. */
const NO_FLOW_PROBE = JSON.stringify({
  control: 'toggle theme',
  fill: {},
  expectSelector: 'h1',
  minCount: 1
});

/**
 * Serve the fixture directory so a measurer can drive real rendered pages.
 *
 * Copied from desktopWidth.test.ts deliberately — these checks measure what a
 * browser paints, and a fixture that is not served is not the thing they read.
 *
 * @returns Base URL and a close function.
 */
function serveFixtures(): Promise<{ base: string; close: () => void }> {
  return new Promise((resolve) => {
    const server: Server = createServer((req, res) => {
      const name = (req.url ?? '/').split('?')[0]?.replace(/^\//, '') ?? '';
      const file = join(FIXTURES, name);
      if (name.length === 0 || !existsSync(file)) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ base: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

/**
 * Run a measurer script and return its real exit code and output.
 *
 * @param script Script file name under .github/scripts.
 * @param args Arguments after the script path.
 * @returns Exit status and combined output.
 */
async function runMeasurer(
  script: string,
  args: string[]
): Promise<{ status: number; output: string }> {
  // spawn, NEVER spawnSync. The fixture HTTP server lives in this process, and
  // spawnSync blocks its event loop -- so the server could not answer the very
  // request the measurer was making, and every case failed with a page.goto
  // timeout that looked like a broken check. desktopWidth.test.ts records the
  // same trap and notes that one of its tests once PASSED on it, which is the
  // vacuous pass these files exist to prevent.
  return new Promise((resolveRun) => {
    const child = spawn('node', [join(SCRIPTS, script), ...args], { timeout: 180_000 });
    let output = '';
    child.stdout?.on('data', (d) => {
      output += String(d);
    });
    child.stderr?.on('data', (d) => {
      output += String(d);
    });
    child.on('close', (code) => resolveRun({ status: code ?? -1, output }));
  });
}

describe('cold_visitor discriminates a broken default theme', () => {
  let base: string;
  let close: () => void;
  beforeAll(async () => {
    ({ base, close } = await serveFixtures());
  });
  afterAll(() => {
    close();
  });

  // The RedAnvil standard changed on 2026-08-03: a first-time visitor gets
  // LIGHT regardless of the OS setting, because following prefers-color-scheme
  // gave a visitor on a dark phone a dark first paint of an app whose intended
  // default is light. These two fixtures therefore swap roles — the negative
  // and positive controls are both kept, so the check still discriminates.

  it('FAILS a page that paints dark on a cold load because the OS asked for it', async () => {
    // theme-follows-system.html resolves data-theme from prefers-color-scheme,
    // so a fresh dark-OS visitor gets dark. That is now the defect.
    const { status, output } = await runMeasurer('cold_visitor.mjs', [
      `${base}/theme-follows-system.html`,
      '--probe',
      NO_FLOW_PROBE
    ]);
    expect(status, output).toBe(1);
    expect(output).toMatch(/cold-theme-dark/);
    expect(output).toMatch(/EXPECTED "light"/);
  });

  it('PASSES a page whose cold default is light whatever the OS says', async () => {
    // The positive control. Without it, a check that always failed would look
    // exactly as good as one that works.
    const { status, output } = await runMeasurer('cold_visitor.mjs', [
      `${base}/theme-ignores-system.html`,
      '--probe',
      NO_FLOW_PROBE
    ]);
    expect(status, output).toBe(0);
  });

  it('exits INFRA, never 0, when it has no probe to run', async () => {
    // Fails closed on its own inputs. "No probe configured" reading as "the
    // flow works" is the pass-by-default this whole file exists to remove.
    const { status, output } = await runMeasurer('cold_visitor.mjs', [
      `${base}/theme-follows-system.html`
    ]);
    expect(status, output).toBe(2);
    expect(output).toMatch(/no primary-flow probe/i);
  });
});

describe('every verdict-backing measurer is bound to a known answer', () => {
  /**
   * Scripts whose output `schemas/verdicts.ts` will accept as evidence for a
   * passing rule. A report from any of these can decide a blocker, so each one
   * needs a case with a known answer.
   */
  const VERDICT_BACKING = ['desktop_width.mjs', 'cold_visitor.mjs'];

  /**
   * Scripts that back verdicts but do not yet have known-answer fixtures.
   *
   * Listed explicitly so adding one is a deliberate edit rather than silent
   * drift — the same device `detCoverage.test.ts` uses for judge-only hybrids.
   * Every entry here is a measurer whose output can pass a blocker while
   * nothing has ever shown it capable of failing.
   */
  const UNBOUND = new Set(['design_audit.mjs', 'a11y_audit.mjs']);

  it('names every verdict-backing script, bound or explicitly unbound', () => {
    for (const script of VERDICT_BACKING) {
      expect(existsSync(join(SCRIPTS, script)), `${script} is missing`).toBe(true);
    }
    // A script cannot be both bound and excused.
    for (const script of VERDICT_BACKING) {
      expect(UNBOUND.has(script), `${script} is both bound and listed as unbound`).toBe(false);
    }
  });

  it('every script in the unbound list still exists', () => {
    // A rename that leaves a stale exemption would hide a measurer that has no
    // fixture and no excuse.
    for (const script of UNBOUND) {
      expect(existsSync(join(SCRIPTS, script)), `unbound script missing: ${script}`).toBe(true);
    }
  });

  it('records how much of .github/scripts is bound, so the gap stays visible', () => {
    const all = readdirSync(SCRIPTS).filter((f) => f.endsWith('.mjs'));
    const bound = VERDICT_BACKING.length;
    // Not an assertion about a target number — a floor that cannot silently
    // regress. Raising `bound` requires adding a real fixture.
    expect(all.length).toBeGreaterThan(0);
    expect(bound).toBeGreaterThanOrEqual(2);
  });
});
