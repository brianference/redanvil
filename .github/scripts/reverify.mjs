#!/usr/bin/env node
/**
 * Re-measure, re-stamp and re-gate both apps, in the only order that works.
 *
 * A visual verdict that recorded a bundle hash is about the built page: it goes
 * stale when that build changes, not when an unrelated source file does. A
 * judge verdict goes stale when a file in its scope changes. This script
 * re-measures or re-judges only the rules that are stale, and says which and
 * why. Re-stamping a fresh verdict is the treadmill this exists to stop.
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
import { waiversForApp } from './meets_the_bar.mjs';
import {
  bundleHashOfApp,
  changedFilesSince,
  formatStaleLines,
  isBundleBound,
  measurersForStale,
  scopeForVerdict,
  verdictStaleReason
} from '../../orchestrator/scripts/lib/verdict-freshness.mjs';

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

/** Script name → measurer id used by measurersForStale. */
const MEASURER_BY_SCRIPT = {
  'design_audit.mjs': 'design_audit',
  'desktop_width.mjs': 'desktop_width',
  'a11y_audit.mjs': 'a11y',
  'runtime_parity.mjs': 'runtime_parity',
  'cold_visitor.mjs': 'cold_visitor',
  'screenshots.mjs': 'screenshots',
  'e2e_smoke_app_builder.mjs': 'e2e',
  'wizard_width.mjs': 'wizard_width'
};

/**
 * Which recorded verdicts no longer describe the build or the files they named.
 *
 * @param {{slug: string, dir: string}} app App being reverified.
 * @returns {{
 *   stale: Array<{ruleId: string, method?: string, evidence?: string[], reason: string}>,
 *   bundleHash: string | null,
 *   plan: ReturnType<typeof measurersForStale>
 * }}
 */
function classifyApp(app) {
  const verdictPath = `evidence/verdicts-${app.slug}.json`;
  const bundleHash = bundleHashOfApp(app.dir);
  if (!existsSync(verdictPath)) {
    return { stale: [], bundleHash, plan: measurersForStale(app.slug, []) };
  }
  const list = JSON.parse(readFileSync(verdictPath, 'utf8'));
  const stale = [];
  for (const verdict of list) {
    const bound = isBundleBound(verdict);
    // Bundle-bound visual verdicts do not consult the source tree.
    const changed = bound
      ? null
      : changedFilesSince(
          process.cwd(),
          verdict.reviewedCommit,
          scopeForVerdict(verdict, app.dir)
        );
    const decision = verdictStaleReason(verdict, {
      changedFiles: changed,
      currentBundleHash: bundleHash
    });
    if (!decision.stale) continue;
    stale.push({
      ruleId: verdict.ruleId,
      method: verdict.method,
      evidence: verdict.evidence,
      reason: decision.reason
    });
  }
  return { stale, bundleHash, plan: measurersForStale(app.slug, stale) };
}

/** @type {Map<string, ReturnType<typeof classifyApp>>} */
const plans = new Map();

// --- 3. measure only what went stale -----------------------------------------
step(3, 're-measure only rules whose verdicts are stale');
for (const app of apps) {
  const classified = classifyApp(app);
  plans.set(app.slug, classified);
  if (classified.stale.length === 0) {
    console.log(`    ${app.slug}: no stale verdicts — not re-measuring`);
    continue;
  }
  console.log(`    ${app.slug}: ${classified.stale.length} stale verdict(s)`);
  for (const line of formatStaleLines(classified.stale)) {
    console.log(`      ${line}`);
  }
  if (classified.plan.unmapped.length > 0) {
    fail(
      `${app.slug}: stale verdict(s) cite evidence this script cannot re-measure: ` +
        classified.plan.unmapped.map((row) => `${row.ruleId} (${row.reason})`).join('; ') +
        '. Not re-stamped.'
    );
  }
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
    const label = `${app.slug} ${name.replace('.mjs', '')}`;
    const measurer = MEASURER_BY_SCRIPT[name];
    if (!classified.plan.measurers.includes(measurer)) {
      console.log(`    skip ${label} — no stale verdict cites it`);
      continue;
    }
    const r = script(name, rest);
    if (r.code !== 0) {
      // A measurer that only found WAIVED defects must not hard-stop the run.
      // Otherwise a recorded, dated, accepted defect keeps the gate from ever
      // producing a result, the stored finalScore stays 0, and lg-shipped fails
      // on a score that nothing can raise — the whole point of the waiver is to
      // let an unrelated release proceed, and a hard stop here defeats it.
      // The finding is still printed, and meets_the_bar still reports it WAIVED.
      const failedHere = [...r.out.matchAll(/FAIL\s+([a-z0-9-]+)/gi)].map((m) => m[1]);
      const waivedHere = waiversForApp(process.cwd(), app.slug);
      const unwaived = failedHere.filter((id) => !waivedHere.has(id));
      if (failedHere.length > 0 && unwaived.length === 0) {
        console.error(r.out.split('\n').slice(-8).join('\n'));
        console.log(
          `    WAIVED ${label} — only accepted defects failed: ${failedHere.join(', ')}`
        );
        continue;
      }
      console.error(r.out.split('\n').slice(-12).join('\n'));
      fail(`${label} failed — fix the finding, do not re-stamp over it`);
    }
    console.log(`    ok  ${label}`);
  }
  if (classified.plan.judgeRuleIds.length > 0) {
    console.log(`    ${app.slug}: re-judge ${classified.plan.judgeRuleIds.join(', ')}`);
    const judge = script('independent_judge.mjs', [
      app.dir,
      '--rules',
      classified.plan.judgeRuleIds.join(','),
      '--engine',
      'claude',
      '--out',
      `evidence/judge-independent-${app.slug}.json`
    ]);
    if (judge.code !== 0) {
      console.error(judge.out.split('\n').slice(-12).join('\n'));
      fail(
        `${app.slug}: independent judge failed — stale judge verdicts were not re-stamped`
      );
    }
    console.log(`    ok  ${app.slug} independent_judge`);
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

// --- 3b. re-record the a11y-contrast provenance -----------------------------
// fe-a11y-contrast is a visual-lane rule with no self-recording check script, so
// its measurement-meta entry is written separately. Step 3 has just regenerated
// evidence/axe/<slug>-{dark,light}.json with fresh checkedAt values, which makes
// any previously recorded entry stale against meas-standard-tool's report
// binding. Re-record HERE — after the audits, before the gate scores them —
// otherwise the entry can never be current at scoring time and the rule fails on
// every run no matter how honest the measurement was.
const a11yApps = apps.filter((app) => plans.get(app.slug)?.plan.measurers.includes('a11y'));
if (a11yApps.length === 0) {
  step('3b', 'a11y-contrast provenance skipped — fe-a11y-contrast is not stale');
} else {
step('3b', 'record the a11y-contrast provenance against the reports just produced');
for (const app of a11yApps) {
  const rec = run(process.execPath, [
    'orchestrator/scripts/checks/record-a11y-contrast.mjs',
    app.dir,
    app.slug
  ]);
  if (rec.code !== 0) {
    console.error(rec.out.split('\n').slice(-8).join('\n'));
    fail(
      `${app.slug} record-a11y-contrast failed — the axe reports exist but their provenance was not recorded`
    );
  }
  console.log(`    ok  ${app.slug} a11y-contrast provenance`);
}
}

/**
 * The newest commit that changed what this app RENDERS.
 *
 * Verdicts used to be stamped to repo HEAD, which made them stale on every
 * unrelated commit — including the evidence commit this very script makes at
 * step 4b. Step 3 only regenerates evidence for the seven rules in its own
 * measurement suite, so any judge-tier rule with hand-written evidence had its
 * reviewedCommit advanced without its evidence being re-produced, and failed
 * automatically on every pass. Six re-judgements in one session never converged.
 *
 * A verdict reviews an APP, so it is pinned to the last commit that could have
 * changed that app: its own directory plus the shared design system, with
 * evidence/results/verdicts excluded because writing evidence is not a change to
 * the subject under review.
 *
 * Still falsifiable, and this is the point: touch the app's source and this
 * returns a NEWER commit, so evidence that predates it is correctly rejected.
 *
 * @param {string} appDir Application directory.
 * @returns {string} Commit sha, or HEAD when nothing matches.
 */
function lastSourceCommit(appDir) {
  const r = run('git', [
    'log',
    '--format=%H',
    '-n',
    '1',
    '--',
    appDir,
    'design-system',
    `:(exclude)${appDir}/evidence`,
    `:(exclude)${appDir}/results`,
    `:(exclude)${appDir}/verdicts`,
    ':(exclude)*measurement-meta.json',
    ':(exclude)*coverage-state.json'
  ]);
  const sha = r.out.split('\n').map((s) => s.trim()).filter(Boolean)[0];
  return sha !== undefined && /^[0-9a-f]{40}$/.test(sha) ? sha : head;
}

/**
 * Judge rows from the independent-judge report, keyed by rule id.
 *
 * A row with an empty scope is omitted. Recording it would either fail the
 * schema or silently mean "the whole app".
 *
 * @param {string} reportPath Report written by independent_judge.mjs.
 * @returns {Map<string, {passed: boolean, note: string, evidence: string[], scope: string[]}>}
 */
function judgeUpdatesFromReport(reportPath) {
  const updates = new Map();
  if (!existsSync(reportPath)) return updates;
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  for (const row of report.verdicts ?? []) {
    if (typeof row?.ruleId !== 'string') continue;
    if (!Array.isArray(row.scope) || row.scope.length === 0) continue;
    if (!Array.isArray(row.evidence) || row.evidence.length === 0) continue;
    updates.set(row.ruleId, {
      passed: row.passed === true,
      note: String(row.note ?? ''),
      evidence: row.evidence,
      scope: row.scope
    });
  }
  return updates;
}

// --- 4. stamp only the verdicts that were just re-measured or re-judged ------
// A fresh verdict keeps its reviewedCommit. Moving it forward without new
// evidence is the re-stamp treadmill.
step(4, 'stamp only the verdicts that were re-measured or re-judged');
for (const app of apps) {
  const p = `evidence/verdicts-${app.slug}.json`;
  // A first-time app has no verdicts yet, and reverify crashed with ENOENT
  // rather than saying so -- the managed-app path could produce an app the
  // gate could not even attempt. An empty list is the honest starting state:
  // nothing recorded, so nothing earns credit, and fail-closed still applies.
  if (!existsSync(p)) {
    writeFileSync(p, '[]\n');
    console.log(`    created ${p} — first run for this app, no verdicts recorded yet`);
    continue;
  }
  const classified = plans.get(app.slug) ?? classifyApp(app);
  const staleIds = new Set(classified.stale.map((row) => row.ruleId));
  if (staleIds.size === 0) {
    console.log(`    ${app.slug}: nothing stale — verdicts left untouched`);
    continue;
  }
  const list = JSON.parse(readFileSync(p, 'utf8'));
  const stampTo = lastSourceCommit(app.dir);
  const judgeUpdates = judgeUpdatesFromReport(`evidence/judge-independent-${app.slug}.json`);
  let rederived = 0;
  let stamped = 0;
  for (const v of list) {
    if (!staleIds.has(v.ruleId)) continue;
    if (v.method === 'judge') {
      const update = judgeUpdates.get(v.ruleId);
      if (update === undefined) {
        fail(
          `${app.slug}: ${v.ruleId} is stale but the judge returned no scope — not re-stamped`
        );
      }
      v.passed = update.passed;
      if (update.note.length >= 3) v.note = update.note;
      v.evidence = update.evidence;
      v.scope = update.scope;
      v.schemaVersion = 2;
      v.reviewedCommit = stampTo;
      v.reviewedAt = new Date().toISOString();
      stamped += 1;
      continue;
    }
    v.reviewedCommit = stampTo;
    // Bind the re-measured visual verdict to this build. No hash means the
    // dist was missing; leave the field absent so the source-tree check remains.
    if (classified.bundleHash !== null) v.bundleHash = classified.bundleHash;
    // Where the evidence is a machine-produced report that names the rule, the
    // report is the answer. Verdicts whose evidence cannot decide the rule (a
    // screenshot, a human review) keep what was recorded.
    const decided = outcomeFromEvidence(v);
    if (decided !== null && decided.ok !== v.passed) {
      v.passed = decided.ok;
      v.note = decided.note;
      rederived += 1;
    }
    stamped += 1;
  }
  writeFileSync(p, `${JSON.stringify(list, null, 2)}\n`);
  console.log(
    `    ${app.slug}: stamped ${stamped} stale verdict(s) at ${stampTo.slice(0, 12)}` +
      ` (${list.length - stamped} left untouched)` +
      (classified.bundleHash !== null ? `, bundle ${classified.bundleHash.slice(0, 12)}` : ', no bundle hash') +
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
  if (g.code !== 0) {
    // The gate WROTE results/<slug>.json before deciding it was below the bar,
    // and results/all.json is derived from those files. Bailing out here left
    // the feed describing the previous scores, which broke the CI feed check on
    // the next push -- twice, both times hours after the re-gate that caused it,
    // both times looking like an unrelated failure. The rebuild downstream of
    // this line only ever ran when the gate PASSED, which is the one case where
    // the feed was least likely to be wrong.
    run('node', ['.github/scripts/build_feed.mjs']);
    fail(`${app.slug} gate failed`);
  }

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
