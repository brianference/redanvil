/**
 * Map unmet checklist rows to the roles that own them.
 *
 * An unowned row is a hard error -- that is the hole that let the three-option
 * step go unbuilt (docs/SPEC-agent-team.md §2).
 */

import { CHECKLIST_RULE_MAP } from '../done/coverage.mjs';
import type { RowStatus } from '../done/coverage.d.mts';
import type { Role, RoleId } from './roles';
import { ROLES } from './roles';

/**
 * One role's batch of unmet work for an iteration.
 */
export interface RoleAssignment {
  /** Role that must act. */
  role: Role;
  /** Checklist rows assigned to this role this round. */
  rows: ReadonlyArray<RowStatus>;
  /** Union of owned rule/row ids that matched. */
  matchedOwns: readonly string[];
}

/**
 * Result of assigning every unmet row.
 */
export interface AssignResult {
  /** Non-empty role batches, sorted by role id. */
  assignments: RoleAssignment[];
  /** Rows that passed and need no work. */
  passed: ReadonlyArray<RowStatus>;
}

/**
 * Error thrown when at least one unmet row has no owner in the registry.
 */
export class UnownedRowError extends Error {
  /** Row ids with no matching role. */
  readonly unownedIds: readonly string[];

  /**
   * @param unownedIds - Row ids nobody owns.
   */
  constructor(unownedIds: readonly string[]) {
    const list = unownedIds.join(', ');
    super(
      `unowned checklist row(s): ${list} -- every unmet row must map to a role ` +
        '(assignUnmetRows fails closed; silent skip is how work is forgotten)'
    );
    this.name = 'UnownedRowError';
    this.unownedIds = unownedIds;
  }
}

/**
 * Collect the set of registry tokens a checklist row can match on.
 *
 * A role owns a row when its `owns` list intersects this set: the row id
 * itself, any bound rubric rule id, any bound isDone opt key, or the builtin
 * name.
 *
 * @param rowId - Checklist row id (e.g. `C10`).
 * @returns Tokens used for ownership matching.
 */
export function ownershipTokensForRow(rowId: string): Set<string> {
  const tokens = new Set<string>([rowId]);
  const binding = CHECKLIST_RULE_MAP[rowId];
  if (binding === undefined) return tokens;
  for (const ruleId of binding.rules ?? []) tokens.add(ruleId);
  for (const opt of binding.opts ?? []) tokens.add(opt);
  if (binding.builtin) tokens.add(binding.builtin);
  return tokens;
}

/**
 * Find every role that owns a given checklist row.
 *
 * @param rowId - Checklist row id.
 * @param roles - Role registry (defaults to ROLES).
 * @returns Matching roles in registry order.
 */
export function rolesForRow(rowId: string, roles: readonly Role[] = ROLES): Role[] {
  const tokens = ownershipTokensForRow(rowId);
  return roles.filter((role) => role.owns.some((o) => tokens.has(o)));
}

/**
 * Map each non-passing checklist row to the role(s) that own it.
 *
 * Primary owner is the first matching role in registry order (specialists
 * before catch-alls where the registry lists them first). Rows owned by
 * multiple roles are assigned to every owner so parallel specialists can act.
 *
 * @param statuses - Output of `checklistCoverage`.
 * @param roles - Role registry (defaults to the full team).
 * @returns Grouped assignments for unmet rows.
 * @throws {UnownedRowError} When any unmet row has no owner.
 */
export function assignUnmetRows(
  statuses: ReadonlyArray<RowStatus>,
  roles: readonly Role[] = ROLES
): AssignResult {
  const passed = statuses.filter((s) => s.status === 'pass');
  const unmet = statuses.filter((s) => s.status !== 'pass');

  /** @type {Map<RoleId, { role: Role, rows: RowStatus[], matched: Set<string> }>} */
  const byRole = new Map<
    RoleId,
    { role: Role; rows: RowStatus[]; matched: Set<string> }
  >();
  const unowned: string[] = [];

  for (const status of unmet) {
    const owners = rolesForRow(status.id, roles);
    if (owners.length === 0) {
      unowned.push(status.id);
      continue;
    }
    const tokens = ownershipTokensForRow(status.id);
    for (const role of owners) {
      let bucket = byRole.get(role.id);
      if (bucket === undefined) {
        bucket = { role, rows: [], matched: new Set() };
        byRole.set(role.id, bucket);
      }
      bucket.rows.push(status);
      for (const o of role.owns) {
        if (tokens.has(o)) bucket.matched.add(o);
      }
    }
  }

  if (unowned.length > 0) {
    // Print and fail -- never silent skip.
    console.error(`assignUnmetRows: unowned rows: ${unowned.join(', ')}`);
    throw new UnownedRowError(unowned);
  }

  const assignments: RoleAssignment[] = [...byRole.values()]
    .map((b) => ({
      role: b.role,
      rows: b.rows,
      matchedOwns: [...b.matched].sort()
    }))
    .sort((a, b) => a.role.id.localeCompare(b.role.id));

  return { assignments, passed };
}

/**
 * Assert every known checklist row id is owned by at least one role.
 *
 * Used in unit tests so a new DONE-CHECKLIST row cannot land unowned.
 *
 * @param rowIds - All row ids from the checklist document.
 * @param roles - Role registry.
 * @returns Sorted list of unowned ids (empty when complete).
 */
export function findUnownedChecklistRows(
  rowIds: readonly string[],
  roles: readonly Role[] = ROLES
): string[] {
  return rowIds.filter((id) => rolesForRow(id, roles).length === 0).sort();
}
