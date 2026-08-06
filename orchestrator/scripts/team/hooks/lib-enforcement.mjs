/**
 * Pure JS mirror of worktree enforcement checks for git hooks (no TS/tsx).
 * Keep behaviour aligned with src/team/worktreeEnforcement.ts.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/** @type {readonly string[]} */
export const DONE_CLAIM_WORDS = Object.freeze([
  'done',
  'complete',
  'finished',
  'working',
  'verified',
  'passing'
]);

/**
 * @param {string} worktreeDir
 * @returns {object | null}
 */
export function readAssignment(worktreeDir) {
  const path = join(worktreeDir, '.redanvil', 'assignment.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {string} worktreeDir
 * @param {readonly string[]} artifacts
 * @returns {string[]}
 */
export function missingArtifacts(worktreeDir, artifacts) {
  /** @type {string[]} */
  const missing = [];
  for (const rel of artifacts ?? []) {
    const abs = join(worktreeDir, rel);
    if (!existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    try {
      const st = statSync(abs);
      if (!st.isFile() || st.size === 0) missing.push(rel);
    } catch {
      missing.push(rel);
    }
  }
  return missing;
}

/**
 * @param {string} message
 * @returns {boolean}
 */
export function messageClaimsDone(message) {
  const lower = message.toLowerCase();
  return DONE_CLAIM_WORDS.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(lower));
}

/**
 * @param {string} worktreeDir
 * @param {readonly string[]} artifacts
 * @returns {boolean}
 */
export function artifactsRecordPass(worktreeDir, artifacts) {
  for (const rel of artifacts ?? []) {
    if (!rel.endsWith('.json')) continue;
    const abs = join(worktreeDir, rel);
    if (!existsSync(abs)) return false;
    try {
      const raw = JSON.parse(readFileSync(abs, 'utf8'));
      const ok =
        raw.verdict === 'pass' || raw.verdict === 'accept' || raw.passed === true;
      if (!ok) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * @param {string} worktreeDir
 * @param {{ unimplementedRows?: () => string[] }} [opts]
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function evaluatePreCommit(worktreeDir, opts = {}) {
  /** @type {string[]} */
  const reasons = [];
  const assignment = readAssignment(worktreeDir);
  if (assignment === null) {
    reasons.push('missing .redanvil/assignment.json -- worktree is not role-bound');
    return { ok: false, reasons };
  }

  const missing = missingArtifacts(worktreeDir, assignment.artifacts);
  if (missing.length > 0) {
    reasons.push(
      `required artifact(s) absent or empty for role ${assignment.roleId}: ${missing.join(', ')}`
    );
  }

  const gatePath = join(worktreeDir, '.redanvil', 'gate-status.json');
  if (!existsSync(gatePath)) {
    reasons.push('missing .redanvil/gate-status.json -- worktree gate has not passed');
  } else {
    try {
      const gate = JSON.parse(readFileSync(gatePath, 'utf8'));
      if (gate.passed !== true) {
        reasons.push('worktree gate is red (gate-status.passed !== true)');
      }
    } catch {
      reasons.push('gate-status.json is unreadable');
    }
  }

  const unimplemented = opts.unimplementedRows?.() ?? [];
  if (unimplemented.length > 0) {
    reasons.push(`unimplementedRows() non-empty: ${unimplemented.join(', ')}`);
  }

  return { ok: reasons.length === 0, reasons };
}

/**
 * @param {string} worktreeDir
 * @param {string} message
 * @returns {{ ok: boolean, reasons: string[] }}
 */

/**
 * Role-worktree branch names created by pmRuntime: ra-role-<id>-i<n>-<suffix>.
 * Kept in step with ROLE_BRANCH_PATTERN in team/roleWorktreeLifecycle.ts.
 */
const ROLE_BRANCH_RE = /^ra-role-[a-z0-9]+(?:-[a-z0-9]+)*-i\d+-[a-z0-9]+$/;

/**
 * True when this directory is one of the managed ROLE worktrees.
 *
 * The artifact rules exist for role commits. The main tree has no assignment
 * and never will, so applying them there refuses every ordinary commit whose
 * message happens to sound like completion -- which is exactly what happened:
 * this hook blocked the very commit that installed it. Scope by where the
 * commit is being made, not by what its message says.
 *
 * @param {string} worktreeDir
 * @returns {boolean}
 */
export function isRoleWorktree(worktreeDir) {
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: worktreeDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return ROLE_BRANCH_RE.test(branch);
  } catch {
    return false;
  }
}

export function evaluateCommitMsg(worktreeDir, message) {
  if (!messageClaimsDone(message)) {
    return { ok: true, reasons: [] };
  }
  // Align with worktreeEnforcement.ts: a worktree that carries an assignment
  // is role-bound regardless of branch name. Early-returning on non-role
  // branch names let "feat: done …" through with a fail verdict on disk.
  // Role branch without assignment is still refused (cannot escape by delete).
  const assignment = readAssignment(worktreeDir);
  if (assignment === null) {
    if (isRoleWorktree(worktreeDir)) {
      return {
        ok: false,
        reasons: [
          'commit message claims completion but .redanvil/assignment.json is missing'
        ]
      };
    }
    // Not role-bound and no assignment: nothing to enforce here.
    return { ok: true, reasons: [] };
  }
  const missing = missingArtifacts(worktreeDir, assignment.artifacts);
  if (missing.length > 0) {
    return {
      ok: false,
      reasons: [
        `commit message claims completion but artifact(s) missing: ${missing.join(', ')}`
      ]
    };
  }
  if (!artifactsRecordPass(worktreeDir, assignment.artifacts)) {
    return {
      ok: false,
      reasons: [
        'commit message claims completion but measurement file does not record a pass/accept verdict'
      ]
    };
  }
  return { ok: true, reasons: [] };
}
