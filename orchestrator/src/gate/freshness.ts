import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import type { Verdict } from '../schemas/verdicts';
import { isGateOutput } from '../../scripts/lib/gate-outputs.mjs';
import {
  bundleHashOfApp,
  changedFilesSince,
  commitResolvable,
  isBundleBound,
  scopeForVerdict,
  verdictStaleReason
} from '../../scripts/lib/verdict-freshness.mjs';

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

/**
 * Current built-bundle hash for a bundle-bound visual verdict.
 * Null means the build cannot be read, which is stale, not fresh.
 */
export type BundleProbe = () => string | null;

/** How many changed paths to carry into the failure message. */
const MAX_REPORTED_FILES = 5;

/**
 * The paths a verdict covers. An explicit `scope` on the verdict wins; otherwise
 * the whole app directory is the scope, because a reviewer who did not say what
 * they looked at is only credibly speaking for the thing under review.
 *
 * A visual verdict that recorded `bundleHash` is not scoped this way: it is
 * bound to the built bundle, and a source edit that does not change the bundle
 * does not expire it. This function is the source-tree scope only.
 *
 * @param verdict The recorded verdict.
 * @param appDirRel The app directory being gated, relative to the repo root.
 * @returns Repo-relative path prefixes the verdict speaks for.
 */
export function verdictScope(verdict: Verdict, appDirRel: string): string[] {
  return scopeForVerdict(verdict, appDirRel);
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
 * A visual verdict with `bundleHash` is stale only when the current build's
 * hash differs, or when that hash cannot be read. Source edits do not expire
 * it. A visual verdict with no hash, and every judge verdict, keep the
 * source-tree check. Unknown stays stale.
 *
 * @param verdicts Parsed verdicts.
 * @param scopeFor Resolves the paths a verdict speaks for.
 * @param probe Reports what changed in a scope since a commit.
 * @param bundleProbe Current build hash. Required for bundle-bound verdicts;
 *   a missing probe is treated as a missing build (stale), never as a match.
 * @returns Every stale verdict, in input order.
 */
export function findStaleVerdicts(
  verdicts: Verdict[],
  scopeFor: (verdict: Verdict) => string[],
  probe: ChangeProbe,
  bundleProbe?: BundleProbe
): StaleVerdict[] {
  const stale: StaleVerdict[] = [];
  for (const verdict of verdicts) {
    // Do not ask git about a bundle-bound verdict. A source-only commit must
    // not be able to expire a review of the rendered page.
    const changed = isBundleBound(verdict)
      ? null
      : probe(verdict.reviewedCommit, scopeFor(verdict));
    const currentBundleHash = isBundleBound(verdict)
      ? bundleProbe
        ? bundleProbe()
        : null
      : null;
    const decision = verdictStaleReason(verdict, { changedFiles: changed, currentBundleHash });
    if (!decision.stale) continue;
    stale.push({
      ruleId: verdict.ruleId,
      reviewedCommit: verdict.reviewedCommit,
      reason: decision.reason,
      changedFiles: decision.changedFiles.slice(0, MAX_REPORTED_FILES)
    });
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

// A verdict speaks for the app's SOURCE, so an artifact the gate emitted while
// scoring is not evidence that the reviewed surface moved. Shared with
// provenance and verify_deployed, which each hit the same defect independently.
export { isGateOutput };

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
    if (!commitResolvable(repoRoot, commit)) {
      if (shallow) {
        console.error(
          `freshness: cannot resolve ${commit.slice(0, 12)} — this is a SHALLOW clone. ` +
            `Check out with fetch-depth: 0 so verdicts can be checked against their commit.`
        );
      }
      return null;
    }
    return changedFilesSince(repoRoot, commit, scope);
  };
}

/**
 * Hash of the app's current `dist/assets/index-*.js` and `.css`.
 *
 * @param repoRoot Repository root.
 * @param appDirRel App directory relative to the repo root.
 * @returns A probe. Null from the probe means the build could not be read.
 */
export function gitBundleProbe(repoRoot: string, appDirRel: string): BundleProbe {
  return () => {
    try {
      return bundleHashOfApp(join(repoRoot, appDirRel));
    } catch {
      return null;
    }
  };
}

/** Upper bound on the fresh build a bundle probe runs before hashing. */
const FRESH_BUILD_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Bundle probe that builds the app first, then hashes the fresh output.
 *
 * Verdicts are loaded before the gate's own checks (which include the build),
 * so hashing whatever `dist/` happens to be on disk would let a build left over
 * from an earlier commit vouch for source that has since changed. Building here
 * makes the hash describe the current source. Vite output is deterministic, so
 * unchanged source reproduces the recorded hash. The build runs at most once per
 * probe; a failed build yields null, which marks bundle-bound verdicts stale.
 *
 * @param repoRoot Repository root.
 * @param appDirRel App directory relative to the repo root.
 * @param build Runs the app's build in its directory; true on success. Injected for tests.
 * @returns A probe over a freshly built bundle.
 */
export function freshBuildBundleProbe(
  repoRoot: string,
  appDirRel: string,
  build: (appDir: string) => boolean = defaultBuild
): BundleProbe {
  let cached: { hash: string | null } | null = null;
  return () => {
    if (cached !== null) return cached.hash;
    const appDir = join(repoRoot, appDirRel);
    const hash = build(appDir) ? gitBundleProbe(repoRoot, appDirRel)() : null;
    cached = { hash };
    return hash;
  };
}

/**
 * `npm run build` in the app directory, bounded and quiet.
 *
 * @param appDir Absolute app directory.
 * @returns True when the build exited 0.
 */
function defaultBuild(appDir: string): boolean {
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: appDir,
    stdio: 'ignore',
    timeout: FRESH_BUILD_TIMEOUT_MS,
    // npm is a .cmd shim on Windows and needs a shell; the arguments are fixed.
    shell: process.platform === 'win32'
  });
  return result.status === 0;
}
