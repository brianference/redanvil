/**
 * Hard enforcement inside a role worktree.
 *
 * Hooks and promote-path checks so an agent cannot commit "done" without the
 * measurement file on disk (docs/SPEC-agent-team.md §5b).
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandArtifacts, type Role, type RoleId } from './roles';

/** Directory under the worktree that holds assignment + local hooks. */
export const REDANVIL_DIR = '.redanvil';
/** Assignment file name inside .redanvil/. */
export const ASSIGNMENT_FILE = 'assignment.json';
/** Optional gate status the pre-commit hook reads (agent or harness writes it). */
export const GATE_STATUS_FILE = 'gate-status.json';

/**
 * Written at worktree creation. Hooks trust this file, not the agent.
 */
export interface WorktreeAssignment {
  /** Role playing in this worktree. */
  roleId: RoleId;
  /** Checklist row ids assigned. */
  rows: string[];
  /** Artifact paths (slug-expanded) the role must produce. */
  artifacts: string[];
  /** App slug. */
  slug: string;
  /** ISO time the worktree was created. */
  createdAt: string;
}

/**
 * Gate status recorded for the worktree's own gate run.
 */
export interface WorktreeGateStatus {
  /** True only when the worktree gate passed. */
  passed: boolean;
  /** Optional score. */
  score?: number;
  /** ISO time of the gate run. */
  checkedAt: string;
}

/** Words that claim completion -- commit-msg rejects them without evidence. */
export const DONE_CLAIM_WORDS = Object.freeze([
  'done',
  'complete',
  'finished',
  'working',
  'verified',
  'passing'
] as const);

/**
 * Absolute path to the hook scripts shipped with the orchestrator.
 *
 * @returns Directory containing pre-commit.mjs, commit-msg.mjs, pre-push.mjs.
 */
export function hookScriptsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../scripts/team/hooks');
}

/**
 * Join path segments with `/` for assignment/hook paths (repo-relative, portable).
 *
 * @param parts - Path segments (empty segments dropped).
 * @returns POSIX-style relative path.
 */
export function joinRepoPath(...parts: string[]): string {
  return parts
    .filter((p) => p.length > 0)
    .join('/')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');
}

/**
 * App path relative to the repo root, suitable as an artifact path prefix.
 *
 * Returns empty when the app IS the repo root (or cannot be expressed as a
 * relative subpath). Hooks and runRole both resolve declared artifacts from the
 * worktree/repo root; when the app lives in a subdirectory the role registry's
 * app-scoped paths (`src/...`) must be prefixed so the hook does not look at
 * `<worktree>/src/...` while the agent wrote `<worktree>/<app>/src/...`.
 *
 * @param repoDir - Repository (or worktree) root.
 * @param appDir - App directory (absolute or relative to repoDir).
 * @returns Prefix like `app-builder`, or `''` when none.
 */
export function artifactPathPrefix(repoDir: string, appDir: string): string {
  const absRepo = resolve(repoDir);
  const absApp = resolve(repoDir, appDir);
  const rel = relative(absRepo, absApp);
  if (rel === '' || rel === '.') return '';
  if (isAbsolute(rel) || rel.startsWith(`..${sep}`) || rel === '..') return '';
  return rel.split(sep).join('/');
}

/**
 * Expand role artifact templates and, when needed, prefix with the app subdir
 * so paths are worktree-root-relative (same base the pre-commit hook uses).
 *
 * @param artifacts - Role registry templates (may include `<slug>`).
 * @param slug - App slug.
 * @param pathPrefix - From {@link artifactPathPrefix}; empty when app is root.
 * @returns Repo-/worktree-relative artifact paths.
 */
export function resolveRoleArtifacts(
  artifacts: readonly string[],
  slug: string,
  pathPrefix = ''
): string[] {
  const expanded = expandArtifacts(artifacts, slug);
  if (!pathPrefix) return expanded;
  return expanded.map((a) => joinRepoPath(pathPrefix, a));
}

/**
 * Build an assignment record for a role worktree.
 *
 * Artifact paths are worktree-root-relative so `evaluatePreCommit` (cwd =
 * worktree root) and `runRole` (with the same root) resolve identical paths.
 *
 * @param role - Role from the registry.
 * @param slug - App slug.
 * @param rows - Checklist row ids assigned this round.
 * @param opts - Optional path prefix when the app is a monorepo subdirectory.
 * @returns Assignment JSON body.
 */
export function buildAssignment(
  role: Role,
  slug: string,
  rows: readonly string[],
  opts: { pathPrefix?: string } = {}
): WorktreeAssignment {
  return {
    roleId: role.id,
    rows: [...rows],
    artifacts: resolveRoleArtifacts(role.artifacts, slug, opts.pathPrefix ?? ''),
    slug,
    createdAt: new Date().toISOString()
  };
}

/**
 * Write assignment.json into a worktree.
 *
 * @param worktreeDir - Worktree root.
 * @param assignment - Assignment body.
 * @returns Path written.
 */
export function writeAssignment(
  worktreeDir: string,
  assignment: WorktreeAssignment
): string {
  const dir = join(worktreeDir, REDANVIL_DIR);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, ASSIGNMENT_FILE);
  writeFileSync(path, `${JSON.stringify(assignment, null, 2)}\n`, 'utf8');
  return path;
}

/**
 * Read assignment.json from a worktree.
 *
 * @param worktreeDir - Worktree root.
 * @returns Assignment, or null when missing/invalid.
 */
export function readAssignment(worktreeDir: string): WorktreeAssignment | null {
  const path = join(worktreeDir, REDANVIL_DIR, ASSIGNMENT_FILE);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as WorktreeAssignment;
  } catch {
    return null;
  }
}

/**
 * Check that every required artifact exists and is non-empty.
 *
 * @param worktreeDir - Artifact root (worktree root for role runs; same base
 *   the pre-commit hook uses via `process.cwd()` / git work-tree root).
 * @param artifacts - Paths relative to that root.
 * @returns Missing or empty paths.
 */
export function missingArtifacts(
  worktreeDir: string,
  artifacts: readonly string[]
): string[] {
  const missing: string[] = [];
  for (const rel of artifacts) {
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
 * SHA-256 of file contents, or null when the path is absent, empty, or unreadable.
 *
 * Used as the pre/post-run content check: presence alone is not evidence of work.
 *
 * @param artifactRoot - Base directory for relative paths.
 * @param rel - Path relative to artifactRoot.
 * @returns Hex digest, or null.
 */
export function artifactFingerprint(
  artifactRoot: string,
  rel: string
): string | null {
  const abs = join(artifactRoot, rel);
  if (!existsSync(abs)) return null;
  try {
    const st = statSync(abs);
    if (!st.isFile() || st.size === 0) return null;
    return createHash('sha256').update(readFileSync(abs)).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Snapshot content fingerprints for declared artifacts (null = missing/empty).
 *
 * @param artifactRoot - Base directory.
 * @param artifacts - Relative paths.
 * @returns Map of path → fingerprint or null.
 */
export function snapshotArtifacts(
  artifactRoot: string,
  artifacts: readonly string[]
): Map<string, string | null> {
  const snap = new Map<string, string | null>();
  for (const rel of artifacts) {
    snap.set(rel, artifactFingerprint(artifactRoot, rel));
  }
  return snap;
}

/**
 * Declared artifacts that are present and non-empty but byte-identical to the
 * pre-run snapshot (including files that already existed before the role ran).
 *
 * A role that touches nothing fails here even when every path exists.
 * A no-op rewrite with identical bytes also fails.
 *
 * @param artifactRoot - Base directory.
 * @param artifacts - Relative paths.
 * @param before - Snapshot taken before the agent ran.
 * @returns Paths that did not change.
 */
export function unchangedArtifacts(
  artifactRoot: string,
  artifacts: readonly string[],
  before: ReadonlyMap<string, string | null>
): string[] {
  const unchanged: string[] = [];
  for (const rel of artifacts) {
    const after = artifactFingerprint(artifactRoot, rel);
    if (after === null) continue; // missing/empty → missingArtifacts
    const prev = before.get(rel) ?? null;
    if (prev === after) unchanged.push(rel);
  }
  return unchanged;
}

/**
 * Whether a commit message claims completion.
 *
 * @param message - Commit message body.
 * @returns True when a done-claim word appears as a whole word.
 */
export function messageClaimsDone(message: string): boolean {
  const lower = message.toLowerCase();
  return DONE_CLAIM_WORDS.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(lower));
}

/**
 * Whether JSON measurement artifacts record a pass/accept outcome.
 *
 * @param worktreeDir - Worktree root.
 * @param artifacts - Paths to check.
 * @returns True when every JSON evidence file has a passing verdict.
 */
export function artifactsRecordPass(
  worktreeDir: string,
  artifacts: readonly string[]
): boolean {
  for (const rel of artifacts) {
    if (!rel.endsWith('.json')) continue;
    const abs = join(worktreeDir, rel);
    if (!existsSync(abs)) return false;
    try {
      const raw = JSON.parse(readFileSync(abs, 'utf8')) as {
        verdict?: string;
        passed?: boolean;
      };
      const ok =
        raw.verdict === 'pass' ||
        raw.verdict === 'accept' ||
        raw.passed === true;
      if (!ok) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Evaluate pre-commit conditions for a worktree.
 *
 * @param worktreeDir - Worktree root.
 * @param opts - Optional overrides for tests.
 * @returns ok + reasons.
 */
export function evaluatePreCommit(
  worktreeDir: string,
  opts: {
    /** Injected unimplemented row ids (defaults to empty when no binder). */
    unimplementedRows?: () => string[];
  } = {}
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
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

  const gatePath = join(worktreeDir, REDANVIL_DIR, GATE_STATUS_FILE);
  if (!existsSync(gatePath)) {
    reasons.push('missing .redanvil/gate-status.json -- worktree gate has not passed');
  } else {
    try {
      const gate = JSON.parse(readFileSync(gatePath, 'utf8')) as WorktreeGateStatus;
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
 * Evaluate commit-msg: reject done-claims without a passing measurement.
 *
 * @param worktreeDir - Worktree root.
 * @param message - Commit message.
 * @returns ok + reasons.
 */
export function evaluateCommitMsg(
  worktreeDir: string,
  message: string
): { ok: boolean; reasons: string[] } {
  if (!messageClaimsDone(message)) {
    return { ok: true, reasons: [] };
  }
  const assignment = readAssignment(worktreeDir);
  if (assignment === null) {
    return {
      ok: false,
      reasons: [
        'commit message claims completion but .redanvil/assignment.json is missing'
      ]
    };
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

/**
 * Promote-path checks (server-side; hooks can be skipped with --no-verify).
 *
 * @param worktreeDir - Worktree root.
 * @param opts - Newest source commit time + QA-visual path.
 * @returns ok + reasons.
 */
export function evaluatePromoteGuards(
  worktreeDir: string,
  opts: {
    /** Unix ms of newest source commit in the worktree; artifacts must be newer. */
    newestSourceCommitMs: number | null;
    /** Absolute or worktree-relative path to qa-visual report. */
    qaVisualPath?: string;
    /** When set, require this QA-visual verdict. */
    requireQaVisual?: boolean;
  }
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const assignment = readAssignment(worktreeDir);
  if (assignment === null) {
    reasons.push('promote refused: missing assignment.json');
    return { ok: false, reasons };
  }

  const missing = missingArtifacts(worktreeDir, assignment.artifacts);
  if (missing.length > 0) {
    reasons.push(`promote refused: artifacts missing or empty: ${missing.join(', ')}`);
  }

  if (opts.newestSourceCommitMs !== null) {
    for (const rel of assignment.artifacts) {
      const abs = join(worktreeDir, rel);
      if (!existsSync(abs)) continue;
      const mtime = statSync(abs).mtimeMs;
      if (mtime < opts.newestSourceCommitMs) {
        reasons.push(
          `promote refused: artifact ${rel} mtime predates newest source commit (stale evidence)`
        );
      }
    }
  }

  if (opts.requireQaVisual !== false) {
    const qaPath =
      opts.qaVisualPath ??
      join(worktreeDir, 'evidence', `qa-visual-${assignment.slug}.json`);
    const resolved = resolve(qaPath);
    if (!existsSync(resolved)) {
      reasons.push('promote refused: QA-visual verdict absent');
    } else {
      try {
        const raw = JSON.parse(readFileSync(resolved, 'utf8')) as { verdict?: string };
        if (raw.verdict === 'fail') {
          reasons.push('promote refused: QA-visual verdict is fail');
        } else if (raw.verdict !== 'pass') {
          reasons.push('promote refused: QA-visual verdict missing or not pass');
        }
      } catch {
        reasons.push('promote refused: QA-visual report unreadable');
      }
    }
  }

  return { ok: reasons.length === 0, reasons };
}

/**
 * Install assignment + hooks into a worktree so commits are physically gated.
 *
 * Sets core.hooksPath to .redanvil/hooks inside the worktree.
 *
 * @param worktreeDir - Worktree root.
 * @param assignment - Role assignment.
 * @param run - Command runner (git config).
 * @returns Paths installed.
 */
export async function installWorktreeEnforcement(
  worktreeDir: string,
  assignment: WorktreeAssignment,
  run: (
    command: string,
    args: string[],
    opts?: { cwd?: string }
  ) => Promise<{ code: number | null; stdout: string; stderr: string }>
): Promise<{ assignmentPath: string; hooksDir: string }> {
  const assignmentPath = writeAssignment(worktreeDir, assignment);
  const hooksDir = join(worktreeDir, REDANVIL_DIR, 'hooks');
  mkdirSync(hooksDir, { recursive: true });

  const srcDir = hookScriptsDir();
  for (const name of [
    'pre-commit.mjs',
    'commit-msg.mjs',
    'pre-push.mjs',
    'lib-enforcement.mjs'
  ] as const) {
    const src = join(srcDir, name);
    const dest = join(hooksDir, name);
    if (!existsSync(src)) {
      throw new Error(`missing hook script: ${src}`);
    }
    writeFileSync(dest, readFileSync(src, 'utf8'), 'utf8');
  }

  // Portable sh wrappers that invoke node on the .mjs implementations.
  writeHookWrapper(join(hooksDir, 'pre-commit'), 'pre-commit.mjs');
  writeHookWrapper(join(hooksDir, 'commit-msg'), 'commit-msg.mjs');
  writeHookWrapper(join(hooksDir, 'pre-push'), 'pre-push.mjs');

  const cfg = await run(
    'git',
    ['-C', worktreeDir, 'config', 'core.hooksPath', join(REDANVIL_DIR, 'hooks')]
  );
  if (cfg.code !== 0) {
    throw new Error(`failed to set core.hooksPath: ${cfg.stderr || cfg.stdout}`);
  }

  return { assignmentPath, hooksDir };
}

/**
 * Write a POSIX shell hook wrapper that runs the sibling .mjs with node.
 *
 * @param wrapperPath - Path for the git hook name (no extension).
 * @param mjsName - Sibling script name.
 */
function writeHookWrapper(wrapperPath: string, mjsName: string): void {
  const body = `#!/bin/sh
# RedAnvil worktree enforcement -- generated; do not edit by hand.
set -eu
DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
NODE=\${NODE:-node}
exec "$NODE" "$DIR/${mjsName}" "$@"
`;
  writeFileSync(wrapperPath, body, 'utf8');
  if (process.platform !== 'win32') {
    try {
      chmodSync(wrapperPath, 0o755);
    } catch {
      // Non-fatal on exotic filesystems.
    }
  }
}
