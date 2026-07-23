import { readFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { withWorktree } from '../worktree/isolate';
import { runLoop, type GateOutcome, type LoopResult } from '../loop/ralph';
import { gateApp, type GateReport } from './gate';
import { runGrok, parseGrokJson, newSessionId } from '../grok/harness';
import type { Outcome } from '../gate/score';

/** A completed loop plus the full gate report from its final pass. */
export interface LoopRun {
  loop: LoopResult;
  final: GateReport;
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
  return withWorktree(repoDir, branch, async (worktreeDir) =>
    runLoopIn(join(worktreeDir, relative(repoDir, resolve(opts.dir))), opts)
  );
}

/**
 * Run the loop against an already-chosen directory. Split out so the isolated
 * and non-isolated paths share one implementation.
 */
async function runLoopIn(dir: string, opts: LoopCommandOptions): Promise<LoopRun> {
  const spec = await readFile(opts.specPath, 'utf8');
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
      lastReport = report;
      const failed = report.outcomes.filter((o) => !o.passed).map((o) => o.ruleId);
      const feedback = [
        `score ${report.score}/100 (threshold ${opts.threshold}), evaluated ${report.evaluated}/${report.total}`,
        report.blockersFailed.length > 0
          ? `blockers failed: ${report.blockersFailed.join(', ')}`
          : 'no blockers failed',
        failed.length > 0 ? `rules failed: ${failed.join(', ')}` : 'no rules failed'
      ].join('\n');
      return { score: report.score, blockers: report.blockersFailed, feedback };
    }
  };

  const loop = await runLoop(deps, { threshold: opts.threshold, maxIters: opts.maxIters });
  if (lastReport === null) {
    // maxIters < 1 would skip the loop body entirely; a run that never gated has
    // no score to report, and must not be written out as one.
    throw new Error('loop completed without running the gate — check --max-iters');
  }
  return { loop, final: lastReport };
}
