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
import { writeFileSync } from 'node:fs';
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
if (judgeFails.length === 0) {
  // Never print a green sentence over a zero. The number IS the finding, and
  // dressing it as a pass is exactly the dishonesty this whole gate exists to
  // stop.
  console.log(
    `\njudge dissent: ZERO recorded disagreements in ${judged.length} judge verdicts. ` +
      `Reported, not enforced — the fix is an independent reviewer, not a threshold.`
  );
} else {
  console.log(
    `\njudge dissent PASS: ${judgeFails.length} recorded disagreement(s) in ${judged.length} judge verdicts`
  );
}
