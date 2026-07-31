import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadRubric } from '../rubric/index';
import { isGateOutput } from './freshness';

/**
 * Machine-generated proof of where a result file came from. Hand-authoring a
 * results file is the failure this exists to prevent: a plausible, correctly
 * shaped score with nothing that actually produced it. Every field here is
 * derived at write time and re-checkable after the fact, so a fabricated file
 * can be detected instead of merely doubted.
 */
export type Provenance = {
  /** Git commit the gate actually ran against, or null outside a git worktree. */
  commit: string | null;
  /** True when the worktree had uncommitted changes, so `commit` under-describes what ran. */
  dirty: boolean;
  /** SHA-256 over the rubric, so a rubric edit invalidates stale results. */
  rubricHash: string;
  /** Number of rules in the rubric at run time. */
  rubricRuleCount: number;
  /** Node version that produced the run. */
  node: string;
  /**
   * SHA-256 of the verdicts file that supplied the non-deterministic rules, or
   * null when the run used none. Without this the CI reproduction re-runs the
   * gate against whatever verdicts file it is handed, so it confirms only that
   * the static checks reproduce — it can never contradict an edited verdict.
   */
  verdictsHash: string | null;
  /**
   * Lanes and rule ids excluded from scoring. `--na` is load-bearing: it is the
   * only way an unmeasured rule can avoid failing closed, so a result that does
   * not disclose what was waived is not fully describing its own score.
   */
  notApplicable: string[];
  /**
   * Rule ids whose recorded verdict was DROPPED as stale (its reviewed subject
   * changed since `reviewedCommit`). Disclosed because a dropped verdict is the
   * difference between "this rule was reviewed and passed" and "nothing has
   * looked at this rule since the code moved" — and the score cannot show that
   * on its own.
   */
  staleVerdicts: string[];
  generatedAt: string;
};

/**
 * Run a git command, returning null when git is absent or this is not a repo.
 * Never throws — provenance must degrade to "unknown", never break the gate.
 */
function git(args: string[], cwd: string): string | null {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Stable SHA-256 over the rubric's scored surface (id, method, severity, weight).
 * Changing any rule that can affect a score changes this hash, so a result file
 * carrying an old hash is detectably stale rather than silently trusted.
 */
export function rubricHash(): string {
  const surface = loadRubric()
    .map((r) => `${r.id}|${r.method}|${r.severity}|${r.weight}`)
    .sort()
    .join('\n');
  return createHash('sha256').update(surface).digest('hex');
}

/** SHA-256 with line endings normalized, so CRLF vs LF is not a difference. */
function sha256(text: string): string {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
}

/**
 * Working-tree changes that are not artifacts of this gate run.
 *
 * Running the gate WRITES: the coverage ratchet records a new high-water mark,
 * u-api-real-output saves captured traffic, and the run's own result file lands
 * in results/. Counting those made `dirty` true on every run, so no result could
 * ever be tied to a deploy and verify_deployed rejected them all — the gate
 * disqualified its own output by producing it.
 *
 * A real source edit still marks the result dirty, which is the guarantee worth
 * keeping: a score describes a commit only when the tree matches that commit.
 *
 * @param status Output of `git status --porcelain`.
 * @returns Paths that represent genuine uncommitted work.
 */
export function dirtyFiles(status: string): string[] {
  return status
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const path = line.slice(2).trim();
      // Renames read "old -> new"; the destination is the file that exists now.
      const arrow = path.indexOf(' -> ');
      return arrow === -1 ? path : path.slice(arrow + 4);
    })
    .filter((path) => !isGateOutput(path));
}

/**
 * Collect provenance for a gate run rooted at `cwd`.
 */
export function collectProvenance(
  cwd: string = process.cwd(),
  opts: {
    verdictsRaw?: string | null;
    notApplicable?: string[];
    staleVerdicts?: string[];
  } = {}
): Provenance {
  const commit = git(['rev-parse', 'HEAD'], cwd);
  const status = git(['status', '--porcelain'], cwd);
  return {
    commit,
    dirty: status !== null && dirtyFiles(status).length > 0,
    rubricHash: rubricHash(),
    rubricRuleCount: loadRubric().length,
    node: process.version,
    verdictsHash: typeof opts.verdictsRaw === 'string' ? sha256(opts.verdictsRaw) : null,
    notApplicable: [...(opts.notApplicable ?? [])].sort(),
    staleVerdicts: [...(opts.staleVerdicts ?? [])].sort(),
    generatedAt: new Date().toISOString()
  };
}
