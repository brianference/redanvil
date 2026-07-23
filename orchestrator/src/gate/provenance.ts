import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadRubric } from '../rubric/index';

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

/**
 * Collect provenance for a gate run rooted at `cwd`.
 */
export function collectProvenance(cwd: string = process.cwd()): Provenance {
  const commit = git(['rev-parse', 'HEAD'], cwd);
  const status = git(['status', '--porcelain'], cwd);
  return {
    commit,
    dirty: status !== null && status.length > 0,
    rubricHash: rubricHash(),
    rubricRuleCount: loadRubric().length,
    node: process.version,
    generatedAt: new Date().toISOString()
  };
}
