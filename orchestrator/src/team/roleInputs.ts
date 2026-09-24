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
  all[role.id] = hash;
  const p = roleInputStorePath(appDir);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(all, null, 2)}\n`);
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
  const artifacts = expandArtifacts(role.artifacts, slug);
  return missingArtifacts(appDir, artifacts).length === 0;
}
