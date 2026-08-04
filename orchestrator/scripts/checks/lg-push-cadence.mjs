#!/usr/bin/env node
/**
 * lg-push-cadence — a large unpushed backlog is a defect, not a habit.
 *
 * Usage (CLI): node lg-push-cadence.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 2 = usage, 3 = n/a (no remote-tracking branch).
 *
 * Why: the pre-push hook could only refuse a push that was not good enough.
 * It had no way to say "this has been unpushed too long", so finished work
 * piled up behind one deferred defect (134 commits once). A release that
 * large is untestable and its CI signal is useless.
 *
 * Measure: resolve upstream with `git rev-parse --abbrev-ref @{upstream}`,
 * then `git rev-list --count <upstream>..HEAD`. Never invent `origin/<branch>`.
 * FAIL above {@link PUSH_CADENCE_THRESHOLD}; PASS at or below.
 * N/A only when there is genuinely no upstream configured.
 * An unresolvable git state FAILS — "could not measure" is not "measured fine".
 *
 * Pre-push: when `REDANVIL_PRE_PUSH=1` (set only by the pre-push hook), the
 * rule still prints the finding but PASSes, same shape as lg-shipped condition
 * 2. Otherwise the rule would deadlock the push it exists to force. CI does
 * not set the variable, so the remote enforces the threshold literally.
 *
 * Prefer importing {@link runLgPushCadence} and wiring it from check.mjs.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * Max unpushed commits allowed before the rule fails.
 * Single exported named constant — no magic number at the call site.
 */
export const PUSH_CADENCE_THRESHOLD = 20;

/**
 * Outcome of the pure cadence evaluator.
 *
 * @typedef {{
 *   kind: 'pass',
 *   count: number,
 *   deferred?: boolean,
 *   message?: string
 * } | {
 *   kind: 'fail',
 *   count: number,
 *   message: string
 * } | {
 *   kind: 'notApplicable',
 *   reason: string
 * } | {
 *   kind: 'error',
 *   message: string
 * }} PushCadenceVerdict
 */

/**
 * IO contract shared with check.mjs (and CLI wrappers).
 *
 * @typedef {{
 *   pass: () => never,
 *   fail: (msg?: string) => never,
 *   notApplicable: (why?: string) => never
 * }} PushCadenceIo
 */

/**
 * Result of resolving HEAD's configured upstream (`@{upstream}`).
 *
 * - `ok: true` — `ref` is the remote-tracking name (e.g. `origin/master`)
 * - `ok: false, reason: 'none'` — genuinely no upstream configured (n/a)
 * - `ok: false, reason: 'error'` — git failed for any other reason (fail)
 *
 * @typedef {{
 *   ok: true,
 *   ref: string
 * } | {
 *   ok: false,
 *   reason: 'none'
 * } | {
 *   ok: false,
 *   reason: 'error',
 *   message: string
 * }} UpstreamResolve
 */

/**
 * Injectable git / env deps so tests can pin answers without a network remote.
 *
 * @typedef {{
 *   isInsideWorkTree?: (cwd: string) => boolean | null,
 *   getUpstream?: (cwd: string) => UpstreamResolve,
 *   countAhead?: (cwd: string, remoteRef: string) => number | null,
 *   isPrePush?: () => boolean
 * }} PushCadenceDeps
 */

/**
 * True when this file was invoked directly as the Node entrypoint.
 * @returns {boolean}
 */
function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

/**
 * Run a git command in `cwd`. Returns stdout trimmed, or null on failure.
 *
 * @param {string} cwd Working directory (app or its enclosing repo).
 * @param {string[]} args Git argv after `git`.
 * @returns {string | null}
 */
function gitOut(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Whether `cwd` is inside a git work tree.
 *
 * @param {string} cwd Working directory.
 * @returns {boolean | null} true/false when known; null when git itself failed.
 */
export function defaultIsInsideWorkTree(cwd) {
  const out = gitOut(cwd, ['rev-parse', '--is-inside-work-tree']);
  if (out === null) return null;
  return out === 'true';
}

/**
 * Resolve the configured upstream remote-tracking ref for HEAD.
 *
 * Uses `git rev-parse --abbrev-ref @{upstream}` — the real upstream name,
 * which need not match `origin/<local-branch>` (e.g. local `feature`
 * tracking `origin/master`).
 *
 * Only "no upstream configured" is treated as absence (n/a). Any other git
 * failure (detached HEAD, broken git, unreadable state) is an error so the
 * rule FAILs instead of silently dropping out of scoring.
 *
 * @param {string} cwd Working directory.
 * @returns {UpstreamResolve}
 */
export function defaultGetUpstream(cwd) {
  try {
    const out = execFileSync('git', ['rev-parse', '--abbrev-ref', '@{upstream}'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
    if (!out) {
      return {
        ok: false,
        reason: 'error',
        message: 'upstream ref resolved to empty — cannot measure push cadence'
      };
    }
    return { ok: true, ref: out };
  } catch (err) {
    const stderr =
      err && typeof err === 'object' && 'stderr' in err
        ? String(/** @type {{ stderr?: unknown }} */ (err).stderr ?? '')
        : '';
    // Genuinely no upstream configured — the only n/a path for tracking.
    if (/no upstream configured/i.test(stderr)) {
      return { ok: false, reason: 'none' };
    }
    const detail = stderr.trim() || 'cannot resolve @{upstream}';
    return { ok: false, reason: 'error', message: detail };
  }
}

/**
 * Count of commits on HEAD not contained in the remote-tracking ref.
 *
 * @param {string} cwd Working directory.
 * @param {string} remoteRef Remote-tracking ref (e.g. origin/main).
 * @returns {number | null} Count, or null when the measure failed.
 */
export function defaultCountAhead(cwd, remoteRef) {
  const out = gitOut(cwd, ['rev-list', '--count', `${remoteRef}..HEAD`]);
  if (out === null) return null;
  const n = Number.parseInt(out, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Whether the pre-push deferral is active (literal "1" only).
 * @returns {boolean}
 */
export function defaultIsPrePush() {
  return process.env.REDANVIL_PRE_PUSH === '1';
}

/**
 * Build the fail/deferred message naming count, threshold, and remedy.
 *
 * @param {number} count Actual unpushed commit count.
 * @returns {string}
 */
export function cadenceFailMessage(count) {
  return (
    `${count} unpushed commit(s) exceeds threshold of ${PUSH_CADENCE_THRESHOLD} — ` +
    `push now; the waiver file exists so one app's deferred defect does not have to hold a release`
  );
}

/**
 * Pure evaluator for lg-push-cadence.
 *
 * Callers supply already-measured facts. Git / env live in the runner so this
 * stays deterministic and unit-testable without a fixture repo.
 *
 * @param {{
 *   count: number | null,
 *   hasRemoteTracking: boolean | null,
 *   prePush?: boolean,
 *   measureError?: string | null
 * }} input Measured facts.
 * @returns {PushCadenceVerdict}
 */
export function evaluatePushCadence(input) {
  const { count, hasRemoteTracking, prePush = false, measureError = null } = input;

  if (measureError) {
    return { kind: 'error', message: measureError };
  }

  // Unresolvable measurement fails — never n/a for "git broke".
  if (hasRemoteTracking === null) {
    return {
      kind: 'error',
      message: 'cannot determine whether a remote-tracking branch exists'
    };
  }

  if (hasRemoteTracking === false) {
    return {
      kind: 'notApplicable',
      reason: 'no remote-tracking branch to compare against — no backlog possible'
    };
  }

  if (count === null) {
    return {
      kind: 'error',
      message: 'cannot measure unpushed commit count against the remote-tracking ref'
    };
  }

  if (count > PUSH_CADENCE_THRESHOLD) {
    const message = cadenceFailMessage(count);
    if (prePush) {
      return { kind: 'pass', count, deferred: true, message };
    }
    return { kind: 'fail', count, message };
  }

  return { kind: 'pass', count };
}

/**
 * Run the lg-push-cadence check against an app directory (or any path in a repo).
 *
 * @param {string} appDir App directory (cwd for git).
 * @param {PushCadenceIo} io Exit helpers.
 * @param {PushCadenceDeps} [deps] Injectable git/env (tests).
 * @returns {void}
 */
export function runLgPushCadence(appDir, io, deps = {}) {
  const isInside = deps.isInsideWorkTree ?? defaultIsInsideWorkTree;
  const getUpstream = deps.getUpstream ?? defaultGetUpstream;
  const countAhead = deps.countAhead ?? defaultCountAhead;
  const isPrePush = deps.isPrePush ?? defaultIsPrePush;

  const inside = isInside(appDir);
  if (inside === null) {
    io.fail('cannot determine git work-tree state — unresolvable git state');
  }
  if (inside === false) {
    io.fail('not inside a git repository — cannot measure push cadence');
  }

  // Real upstream — never invent origin/<local-branch>. Local feature tracking
  // origin/master must measure origin/master..HEAD, not look for origin/feature.
  const upstream = getUpstream(appDir);
  if (!upstream.ok && upstream.reason === 'none') {
    const verdict = evaluatePushCadence({
      count: null,
      hasRemoteTracking: false,
      prePush: isPrePush()
    });
    if (verdict.kind === 'notApplicable') {
      io.notApplicable(verdict.reason);
    }
    io.fail('unexpected evaluator outcome for missing upstream');
  }
  if (!upstream.ok && upstream.reason === 'error') {
    io.fail(upstream.message);
  }

  const remoteRef = /** @type {{ ok: true, ref: string }} */ (upstream).ref;
  const count = countAhead(appDir, remoteRef);

  const verdict = evaluatePushCadence({
    count,
    hasRemoteTracking: true,
    prePush: isPrePush()
  });

  if (verdict.kind === 'notApplicable') {
    io.notApplicable(verdict.reason);
  }
  if (verdict.kind === 'error') {
    io.fail(verdict.message);
  }
  if (verdict.kind === 'fail') {
    io.fail(verdict.message);
  }

  // Pass path — including the pre-push deferral, which must still print the finding.
  if (verdict.kind === 'pass' && verdict.deferred && verdict.message) {
    // Same shape as lg-shipped condition 2: report the finding, then pass.
    console.log(`lg-push-cadence: ${verdict.message} (deferred under REDANVIL_PRE_PUSH=1; CI enforces the threshold)`);
  }
  io.pass();
}

/**
 * CLI / check.mjs exit helpers.
 *
 * @returns {PushCadenceIo}
 */
function defaultIo() {
  return {
    pass: () => process.exit(0),
    fail: (m) => {
      if (m) console.error(m);
      process.exit(1);
    },
    notApplicable: (w) => {
      if (w) console.error(`n/a: ${w}`);
      process.exit(3);
    }
  };
}

if (isMainModule()) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node lg-push-cadence.mjs <appDir>');
    process.exit(2);
  }
  runLgPushCadence(dir, defaultIo());
}
