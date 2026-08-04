#!/usr/bin/env node
/**
 * Produce evidence/judge-diff-<slug>.json for the independent judge-over-diff
 * finish-line row (F5 / isDone.independentReviewOk).
 *
 * Modeled on independent_judge.mjs (disposable worktree, scrubbed env, grok
 * as the independent reviewer) but reviews the DIFF, not a fixed rule list.
 * The decision + report shape live in ONE place:
 *   orchestrator/src/loop/independentReview.ts
 * This driver never hand-authors a passing report — it runs the reviewer and
 * records what came back, findings and all.
 *
 * Usage:
 *   node judge_diff.mjs <appDir> [--out evidence/judge-diff-<slug>.json]
 *                                [--timeout 600] [--repo-root <path>]
 *
 * Exit 0 when a report was written and the review completed (ok may still be
 * false — unresolved findings are recorded, not papered over).
 * Exit 1 when the reviewer could not be run or did not complete.
 * Exit 2 on usage error.
 */
import { writeFileSync, existsSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join, basename, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, '..', '..');
const HELPER = join(REPO_ROOT, 'orchestrator', 'scripts', 'team', 'judge-diff-run.mts');

const args = process.argv.slice(2);
const appDirArg = args[0];
if (appDirArg === undefined || appDirArg.startsWith('--')) {
  console.error(
    'usage: node judge_diff.mjs <appDir> [--out f.json] [--timeout 600] [--repo-root path]'
  );
  process.exit(2);
}

/**
 * Read a `--name value` flag.
 *
 * @param {string} name
 * @param {string | undefined} fallback
 * @returns {string | undefined}
 */
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const appDir = resolve(appDirArg);
const slug = basename(appDir);
const repoRoot = resolve(flag('repo-root', REPO_ROOT));
const outPath = resolve(
  flag('out', join(repoRoot, 'evidence', `judge-diff-${slug}.json`))
);
const timeoutSec = Number(flag('timeout', '600'));

/**
 * Run a command, returning {code, stdout, stderr}.
 *
 * @param {string} cmd
 * @param {string[]} cmdArgs
 * @param {import('node:child_process').SpawnSyncOptions} [opts]
 */
const run = (cmd, cmdArgs, opts = {}) => {
  const r = spawnSync(cmd, cmdArgs, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...opts
  });
  return { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};

const head = run('git', ['rev-parse', 'HEAD'], { cwd: appDir }).stdout.trim();
if (head.length === 0) {
  console.error('judge_diff FAIL: not a git repository (or HEAD unreadable)');
  process.exit(1);
}

// Disposable worktree: the reviewer gets a clean checkout of HEAD so nothing
// it does can reach the working tree, matching independent_judge.mjs.
const wt = mkdtempSync(join(tmpdir(), 'redanvil-judge-diff-'));
const worktreePath = join(wt, 'tree');
const added = run('git', ['worktree', 'add', '--detach', worktreePath, head], {
  cwd: repoRoot
});
if (added.code !== 0) {
  console.error(`judge_diff FAIL: could not create worktree\n${added.stderr}`);
  process.exit(1);
}

/**
 * Remove the worktree. Junctions are unlinked first (same hazard as
 * independent_judge.mjs): `git worktree remove` must not follow a junction
 * into a real node_modules.
 */
function cleanup() {
  const nm = join(worktreePath, 'node_modules');
  if (existsSync(nm) && process.platform === 'win32') {
    run('cmd', ['/c', 'rmdir', nm]);
  }
  run('git', ['worktree', 'remove', '--force', worktreePath], { cwd: repoRoot });
  run('git', ['worktree', 'prune'], { cwd: repoRoot });
  try {
    rmSync(wt, { recursive: true, force: true });
  } catch {
    /* temp dir may hold locked handles; harmless */
  }
}

// Review the app path inside the worktree when it exists there; otherwise the
// worktree root (monorepo app dirs like dashboard/, app-builder/).
const appRel = appDir.startsWith(repoRoot)
  ? appDir.slice(repoRoot.length).replace(/^[/\\]/, '')
  : '';
const reviewDir =
  appRel.length > 0 && existsSync(join(worktreePath, appRel))
    ? join(worktreePath, appRel)
    : worktreePath;

// A judge must not review its own previous output. The disposable worktree
// carries the committed evidence/judge-diff-<slug>.json from earlier runs, and
// the first live run spent all six of its findings on that artifact -- stale
// hashes and commit mismatches in a file about to be overwritten -- instead of
// on the app. Remove it inside the throwaway worktree only; the real repo copy
// is untouched and is rewritten by this run.
const priorReport = join(worktreePath, 'evidence', `judge-diff-${slug}.json`);
if (existsSync(priorReport)) {
  rmSync(priorReport, { force: true });
}

console.log(`judge_diff: ${slug} @ ${head.slice(0, 12)} (worktree ${reviewDir})`);

// Credentials must not reach the independent reviewer.
const scrubbed = { ...process.env };
for (const k of Object.keys(scrubbed)) {
  if (/TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL/i.test(k)) delete scrubbed[k];
}

// Call the ONE decision implementation via tsx — never reimplement ok/findings
// logic here. Out path is absolute under the real repo so the evidence file
// lands where loadProductJudgementOpts / productJudgement look for it.
mkdirSync(dirname(outPath), { recursive: true });

// Review the RELEASE range for THIS app, not just HEAD.
//
// HEAD is frequently a merge or an evidence commit, and the first real run said
// so itself: it reported its input as "a self-referential judge meta-review,
// not a code-diff review", because the newest commit touching that app was a
// JSON evidence file. F5 asks whether an independent judge reviewed the diff of
// what is shipping, so the range is what the push would publish, path-scoped to
// the app so one app's judge is not handed the other apps' changes.
//
// Base ref resolution order:
//   1. --diff-range (explicit)
//   2. @{upstream} when configured
//   3. origin/master or origin/main when present (feature/worktree branches
//      often have no upstream but still need the release-sized range)
//   4. otherwise fall back to HEAD-only (prior behaviour)
const explicitRange = flag('diff-range', undefined);
const releaseBase = (() => {
  if (explicitRange !== undefined) return null; // range fully specified
  const up = run('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], {
    cwd: repoRoot
  });
  const upName = (up.stdout ?? '').trim();
  if (up.code === 0 && upName.length > 0) return upName;
  for (const cand of ['origin/master', 'origin/main']) {
    const c = run('git', ['rev-parse', '--verify', cand], { cwd: repoRoot });
    if (c.code === 0 && (c.stdout ?? '').trim().length > 0) return cand;
  }
  return null;
})();

// Paths the judge must see for THIS app: the app itself plus the shared code it
// is built from. Scoping to the app directory alone handed the judge half of a
// refactor -- the shell de-duplication moved code INTO /design-system, the judge
// could not see where it went, and five of its findings were 'unverified' or
// 'not in diff' rather than real defects. A reviewer that cannot see the other
// side of a move cannot judge the move.
const SHARED_REVIEW_PATHS = [':(top)design-system'];
const reviewPaths = [`:(top)${slug}`, ...SHARED_REVIEW_PATHS].join(',');

const helperArgs = [
  '--yes',
  'tsx',
  HELPER,
  reviewDir,
  '--out',
  outPath,
  '--repo-root',
  repoRoot,
  '--timeout',
  String(timeoutSec * 1000)
];
if (explicitRange !== undefined) {
  helperArgs.push('--diff-range', explicitRange, '--diff-paths', reviewPaths);
} else if (releaseBase !== null) {
  // `:(top)` makes the pathspec repo-root relative. The judge runs INSIDE the
  // app directory, so a bare slug resolved to <app>/<app> and produced a
  // ZERO-byte diff -- measured: 0 bytes bare, 843464 bytes with :(top). The
  // judge then spent every finding on the only file it could see, its own
  // evidence artifact, and reported "Empty product diff".
  helperArgs.push('--diff-range', `${releaseBase}..HEAD`, '--diff-paths', reviewPaths);
}

// Outer timeout must cover N sequential chunk reviews (release diffs can need
// many 120k windows). Per-chunk timeout is still `timeoutSec`; this bound is
// only a process watchdog — never truncate the diff to "fit" one prompt.
const maxChunksWatchdog = 40;
const res = run('npx', helperArgs, {
  env: scrubbed,
  timeout: (timeoutSec * maxChunksWatchdog + 60) * 1000,
  cwd: REPO_ROOT,
  shell: process.platform === 'win32'
});

cleanup();

if (res.code !== 0 && res.stdout.trim().length === 0) {
  console.error(
    `judge_diff FAIL: helper exited ${res.code} with no output.\n` +
      `${res.stderr.slice(0, 800)}\n` +
      `A judge that could not be run must NOT be recorded as agreement.`
  );
  process.exit(1);
}

/** @type {Record<string, unknown> | null} */
let report = null;
try {
  const line = res.stdout.trim().split(/\r?\n/).filter(Boolean).pop() ?? '';
  report = JSON.parse(line);
} catch {
  report = null;
}

if (report === null || typeof report !== 'object') {
  console.error(
    'judge_diff FAIL: could not parse IndependentReviewReport from helper output. ' +
      'Unparseable is not the same as a clean review.'
  );
  if (res.stderr) console.error(res.stderr.slice(0, 800));
  process.exit(1);
}

// Ensure the file is on disk at outPath (helper writes it; re-write if needed
// so a partial helper path still leaves an auditable artifact).
if (!existsSync(outPath)) {
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

const findings = Array.isArray(report.findings) ? report.findings : [];
const failing = findings.filter((f) => f && f.passed === false);
const chunkCount = report.chunkCount ?? '?';
const coverageChars = report.coverageChars ?? '?';
const diffChars = report.diffChars ?? '?';
const coverageComplete = report.coverageComplete;
console.log(
  `judge_diff: completed=${report.completed} ok=${report.ok} ` +
    `findings=${findings.length} failing=${failing.length} ` +
    `chunks=${chunkCount} coverage=${coverageChars}/${diffChars} ` +
    `coverageComplete=${coverageComplete} ` +
    `commit=${String(report.commit ?? '').slice(0, 12)} ` +
    `report=${outPath}`
);
for (const f of failing) {
  console.log(`  FAIL  ${f.title} (${f.citation})`);
  if (f.detail) console.log(`        ${String(f.detail).slice(0, 200)}`);
}

if (report.completed !== true) {
  process.exit(1);
}
// Exit 0 with a written report even when ok is false — the gate reads the
// file and fails closed on unresolved findings. That is not a rubber stamp.
process.exit(0);
