#!/usr/bin/env node
/**
 * Report how often the judge tier has ever disagreed.
 *
 * Third-audit finding #4. Nineteen judge-method verdicts across two apps, and
 * every current one passes. Two commits in the repo's whole history recorded a
 * judge FAIL. That is not proof of rubber-stamping — the code may be clean — but
 * a tier that has dissented twice in its lifetime carries weak signal, and
 * nothing measured its dissent rate at all.
 *
 * This measures it from git history so the number is real, and fails when the
 * rate over the recorded window is below a floor: a judge that never says no is
 * indistinguishable from no judge.
 *
 * Usage: node judge_dissent.mjs [--min-fails N] [--out report.json]
 */
import { writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1];
};
// Default 0 = REPORT, do not fail. The measured answer today is zero dissent in
// 258 verdicts, and the honest response to that is to publish the number, not to
// manufacture a disagreement so a check goes green. Raise the floor to 1 once
// the judge tier has genuinely rejected something.
const minFails = Number(flag('min-fails', '0'));
/**
 * Apps that should each have an independent review. Listed explicitly so a new
 * app cannot quietly join the repo with only self-recorded verdicts.
 */
const APPS = ['app-builder', 'dashboard'];
/**
 * How far an independent review may drift behind HEAD before it is called stale.
 * Reported, not enforced — `grok` authenticates interactively, so the reviewer
 * cannot run in CI and a hard failure here would only block on something CI is
 * unable to fix.
 */
const MAX_COMMITS_BEHIND = Number(flag('max-commits-behind', '40'));
const outPath = flag('out', null);

/** Run git, returning stdout or ''. */
const git = (a) =>
  spawnSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout ?? '';

const files = ['evidence/verdicts-app-builder.json', 'evidence/verdicts-dashboard.json'];
const seen = new Map();
let revisions = 0;

for (const file of files) {
  const commits = git(['log', '--format=%H', '--', file])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const commit of commits) {
    const raw = git(['show', `${commit}:${file}`]);
    if (raw.trim().length === 0) continue;
    let list;
    try {
      list = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!Array.isArray(list)) continue;
    revisions += 1;
    for (const v of list) {
      if (typeof v?.ruleId !== 'string') continue;
      const key = `${file}:${v.ruleId}:${v.reviewedCommit ?? ''}:${v.passed}`;
      if (seen.has(key)) continue;
      seen.set(key, { file, ruleId: v.ruleId, method: v.method, passed: v.passed === true });
    }
  }
}

// Independent judge runs: the same rules re-decided by a reviewer that did not
// write the code and could not see the verdict file it was re-deciding. These
// are counted separately on purpose. Folding them into the self-recorded total
// would hide the very asymmetry this script exists to publish — the point is
// that the two populations have wildly different failure rates.
/** @type {{ file: string, reviewedCommit: string, judged: number, failed: number, confirmed: number }[]} */
const independent = [];
for (const file of readdirSync('evidence').filter((f) => /^judge-independent-.*\.json$/.test(f))) {
  const path = join('evidence', file);
  let report;
  try {
    report = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    continue;
  }
  const list = Array.isArray(report?.verdicts) ? report.verdicts : [];
  if (list.length === 0) continue;
  // How long ago was that commit? An independent review is evidence about the
  // tree it read, and this repo moves fast — a report from 200 commits back is
  // history, not assurance.
  const commit = String(report.reviewedCommit ?? '');
  const behind =
    commit.length > 0
      ? Number((git(['rev-list', '--count', `${commit}..HEAD`]) || '').trim() || Number.NaN)
      : Number.NaN;
  independent.push({
    file: path.replace(/\\/g, '/'),
    reviewedCommit: commit.slice(0, 12),
    commitsBehindHead: Number.isFinite(behind) ? behind : null,
    judged: list.length,
    failed: list.filter((v) => v?.passed === false).length,
    confirmed: list.filter((v) => v?.adjudication === 'confirmed').length
  });
}

const all = [...seen.values()];
const judged = all.filter((v) => v.method === 'judge');
const visual = all.filter((v) => v.method === 'visual');
const judgeFails = judged.filter((v) => !v.passed);
const visualFails = visual.filter((v) => !v.passed);

const report = {
  checkedAt: new Date().toISOString(),
  verdictFileRevisions: revisions,
  distinctJudgeVerdicts: judged.length,
  judgeFails: judgeFails.length,
  judgeDissentRate: judged.length > 0 ? Number((judgeFails.length / judged.length).toFixed(4)) : 0,
  distinctVisualVerdicts: visual.length,
  visualFails: visualFails.length,
  failedRuleIds: [...new Set([...judgeFails, ...visualFails].map((v) => v.ruleId))],
  independentRuns: independent,
  independentJudged: independent.reduce((n, r) => n + r.judged, 0),
  independentFails: independent.reduce((n, r) => n + r.failed, 0),
  independentConfirmed: independent.reduce((n, r) => n + r.confirmed, 0),
  minFails,
  ok: judgeFails.length >= minFails
};
if (outPath !== null) writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`verdict-file revisions inspected : ${revisions}`);
console.log(`distinct judge verdicts          : ${judged.length}`);
console.log(`judge FAILs ever recorded        : ${judgeFails.length}`);
console.log(`judge dissent rate               : ${(report.judgeDissentRate * 100).toFixed(1)}%`);
console.log(`distinct visual verdicts         : ${visual.length} (${visualFails.length} fails)`);
if (report.failedRuleIds.length > 0)
  console.log(`rules ever failed                : ${report.failedRuleIds.join(', ')}`);

if (!report.ok) {
  console.error(
    `\njudge dissent FAIL: ${judgeFails.length} recorded FAIL(s), floor is ${minFails}. ` +
      `A judge tier that has never said no is indistinguishable from no judge tier.`
  );
  process.exit(1);
}
if (report.independentJudged > 0) {
  console.log(
    `\nindependent judge runs           : ${independent.length} ` +
      `(${report.independentJudged} rules judged, ${report.independentFails} FAILs, ` +
      `${report.independentConfirmed} confirmed on follow-up)`
  );
  for (const run of independent) {
    const age =
      run.commitsBehindHead === null ? '' : `, ${run.commitsBehindHead} commit(s) behind HEAD`;
    console.log(
      `  ${run.file} @ ${run.reviewedCommit}: ${run.failed}/${run.judged} failed, ` +
        `${run.confirmed} confirmed${age}`
    );
  }
  // Apps that have never been reviewed by anyone but their own author.
  const reviewed = new Set(
    independent.map((r) => /judge-independent-(.+)\.json$/.exec(r.file)?.[1]).filter(Boolean)
  );
  const unreviewed = APPS.filter((a) => !reviewed.has(a));
  if (unreviewed.length > 0) {
    console.log(`  NEVER independently judged: ${unreviewed.join(', ')}`);
  }
  const stalest = independent
    .map((r) => r.commitsBehindHead)
    .filter((n) => typeof n === 'number')
    .sort((a, b) => b - a)[0];
  if (typeof stalest === 'number' && stalest > MAX_COMMITS_BEHIND) {
    console.log(
      `  STALE: the oldest independent review is ${stalest} commits behind HEAD ` +
        `(threshold ${MAX_COMMITS_BEHIND}). Re-run: node .github/scripts/independent_judge.mjs <app>`
    );
  }
  const selfRate = judged.length > 0 ? judgeFails.length / judged.length : 0;
  const indRate = report.independentFails / report.independentJudged;
  console.log(
    `  self-recorded dissent ${(selfRate * 100).toFixed(1)}% vs independent ${(indRate * 100).toFixed(1)}% ` +
      `— the gap, not either number, is the finding.`
  );
}
if (judgeFails.length === 0) {
  // Never print a green sentence over a zero. The number IS the finding, and
  // dressing it as a pass is exactly the dishonesty this whole gate exists to
  // stop.
  console.log(
    `\njudge dissent: ZERO disagreements in ${judged.length} SELF-RECORDED judge verdicts. ` +
      `Reported, not enforced — the fix is an independent reviewer, not a threshold, ` +
      `and independent runs are counted separately above.`
  );
} else {
  console.log(
    `\njudge dissent PASS: ${judgeFails.length} recorded disagreement(s) in ${judged.length} judge verdicts`
  );
}
