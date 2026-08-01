import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { basename, join, relative, resolve } from 'node:path';
import { withWorktree } from '../worktree/isolate';
import { promoteWorktree, type PromoteResult } from '../worktree/promote';
import { runLoop, type GateOutcome, type LoopResult } from '../loop/ralph';
import { gateApp, type GateReport } from './gate';
import { runGrok, parseGrokJson, newSessionId } from '../grok/harness';
import { scoreRun, coderEnv } from '../loop/runRules';
import type { Outcome } from '../gate/score';
import { runIndependentDiffReview } from '../loop/independentReview';
import { isDone } from '../gate/done';

/** A completed loop plus the full gate report from its final pass. */
export interface LoopRun {
  loop: LoopResult;
  final: GateReport;
  /**
   * How the run itself scored against the operational contract in
   * rules/loop-gate.md. Previously those rules existed only as prose, so a run
   * that edited the live tree, leaked an environment, or looped unbounded still
   * reported the same clean result as one that did none of those things.
   */
  runRules: Outcome[];
  /**
   * What happened to the work when --promote was asked for.
   *
   * Absent when promotion was not requested. Present and `promoted: false`
   * when it was requested and refused, because "the gate was green and nothing
   * landed" is a state someone has to be able to see.
   */
  promotion?: PromoteResult;
  /**
   * Independent judge-over-diff step (required before done).
   * True when the review completed and either found nothing explicitly or
   * reported only verified passes.
   */
  independentReviewOk: boolean;
  /** One-line summary for the CLI (findings count or explicit empty). */
  independentReviewSummary: string;
}

export interface LoopCommandOptions {
  /** App directory the coder edits and the gate scores. */
  dir: string;
  /** Path to the spec Grok implements. */
  specPath: string;
  threshold: number;
  maxIters: number;
  /** Recorded judge/visual verdicts folded into every gate run. */
  judge: Outcome[];
  /** Rule ids or lane names that do not apply to this app. */
  notApplicable: string[];
  /** Per-iteration Grok timeout. */
  timeoutMs?: number;
  /**
   * Run the coder in a disposable git worktree instead of the working tree.
   * Default true: `lg-worktree-isolation` is a blocker and the README promises
   * a "bounded, isolated" run, so letting Grok edit the live tree by default
   * would make both statements false.
   */
  isolate?: boolean;
  /** Repo the worktree branches from. Defaults to the current directory. */
  repoDir?: string;
  /**
   * Merge the run into the base branch when it passes.
   *
   * Off by default and deliberately so: automatically merging agent output is
   * the exact failure the teamwork protocol exists to prevent, so the caller
   * has to ask for it. Even then the commit is built in isolation before the
   * merge, and a dirty base is refused outright.
   */
  promote?: boolean;
  /** Pre-flight iteration estimate, scored by lg-budget-ceiling. */
  estimatedIterations?: number;
}

/** Coder timeout applied when the caller sets none; mirrors the Grok harness default. */
const DEFAULT_CODER_TIMEOUT_MS = 600_000;

/** Indent a captured diagnostic so it reads as a block under its rule id. */
function indent(text: string): string {
  return text
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

/**
 * Build the coder prompt for one iteration. The first pass gets the spec; later
 * passes get the spec plus the gate's verbatim failures, so the coder is always
 * responding to a measured result rather than its own opinion of its work.
 */
export function coderPrompt(spec: string, iteration: number, feedback: string): string {
  if (iteration === 1 || feedback === '') {
    return `Implement this spec.\n\n${spec}\n\nMake the smallest change that satisfies it. Do not weaken tests or checks to pass.`;
  }
  return [
    'The quality gate scored your previous attempt below the threshold.',
    'Fix the failures below. Do not weaken a check, delete a test, or remove a feature to make a failure disappear.',
    '',
    '## Gate failures',
    feedback,
    '',
    '## Original spec',
    spec
  ].join('\n');
}

/**
 * Wire the ralph loop to real dependencies and run it.
 *
 * The loop itself has always existed and been tested, but nothing invoked it —
 * so the product's headline capability was a library function with no entry
 * point, and any iteration history had to be typed in by hand. This is the
 * entry point; the history it returns is measured, not asserted.
 */
export async function runLoopCommand(opts: LoopCommandOptions): Promise<LoopRun> {
  const isolate = opts.isolate !== false;
  if (!isolate) return runLoopIn(opts.dir, opts);

  // Branch name is derived from the target so concurrent loops do not collide.
  const branch = `redanvil-loop-${basename(opts.dir)}-${Date.now().toString(36)}`;
  const repoDir = opts.repoDir ?? process.cwd();
  return withWorktree(repoDir, branch, async (worktreeDir) => {
    const result = await runLoopIn(join(worktreeDir, relative(repoDir, resolve(opts.dir))), opts);

    // Promotion happens HERE, inside the callback, because withWorktree
    // destroys the worktree and the branch on the way out. Without this the
    // loop could evaluate work and never keep it: a run that passed the gate
    // was discarded exactly like one that failed, and every green result had
    // to be reproduced by hand — which is the moment a verified result
    // quietly becomes an unverified one.
    if (opts.promote === true) {
      // Promote only when isDone holds — score alone is not the finish line.
      const promoteRules = result.final.outcomes.map((o) => ({
        ruleId: o.ruleId,
        passed: o.passed
      }));
      const promoteDone = isDone(
        {
          finalScore: result.final.score,
          threshold: opts.threshold,
          rules: promoteRules
        },
        { independentReviewOk: result.independentReviewOk }
      );
      const green =
        result.final.blockersFailed.length === 0 &&
        result.final.score >= opts.threshold &&
        promoteDone.done;
      if (!green) {
        result.promotion = {
          promoted: false,
          commit: null,
          reason:
            `not promoted: score ${result.final.score} against a threshold of ${opts.threshold}` +
            (result.final.blockersFailed.length > 0
              ? `, blockers failed: ${result.final.blockersFailed.join(', ')}`
              : '') +
            (promoteDone.done ? '' : `; isDone false: ${promoteDone.reasons.join('; ')}`)
        };
      } else {
        result.promotion = await promoteWorktree({
          repoDir,
          worktreeDir,
          message:
            `RA-loop: promote ${basename(opts.dir)} at score ${result.final.score}\n\n` +
            `Gated run, ${result.final.evaluated}/${result.final.total} rules evaluated, ` +
            `coverage ${result.final.coverage}%. Threshold ${opts.threshold}, zero failed blockers.`
        });
      }
    }

    return result;
  });
}

/**
 * Run the loop against an already-chosen directory. Split out so the isolated
 * and non-isolated paths share one implementation.
 */
/**
 * The branch a directory is checked out on, or null when git cannot say.
 *
 * @param dir - Directory to inspect.
 * @returns Branch name, or null.
 */
function currentBranch(dir: string): string | null {
  try {
    const name = execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return name === '' ? null : name;
  } catch {
    return null;
  }
}

async function runLoopIn(dir: string, opts: LoopCommandOptions): Promise<LoopRun> {
  const spec = await readFile(opts.specPath, 'utf8');
  /** Iterations that produced a real gate score, for lg-score-is-inline. */
  let gatedIterations = 0;
  /** The full report from the most recent gate pass, for the result file. */
  let lastReport: GateReport | null = null;
  // One session for the whole loop so the coder keeps its own context across
  // iterations; the gate verdict is what carries state between passes.
  const sessionId = newSessionId();

  const deps = {
    /** Invoke Grok for one iteration. A coder failure is not a gate pass. */
    coder: async (iteration: number, feedback: string): Promise<void> => {
      const result = await runGrok(dir, coderPrompt(spec, iteration, feedback), {
        sessionId,
        timeoutMs: opts.timeoutMs
      });
      if (result.code !== 0) {
        // Surface it, but do not abort: the gate still runs and scores whatever
        // state the tree is in. A dead coder shows up as an unchanged score.
        console.error(`iteration ${iteration}: coder exited ${result.code ?? 'timeout'}`);
        return;
      }
      const reply = parseGrokJson(result.stdout);
      if (reply === null) console.error(`iteration ${iteration}: coder output was not valid JSON`);
    },

    /** Score inline. Never the coder's self-report. */
    gate: async (): Promise<GateOutcome> => {
      const report = await gateApp(dir, undefined, opts.judge, opts.notApplicable);
      gatedIterations += 1;
      lastReport = report;
      const failed = report.outcomes.filter((o) => !o.passed);
      // Hand back the check's own diagnostic, not just the rule id. The coder
      // otherwise has to rediscover a location the gate already printed, which
      // costs an iteration per failure.
      const detailed =
        failed.length > 0
          ? failed
              .map((o) => `- ${o.ruleId}\n${indent(o.detail ?? 'no diagnostic captured')}`)
              .join('\n')
          : 'no rules failed';
      // Rules that failed with no recorded outcome at all are fail-closed
      // (visual/judge with no fresh verdict). The coder cannot fix those by
      // editing code, so name them separately instead of sending it hunting.
      const recorded = new Set(report.outcomes.map((o) => o.ruleId));
      const unreviewed = report.blockersFailed.filter((id) => !recorded.has(id));
      const feedback = [
        `score ${report.score}/100 (threshold ${opts.threshold}), evaluated ${report.evaluated}/${report.total}`,
        report.blockersFailed.length > 0
          ? `blockers failed: ${report.blockersFailed.join(', ')}`
          : 'no blockers failed',
        unreviewed.length > 0
          ? `awaiting a recorded review (NOT fixable by editing code): ${unreviewed.join(', ')}`
          : '',
        '',
        'failing checks, with the gate output verbatim:',
        detailed
      ]
        .filter((line) => line !== '')
        .join('\n');
      return { score: report.score, blockers: report.blockersFailed, feedback };
    }
  };

  const loop = await runLoop(deps, { threshold: opts.threshold, maxIters: opts.maxIters });
  // Capture into a const so control-flow narrowing sticks through the rest of
  // the function (mutable `let` + throw was collapsing to `never` under strict).
  const finalReport: GateReport | null = lastReport;
  if (finalReport === null) {
    // maxIters < 1 would skip the loop body entirely; a run that never gated has
    // no score to report, and must not be written out as one.
    throw new Error('loop completed without running the gate — check --max-iters');
  }
  const runRules = scoreRun({
    isolated: opts.isolate !== false,
    // The directory and branch the coder ACTUALLY ran in, so isolation is
    // observed rather than taken on this function's own word. `isolated` above
    // is the caller describing its own intent; `coderDir` is the filesystem
    // being asked whether that intent was carried out.
    coderDir: dir,
    coderBranch: currentBranch(dir),
    coderTimeoutMs: opts.timeoutMs ?? DEFAULT_CODER_TIMEOUT_MS,
    coderEnv: coderEnv(),
    maxIters: opts.maxIters,
    gatedIterations,
    iterations: loop.iterations,
    estimatedIterations: opts.estimatedIterations ?? null,
    flipFlopped: loop.flipFlopped
  });

  // Independent judge over the REAL git diff — before any app can be reported
  // done. Instructions are to REFUTE: find what the author missed, cite
  // file:line, FAIL anything unverified. A silent empty pass is forbidden.
  const review = runIndependentDiffReview({ dir });
  const independentReviewOk = review.ok;
  let independentReviewSummary: string;
  if (!review.completed) {
    independentReviewSummary = `incomplete (${review.mode}): judge could not finish`;
  } else if (review.findings.length === 0) {
    independentReviewSummary = review.foundNothingExplicit
      ? `found nothing to refute (explicit) at ${review.commit.slice(0, 12)} diff=${review.diffHash.slice(0, 12)}`
      : 'EMPTY findings without foundNothingExplicit — treated as FAIL';
  } else {
    const fails = review.findings.filter((f) => !f.passed).length;
    independentReviewSummary =
      `${review.findings.length} finding(s), ${fails} failing; ` +
      `bound to ${review.commit.slice(0, 12)} diff=${review.diffHash.slice(0, 12)}`;
  }

  // isDone is the only finish-line definition — the loop score alone is not.
  // Read outcomes via an explicit GateReport binding — control-flow narrowing
  // of finalReport was collapsing to `never` under concurrent edits to this file.
  const scored: GateReport = finalReport as GateReport;
  const rules = scored.outcomes.map((o) => ({
    ruleId: o.ruleId,
    passed: o.passed
  }));
  const done = isDone(
    { finalScore: loop.finalScore, threshold: opts.threshold, rules },
    { independentReviewOk }
  );
  if (!done.done && loop.passed) {
    // Score cleared the threshold but the finish line did not — demote the
    // loop result so callers cannot treat it as shipped.
    loop.passed = false;
    loop.promise = null;
  }

  return {
    loop,
    final: scored,
    runRules,
    independentReviewOk,
    independentReviewSummary
  };
}
