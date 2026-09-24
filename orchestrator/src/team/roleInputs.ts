/**
 * Skip a role whose declared inputs have not changed since its last counted run.
 *
 * The hash lives in the app's `.redanvil/role-inputs.json`. A role with no
 * `inputs` declaration always runs. A matching hash is not enough on its own:
 * every declared input must still be a non-empty file, and every owned artifact
 * must still exist. Otherwise the role runs.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Role } from './roles';
import { expandArtifacts } from './roles';
import { missingArtifacts } from './worktreeEnforcement';

/** Path of the per-app input-hash store, relative to the app directory. */
export const ROLE_INPUT_STORE_REL = join('.redanvil', 'role-inputs.json');

/** One assigned row, the part of the role's input that is not a file. */
export interface RoleInputRow {
  id: string;
  status: string;
  detail?: string;
}

/**
 * Absolute path of the hash store for an app.
 *
 * @param appDir - App directory.
 * @returns Absolute path.
 */
export function roleInputStorePath(appDir: string): string {
  return join(appDir, ROLE_INPUT_STORE_REL);
}

/**
 * Expand `<slug>` in a role's declared input paths.
 *
 * @param role - Registry role.
 * @param slug - App slug.
 * @returns Concrete relative paths. Empty when the role declares none.
 */
export function declaredInputPaths(role: Role, slug: string): string[] {
  return (role.inputs ?? []).map((p) => p.replaceAll('<slug>', slug));
}

/**
 * Whether every declared input is a non-empty file.
 *
 * A missing input is not "unchanged". Hashing the absence would let a role
 * skip forever after one counted run that happened before the file existed.
 *
 * @param appDir - App directory.
 * @param paths - Relative input paths.
 * @returns True when each path is a non-empty file.
 */
function inputsAllPresent(appDir: string, paths: readonly string[]): boolean {
  for (const rel of paths) {
    const abs = join(appDir, rel);
    if (!existsSync(abs)) return false;
    try {
      const st = statSync(abs);
      if (!st.isFile() || st.size === 0) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * SHA-256 of declared input file bytes plus the assigned rows.
 *
 * @param appDir - App directory the relative paths are under.
 * @param role - Registry role.
 * @param rows - Rows handed to the role this iteration.
 * @param slug - App slug.
 * @returns Hex digest, or null when the role declares no inputs.
 */
export function hashDeclaredInputs(
  appDir: string,
  role: Role,
  rows: ReadonlyArray<RoleInputRow>,
  slug: string
): string | null {
  const paths = declaredInputPaths(role, slug);
  if (paths.length === 0) return null;
  const hash = createHash('sha256');
  for (const rel of [...paths].sort()) {
    hash.update(rel);
    hash.update('\0');
    const abs = join(appDir, rel);
    if (!existsSync(abs)) {
      hash.update('MISSING');
    } else {
      try {
        const st = statSync(abs);
        if (!st.isFile() || st.size === 0) hash.update('MISSING');
        else hash.update(readFileSync(abs));
      } catch {
        hash.update('MISSING');
      }
    }
    hash.update('\0');
  }
  const rowText = [...rows]
    .map((r) => `${r.id}\t${r.status}\t${r.detail ?? ''}`)
    .sort()
    .join('\n');
  hash.update(rowText);
  return hash.digest('hex');
}

/**
 * Read the stored hashes. A missing or unreadable file is an empty record,
 * so the next counted run rewrites it rather than skipping on garbage.
 *
 * @param appDir - App directory.
 * @returns Role id → hex hash.
 */
export function readRoleInputHashes(appDir: string): Record<string, string> {
  const p = roleInputStorePath(appDir);
  if (!existsSync(p)) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)) out[key] = value;
  }
  return out;
}

/**
 * Remember the input hash for a role that counted as run.
 *
 * No-op when the role declares no inputs. Synchronous on purpose: parallel
 * roles call this without an await between read and write, so the calls do
 * not interleave on the JS thread.
 *
 * @param appDir - App directory (the stable tree, not a disposable worktree).
 * @param role - Registry role.
 * @param rows - Rows from the counted run.
 * @param slug - App slug.
 */
export function recordCountedRoleInputs(
  appDir: string,
  role: Role,
  rows: ReadonlyArray<RoleInputRow>,
  slug: string
): void {
  const hash = hashDeclaredInputs(appDir, role, rows, slug);
  if (hash === null) return;
  const all = readRoleInputHashes(appDir);
  const attempts = readAttempts(appDir);
  const previous = attempts[role.id];
  attempts[role.id] = {
    hash,
    count: previous !== undefined && previous.hash === hash ? previous.count + 1 : 1
  };
  all[role.id] = hash;
  const p = roleInputStorePath(appDir);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(all, null, 2)}\n`);
  writeFileSync(attemptStorePath(appDir), `${JSON.stringify(attempts, null, 2)}\n`);
}

/**
 * Counted runs on identical inputs before a role with failing rows is skipped.
 *
 * An agent re-run can fix a row the last run did not, so a failing row is
 * retried. It is not retried forever on the same inputs: after this many
 * identical attempts the role is skipped (and logged) until an input changes.
 */
export const MAX_IDENTICAL_ATTEMPTS = 2;

/**
 * Where consecutive identical-input attempts are counted.
 *
 * @param appDir - App directory.
 * @returns Absolute path of the attempts store.
 */
function attemptStorePath(appDir: string): string {
  return join(dirname(roleInputStorePath(appDir)), 'role-input-attempts.json');
}

/**
 * Consecutive counted runs per role on the same input hash.
 *
 * @param appDir - App directory.
 * @returns Role id to {hash, count}; empty when absent or unreadable.
 */
function readAttempts(appDir: string): Record<string, { hash: string; count: number }> {
  const p = attemptStorePath(appDir);
  if (!existsSync(p)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(p, 'utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, { hash: string; count: number }> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const v = value as { hash?: unknown; count?: unknown };
      if (typeof v?.hash === 'string' && Number.isInteger(v.count)) {
        out[key] = { hash: v.hash, count: v.count as number };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Whether this role should not be spawned this iteration.
 *
 * @param appDir - App directory.
 * @param role - Registry role.
 * @param rows - Rows it would be given.
 * @param slug - App slug.
 * @returns True only when inputs are unchanged and owned artifacts still exist.
 */
export function shouldSkipUnchangedRole(
  appDir: string,
  role: Role,
  rows: ReadonlyArray<RoleInputRow>,
  slug: string
): boolean {
  const paths = declaredInputPaths(role, slug);
  if (paths.length === 0) return false;
  if (!inputsAllPresent(appDir, paths)) return false;
  const hash = hashDeclaredInputs(appDir, role, rows, slug);
  if (hash === null) return false;
  const stored = readRoleInputHashes(appDir)[role.id];
  if (stored !== hash) return false;
  // A role handed a failing row still has work to do. Retry it on the same
  // inputs up to MAX_IDENTICAL_ATTEMPTS counted runs; past that, re-running the
  // same inputs is burning budget, and the PM logs the skip.
  if (rows.some((row) => row.status !== 'pass')) {
    const attempt = readAttempts(appDir)[role.id];
    if (attempt === undefined || attempt.hash !== hash) return false;
    if (attempt.count < MAX_IDENTICAL_ATTEMPTS) return false;
  }
  const artifacts = expandArtifacts(role.artifacts, slug);
  return missingArtifacts(appDir, artifacts).length === 0;
}
