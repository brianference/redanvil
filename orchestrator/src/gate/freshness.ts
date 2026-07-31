import { execFileSync } from 'node:child_process';
import type { Verdict } from '../schemas/verdicts';

/**
 * A verdict that can no longer be trusted, and why.
 */
export interface StaleVerdict {
  ruleId: string;
  /** The commit the reviewer recorded looking at. */
  reviewedCommit: string;
  /** Human-readable cause, printed so the operator knows what to re-review. */
  reason: string;
  /** A few of the files that moved under the verdict, for the message. */
  changedFiles: string[];
}

/**
 * Reports files that changed inside `scope` between `commit` and the current
 * working state. Returns null when the question cannot be answered at all (no
 * git, or a commit this repository has never seen).
 */
export type ChangeProbe = (commit: string, scope: string[]) => string[] | null;

/** How many changed paths to carry into the failure message. */
const MAX_REPORTED_FILES = 5;

/**
 * The paths a verdict covers. An explicit `scope` on the verdict wins; otherwise
 * the whole app directory is the scope, because a reviewer who did not say what
 * they looked at is only credibly speaking for the thing under review.
 *
 * @param verdict The recorded verdict.
 * @param appDirRel The app directory being gated, relative to the repo root.
 * @returns Repo-relative path prefixes the verdict speaks for.
 */
export function verdictScope(verdict: Verdict, appDirRel: string): string[] {
  const scope = verdict.scope;
  if (scope !== undefined && scope.length > 0) return scope;
  return [appDirRel];
}

/**
 * Find every verdict whose subject has moved since it was recorded.
 *
 * This is the binding that was missing: `reviewedCommit` was validated by the
 * schema and then read by nothing, so a verdict recorded 22 commits and 22
 * changed files ago still earned full weight, and CI reproduced it happily
 * because the reproduction hashes the verdicts FILE rather than comparing it to
 * the code. A stale verdict is dropped, which leaves its rule unrecorded, which
 * fails closed — the same treatment as a review that never happened, because
 * that is what it now is.
 *
 * @param verdicts Parsed verdicts.
 * @param scopeFor Resolves the paths a verdict speaks for.
 * @param probe Reports what changed in a scope since a commit.
 * @returns Every stale verdict, in input order.
 */
export function findStaleVerdicts(
  verdicts: Verdict[],
  scopeFor: (verdict: Verdict) => string[],
  probe: ChangeProbe
): StaleVerdict[] {
  const stale: StaleVerdict[] = [];
  for (const verdict of verdicts) {
    const changed = probe(verdict.reviewedCommit, scopeFor(verdict));
    if (changed === null) {
      stale.push({
        ruleId: verdict.ruleId,
        reviewedCommit: verdict.reviewedCommit,
        reason: `reviewedCommit ${verdict.reviewedCommit.slice(0, 12)} is not resolvable in this repository`,
        changedFiles: []
      });
      continue;
    }
    if (changed.length > 0) {
      stale.push({
        ruleId: verdict.ruleId,
        reviewedCommit: verdict.reviewedCommit,
        reason: `${changed.length} file(s) under review changed since ${verdict.reviewedCommit.slice(0, 12)}`,
        changedFiles: changed.slice(0, MAX_REPORTED_FILES)
      });
    }
  }
  return stale;
}

/**
 * Committer timestamp of a commit, as epoch milliseconds, or null when the
 * commit cannot be resolved.
 *
 * @param commit - Commit-ish to resolve.
 * @param repoRoot - Repository to ask.
 * @returns Epoch ms, or null.
 */
export function commitTimeMs(commit: string, repoRoot: string): number | null {
  const out = git(['show', '-s', '--format=%ct', commit], repoRoot);
  if (out === null) return null;
  const seconds = Number(out.trim());
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

/** Run a git command in `repoRoot`, returning null when it fails for any reason. */
function git(args: string[], repoRoot: string): string | null {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
  } catch {
    return null;
  }
}

/**
 * Artifacts the gate itself writes into the app it is reviewing.
 *
 * Running the gate mutated `.redanvil/coverage-state.json` (the ratchet records
 * a new high-water mark) and `evidence/api-live-*.json` (u-api-real-output saves
 * the traffic it captured). The freshness probe then counted those writes as
 * "the subject changed since review" and dropped every verdict — so the gate
 * invalidated its own verdicts by running, and no sequence of measure-then-stamp
 * could ever converge. reverify hit this on both apps.
 *
 * A verdict speaks for the app's SOURCE. An output the gate emitted while
 * scoring is not evidence that the reviewed surface moved. Excluding these does
 * not weaken the ratchet's tamper check, which reads the state file's git
 * history directly and does not consult freshness at all.
 *
 * @param file Repo-relative path.
 * @returns True when the gate produced this file rather than a person editing it.
 */
export function isGateOutput(file: string): boolean {
  return (
    file.endsWith('/.redanvil/coverage-state.json') ||
    file.startsWith('.redanvil/coverage-state.json') ||
    /(^|\/)evidence\//.test(file)
  );
}

/**
 * A change probe backed by real git history.
 *
 * `git diff --name-only <commit> -- <scope>` compares the commit against the
 * WORKING TREE, so staged and unstaged edits count too: a verdict is stale the
 * moment its subject is edited, not only once the edit is committed. Untracked
 * files in scope count as well, since a new component is as much a change to the
 * reviewed surface as an edited one.
 *
 * @param repoRoot Repository the verdicts belong to.
 * @returns A probe usable by `findStaleVerdicts`.
 */
export function gitChangeProbe(repoRoot: string): ChangeProbe {
  // A shallow clone (CI's default `fetch-depth: 1`) holds one commit, so every
  // reviewedCommit looks unresolvable and every verdict drops as stale. Failing
  // closed is right, but reporting it as 24 design regressions is not: the cause
  // is the checkout, not the code. Detect it once and say so.
  const shallow = git(['rev-parse', '--is-shallow-repository'], repoRoot)?.trim() === 'true';

  return (commit, scope) => {
    // Resolve the commit first so "unknown commit" is distinguishable from
    // "nothing changed" — both make `git diff` print nothing.
    if (git(['cat-file', '-e', `${commit}^{commit}`], repoRoot) === null) {
      if (shallow) {
        console.error(
          `freshness: cannot resolve ${commit.slice(0, 12)} — this is a SHALLOW clone. ` +
            `Check out with fetch-depth: 0 so verdicts can be checked against their commit.`
        );
      }
      return null;
    }

    const changed = git(['diff', '--name-only', commit, '--', ...scope], repoRoot);
    if (changed === null) return null;
    const untracked = git(['ls-files', '--others', '--exclude-standard', '--', ...scope], repoRoot);

    const lines = (text: string): string[] =>
      text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    return [...new Set([...lines(changed), ...lines(untracked ?? '')])].filter(
      (file) => !isGateOutput(file)
    );
  };
}
