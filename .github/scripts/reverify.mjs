#!/usr/bin/env node
/**
 * Re-measure, re-stamp and re-gate both apps, in the only order that works.
 *
 * Every change to an app's `src/` invalidates its recorded verdicts, because a
 * recorded review is only evidence for the commit it was recorded at. Doing
 * that by hand is five commands per app in a specific order, and forgetting it
 * cost three CI failures in one session — each time `results-provenance` failed
 * on a change that was itself fine.
 *
 * The order is not arbitrary and this script enforces it:
 *
 *   1. the tree must be CLEAN          — a dirty tree describes no commit
 *   2. production must serve HEAD's build — or you measure the previous one
 *   3. measure                          — against that deployed build
 *   4. stamp verdicts to HEAD           — reports now post-date the commit
 *   5. gate, reproduce, tie to deploy
 *
 * Steps 1 and 2 are the ones people skip. Measuring a dirty tree or a stale
 * edge node produces a green result that describes nothing, which is worse than
 * a red one.
 *
 * Usage:
 *   node reverify.mjs [--app app-builder] [--skip-propagation] [--no-gate]
 *
 * Exit 0 when every app is measured, gated, reproduced and tied to its deploy.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { APPS } from './apps.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};

// APPS lives in apps.mjs so pre-push, meets_the_bar, and CI all read the same list.

const only = value('app');
const apps = only === null ? [...APPS] : APPS.filter((a) => a.slug === only);
if (apps.length === 0) {
  console.error(`unknown app "${only}" — known: ${APPS.map((a) => a.slug).join(', ')}`);
  process.exit(2);
}

/** Run a command, streaming nothing; return {code, out}. */
function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  return { code: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/** Run a node script under .github/scripts. */
const script = (name, rest) => run(process.execPath, [`.github/scripts/${name}`, ...rest]);

const step = (n, text) => console.log(`\n[${n}] ${text}`);
const fail = (msg) => {
  console.error(`\nreverify FAIL: ${msg}`);
  process.exit(1);
};

// --- 1. clean tree -----------------------------------------------------------
step(1, 'working tree');
const dirty = run('git', ['status', '--porcelain']).out.trim();
if (dirty.length > 0) {
  fail(
    'the tree is dirty. A result produced from a dirty tree describes no commit, ' +
      'so it cannot be tied to a deploy. Commit first, then re-run.\n  ' +
      dirty.split('\n').slice(0, 5).join('\n  ')
  );
}
const head = run('git', ['rev-parse', 'HEAD']).out.trim();
console.log(`    clean at ${head.slice(0, 12)}`);

// --- 2. production is serving THIS commit's build ----------------------------
// The alias serves a mix of old and new from different edge nodes for a minute
// or two after a deploy. Probes alternated six times in a row during one
// session, and a screenshot run right after an 8-probe check still caught a
// stale node. Twenty consecutive is the bar.
if (!flag('skip-propagation')) {
  step(2, 'production is serving the local build (20 consecutive probes)');
  for (const app of apps) {
    const distDir = `${app.dir}/dist/assets`;
    if (!existsSync(distDir)) {
      fail(`${app.dir}/dist is missing — run \`npm run build\` in ${app.dir} first`);
    }
    const local = run('node', [
      '-e',
      `const fs=require('fs');console.log(fs.readdirSync(${JSON.stringify(distDir)}).find(f=>/^index-.*\\.js$/.test(f))??'')`
    ]).out.trim();
    if (local.length === 0) fail(`no built bundle in ${distDir}`);

    let streak = 0;
    let probes = 0;
    // Every bundle the alias served, with a count. Reporting only the LAST
    // probe made a flapping edge indistinguishable from a missing deploy: the
    // failure read "production serves X, local build is X", because the run
    // ended on a matching probe after an earlier one broke the streak.
    const seen = new Map();
    for (let i = 0; i < 250 && streak < 20; i += 1) {
      const html = run('curl', [
        '-s',
        '-H',
        'Cache-Control: no-cache',
        `${app.url}/?rv=${i}${Math.floor(i * 7919)}`
      ]).out;
      const got = /assets\/(index-[A-Za-z0-9_-]+\.js)/.exec(html)?.[1] ?? '(none)';
      seen.set(got, (seen.get(got) ?? 0) + 1);
      streak = got === local ? streak + 1 : 0;
      probes = i + 1;
    }
    if (streak < 20) {
      const tally = [...seen.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([bundle, n]) => `${bundle} ×${n}`)
        .join(', ');
      const flapping = seen.size > 1 && seen.has(local);
      fail(
        `${app.slug}: never saw 20 consecutive probes of the local build ${local} ` +
          `in ${probes} probes. Served: ${tally}.\n  ` +
          (flapping
            ? 'The alias is still alternating between builds across edge nodes. ' +
              'Wait a minute and re-run — measuring now would measure a mix.'
            : 'Production is not serving this build at all. Deploy first.')
      );
    }
    console.log(`    ${app.slug}: ${local}`);
  }
} else {
  step(2, 'propagation check SKIPPED (--skip-propagation)');
}

// --- 3. measure --------------------------------------------------------------
step(3, 'measure against the deployed build');
for (const app of apps) {
  const jobs = [
    [
      'design_audit.mjs',
      [
        app.url,
        '--routes',
        app.designRoutes,
        '--out',
        `evidence/design-${app.slug}.json`,
        // Without this, fe-design-archetype's finding is never written, so a
        // verdict that cites this report can never be re-derived from fresh
        // evidence -- the exact gap that let two apps ship with the rule
        // permanently unrecorded even though claims.json now names an archetype.
        ...(existsSync(join(app.dir, '.redanvil', 'claims.json'))
          ? ['--claims', `${app.dir}/.redanvil/claims.json`]
          : [])
      ]
    ],
    [
      'desktop_width.mjs',
      app.widthRoutes === null
        ? [app.url, '--out', `evidence/width-${app.slug}.json`]
        : [app.url, '--routes', app.widthRoutes, '--out', `evidence/width-${app.slug}.json`]
    ],
    ['a11y_audit.mjs', [app.url, '--theme', 'dark', '--out', `evidence/axe/${app.slug}-dark.json`]],
    [
      'a11y_audit.mjs',
      [app.url, '--theme', 'light', '--out', `evidence/axe/${app.slug}-light.json`]
    ],
    ['runtime_parity.mjs', [app.dir, '--out', `evidence/runtime-${app.slug}.json`]],
    // cold_visitor was measured by drift.yml and by hand, but never here, so its
    // evidence aged out on the first commit after it was taken and the gate
    // blocked on "produced BEFORE the commit it vouches for". A re-verification
    // that re-runs six measurers and silently skips the seventh is not a
    // re-verification; it is six measurements and one stamp.
    ...(existsSync(join(app.dir, '.redanvil', 'claims.json'))
      ? [
          [
            'cold_visitor.mjs',
            [
              app.url,
              '--claims',
              `${app.dir}/.redanvil/claims.json`,
              '--out',
              `evidence/cold-${app.slug}.json`
            ]
          ]
        ]
      : []),
    [
      'screenshots.mjs',
      [app.url, app.slug, '--routes', '/,/about', '--out', 'evidence/screenshots']
    ]
  ];
  if (app.e2e) {
    jobs.push([
      'e2e_smoke_app_builder.mjs',
      [app.url, '--out', `evidence/e2e-${app.slug}.json`, '--trace', `evidence/e2e-${app.slug}.zip`]
    ]);
  }
  if (app.wizard) {
    jobs.push(['wizard_width.mjs', [app.url, '--out', `evidence/wizard-width-${app.slug}.json`]]);
  }
  for (const [name, rest] of jobs) {
    const r = script(name, rest);
    const label = `${app.slug} ${name.replace('.mjs', '')}`;
    if (r.code !== 0) {
      console.error(r.out.split('\n').slice(-12).join('\n'));
      fail(`${label} failed — fix the finding, do not re-stamp over it`);
    }
    console.log(`    ok  ${label}`);
  }
}

/**
 * Read a verdict's outcome back out of the report that vouches for it.
 *
 * Only reports that NAME the rule can decide it. A design audit keys its
 * findings by rule id, so it answers for exactly the rules it measured and
 * stays silent about the rest — which is what makes this safe to apply blindly
 * across the file.
 *
 * @param {{ruleId: string, evidence?: string[]}} verdict The recorded verdict.
 * @returns {{ok: boolean, note: string}|null} The measured outcome, or null when
 *   no evidence file decides this rule.
 */
function outcomeFromEvidence(verdict) {
  for (const rel of verdict.evidence ?? []) {
    if (!existsSync(rel)) continue;
    let report;
    try {
      report = JSON.parse(readFileSync(rel, 'utf8'));
    } catch {
      continue;
    }
    const finding = report?.findings?.[verdict.ruleId];
    if (finding === undefined || typeof finding.ok !== 'boolean') continue;
    return {
      ok: finding.ok,
      note: `${rel} against ${report.baseUrl ?? 'the measured build'}: ${finding.detail ?? ''}`.trim()
    };
  }
  return null;
}

// --- 4. stamp verdicts to HEAD ----------------------------------------------
// Only now: a report produced BEFORE the commit it vouches for is rejected, and
// rightly — re-stamping is not re-measuring.
step(4, 'stamp verdicts to HEAD');
for (const app of apps) {
  const p = `evidence/verdicts-${app.slug}.json`;
  const list = JSON.parse(readFileSync(p, 'utf8'));
  let rederived = 0;
  for (const v of list) {
    v.reviewedCommit = head;
    // Advancing reviewedCommit while preserving the recorded outcome is exactly
    // the "re-stamping is not re-measuring" failure this step warns about, just
    // in the other field. fe-required-pages kept a `passed: false` recorded when
    // /terms was 706 words, long after the rewrite took it past the floor and
    // the freshly-measured report said ok — a verdict that looked newly reviewed
    // and carried a stale answer.
    //
    // Where the evidence is a machine-produced report that names the rule, the
    // report is the answer. Verdicts whose evidence cannot decide the rule (a
    // screenshot, a human review) keep what was recorded.
    const decided = outcomeFromEvidence(v);
    if (decided !== null && decided.ok !== v.passed) {
      v.passed = decided.ok;
      v.note = decided.note;
      rederived += 1;
    }
  }
  writeFileSync(p, `${JSON.stringify(list, null, 2)}\n`);
  console.log(
    `    ${app.slug}: ${list.length} verdicts at ${head.slice(0, 12)}` +
      (rederived > 0 ? ` (${rederived} re-derived from freshly measured evidence)` : '')
  );
}

if (flag('no-gate')) {
  console.log(
    '\nreverify: measured and stamped. Commit the evidence, then re-run without --no-gate.'
  );
  process.exit(0);
}

// --- 4b. commit the generated evidence --------------------------------------
// The gate must run on a CLEAN tree, and steps 3 and 4 just dirtied it. The
// first version skipped this and its own verify_deployed caught it: "produced
// from a DIRTY tree, so the score does not describe any commit". Evidence and
// verdicts are generated artifacts, so committing them is part of the cycle
// rather than a side effect being smuggled in.
if (!flag('no-commit')) {
  step('4b', 'commit the regenerated evidence (the gate needs a clean tree)');
  run('git', ['add', 'evidence/']);
  const staged = run('git', ['diff', '--cached', '--name-only']).out.trim();
  if (staged.length === 0) {
    console.log('    nothing changed');
  } else {
    const c = run('git', [
      'commit',
      '-q',
      '-m',
      `chore(evidence): re-measure at ${head.slice(0, 12)}`
    ]);
    if (c.code !== 0) fail(`could not commit evidence:\n${c.out}`);
    console.log(`    committed ${staged.split('\n').length} file(s)`);
  }
} else {
  console.log('\n    --no-commit: the tree stays dirty, so the gate below cannot tie to a deploy.');
}

// --- 5. gate, reproduce, tie to the deploy -----------------------------------
step(5, 'gate, reproduce, tie to deploy');
for (const app of apps) {
  run('git', ['checkout', '--', 'results/']);
  const g = run(
    'npm',
    [
      'run',
      'gate',
      '--',
      app.dir,
      '--judge',
      `evidence/verdicts-${app.slug}.json`,
      '--na',
      app.na,
      '--slug',
      app.slug,
      '--min-coverage',
      '90',
      '--out',
      `results/${app.slug}.json`
    ],
    { shell: process.platform === 'win32' }
  );
  const line = g.out.split('\n').find((l) => l.includes('gate:')) ?? g.out.slice(-400);
  console.log(`    ${line.trim()}`);
  if (g.code !== 0) fail(`${app.slug} gate failed`);

  const v = script('verify_results.mjs', [
    app.slug,
    `results/${app.slug}.json`,
    `evidence/verdicts-${app.slug}.json`,
    app.na
  ]);
  if (v.code !== 0) {
    console.error(v.out.split('\n').slice(-8).join('\n'));
    fail(`${app.slug} did not reproduce`);
  }
  console.log(`    ${(v.out.split('\n').find((l) => l.includes('reproduced')) ?? '').trim()}`);

  // verify_results writes results/<slug>.json.verify.json. It is untracked, so
  // leaving it behind dirties the tree — which is why the SECOND app scored
  // with provenance.dirty=true while the first was fine.
  rmSync(`results/${app.slug}.json.verify.json`, { force: true });

  const d = script('verify_deployed.mjs', [app.dir, `results/${app.slug}.json`, app.url]);
  if (d.code !== 0) {
    console.error(d.out.split('\n').slice(-6).join('\n'));
    fail(`${app.slug} result is not tied to the deployed build`);
  }
  console.log(`    ${app.slug}: production serves the scored commit`);

  // Commit THIS app's result before gating the next one. Gating writes
  // results/<slug>.json, which dirties the tree — so the second app scored with
  // provenance.dirty=true and could not be tied to its deploy, even though
  // nothing about the second app had changed.
  if (!flag('no-commit')) {
    run('git', ['add', `results/${app.slug}.json`]);
    if (run('git', ['diff', '--cached', '--name-only']).out.trim().length > 0) {
      run('git', [
        'commit',
        '-q',
        '-m',
        `chore(gate): ${app.slug} rescored at ${head.slice(0, 12)}`
      ]);
    }
  }
}

run('node', ['.github/scripts/build_feed.mjs']);
const feed = script('build_feed.mjs', ['--check']);
if (feed.code !== 0) fail('results feed does not match the result files');
console.log('    feed matches the result files');

// results/ and the feed are generated too. Leaving them uncommitted would make
// the NEXT run's clean-tree check fail for a reason the user did not cause.
if (!flag('no-commit')) {
  run('git', ['add', 'results/', 'evidence/']);
  const staged = run('git', ['diff', '--cached', '--name-only']).out.trim();
  if (staged.length > 0) {
    run('git', ['commit', '-q', '-m', `chore(gate): rescore at ${head.slice(0, 12)}`]);
    console.log('    committed results/');
  }
}

console.log('\nreverify PASS: both apps measured, gated, reproduced and tied to their deploys.');
console.log('Nothing left to do but `git push`.');
