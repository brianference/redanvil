#!/usr/bin/env node
/**
 * The `u-test-runners` role: run every lane INDEPENDENTLY and record each one's
 * own result, including how many tests actually ran.
 *
 * The first version of this recorded `{lane, exitCode}` and the contract only
 * required those words to appear. It therefore passed a run where
 * `typecheck exitCode: 2` -- a real failure -- sat in the evidence file, on an
 * app with 8 tests total, an acceptance suite that was never invoked, and no
 * pytest lane at all. Running a check and honouring it are different things.
 *
 * What is enforced now:
 *  - every lane that runs must exit 0
 *  - the acceptance and pytest lanes must be present, not silently absent
 *  - a minimum number of tests must actually execute
 *
 * A lane that cannot run is recorded as `ran: false` and fails, because a lane
 * that was never invoked is indistinguishable from one that passed.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Below this, a suite is not covering an app -- it is decorating one. */
const MIN_TESTS = 20;

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = /^--([^=]+)=([\s\S]*)$/.exec(a);
    return m ? [[m[1], m[2]]] : [];
  })
);
if (!args.slug) {
  process.stderr.write('usage: runners.mjs --slug=X [--repoRoot=.]\n');
  process.exit(2);
}
const root = resolve(args.repoRoot ?? process.cwd());
const appDir = join(root, args.slug);

/** Every lane the process diagram names, each run on its own. */
const LANES = [
  { lane: 'vitest', cmd: 'npx vitest run --reporter=basic' },
  { lane: 'acceptance', cmd: 'npx vitest run --config vitest.acceptance.config.ts --reporter=basic' },
  { lane: 'typecheck', cmd: 'npx tsc --noEmit' },
  { lane: 'build', cmd: 'npm run build --silent' },
  { lane: 'pytest', cmd: 'python -m pytest -q' }
];

/**
 * Pull the executed-test count out of a runner's output.
 * @param {string} out combined stdout+stderr
 * @returns {number|null} tests seen, or null when the lane reports none
 */
function testCount(out) {
  const vitest = /Tests\s+(\d+)\s+passed/.exec(out) ?? /(\d+)\s+passed/.exec(out);
  const py = /(\d+)\s+passed/.exec(out);
  const m = vitest ?? py;
  return m ? Number(m[1]) : null;
}

// The acceptance suite defaults to a local `wrangler pages dev` on 127.0.0.1:8788
// and fails with ERR_CONNECTION_REFUSED when nothing is serving. Point it at the
// DEPLOYED build instead: an acceptance suite that only ever runs against a
// local dev server never tests the thing users get.
let deployUrl = '';
const claims = join(appDir, '.redanvil', 'claims.json');
if (existsSync(claims)) {
  try {
    deployUrl = JSON.parse(readFileSync(claims, 'utf8')).deployUrl ?? '';
  } catch {
    /* no claim recorded yet */
  }
}

const results = [];
for (const l of LANES) {
  if (!existsSync(join(appDir, 'package.json'))) {
    results.push({ lane: l.lane, ran: false, exitCode: null, tests: null, note: 'app not scaffolded' });
    continue;
  }
  const p = spawnSync(l.cmd, {
    cwd: appDir,
    shell: true,
    encoding: 'utf8',
    timeout: 15 * 60 * 1000,
    env: { ...process.env, ...(l.lane === 'acceptance' && deployUrl ? { PLAYWRIGHT_BASE_URL: deployUrl, BASE_URL: deployUrl } : {}) }
  });
  const out = `${p.stdout ?? ''}${p.stderr ?? ''}`;

  // The acceptance suite creates rows against the DEPLOYED database and its
  // per-file afterAll cleanup does not reliably cover every file. Four rows
  // titled "Public create <timestamp>" were left in the live catalog and served
  // to real visitors; the pytest lane caught them. Purge here, explicitly, and
  // leave the pytest assertion strict so a failure of THIS cleanup still shows.
  if (l.lane === 'acceptance' && deployUrl) {
    try {
      const list = await fetch(`${deployUrl}/api/sushis`).then((r) => r.json());
      const junk = (list.items ?? []).filter((i) => /^Public create \d+/.test(i.title ?? ''));
      for (const row of junk) {
        await fetch(`${deployUrl}/api/sushis/${row.id}`, { method: 'DELETE' }).catch(() => undefined);
      }
      if (junk.length) console.log(`  cleaned ${junk.length} row(s) the acceptance lane created in production`);
    } catch {
      /* the pytest lane asserts the catalog is clean, so a miss here still fails */
    }
  }
  // A pytest lane with no python tests is "absent", not "passing". Recording it
  // as absent is honest; recording it as green would be inventing a result.
  const noPython = l.lane === 'pytest' && /no tests ran|No module named pytest/i.test(out);
  results.push({
    lane: l.lane,
    ran: !noPython,
    exitCode: noPython ? null : p.status,
    tests: testCount(out),
    tail: out.replace(/\[[0-9;]*m/g, '').trim().split('\n').slice(-2).join(' | ').slice(0, 200)
  });
}

const ranLanes = results.filter((r) => r.ran);
const failed = ranLanes.filter((r) => r.exitCode !== 0);
const absent = results.filter((r) => !r.ran);
const totalTests = results.reduce((n, r) => n + (r.tests ?? 0), 0);
const enoughTests = totalTests >= MIN_TESTS;
const allLanesPassed = failed.length === 0 && absent.length === 0;

mkdirSync(join(appDir, 'evidence'), { recursive: true });
writeFileSync(
  join(appDir, 'evidence', 'test-lanes.json'),
  JSON.stringify(
    { ranAt: new Date().toISOString(), lanes: results, totalTests, minTests: MIN_TESTS, enoughTests, allLanesPassed },
    null,
    2
  ) + '\n'
);

console.log(
  `runners: ${results.length} lanes | ${failed.length} failing | ${absent.length} absent | ${totalTests} tests (min ${MIN_TESTS})`
);
for (const f of failed) console.log(`  FAIL ${f.lane} exit ${f.exitCode}: ${f.tail.slice(0, 100)}`);
for (const a of absent) console.log(`  ABSENT ${a.lane} — a lane that never ran is not a lane that passed`);
process.exit(allLanesPassed && enoughTests ? 0 : 1);
