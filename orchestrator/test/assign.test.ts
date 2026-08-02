/**
 * assignUnmetRows: every checklist row maps to a role; an unowned row raises.
 */
import { describe, it, expect } from 'vitest';
import { loadChecklistRows } from '../src/done/checklist.mjs';
import { checklistCoverage } from '../src/done/coverage.mjs';
import type { RowStatus } from '../src/done/coverage.d.mts';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assignUnmetRows,
  findUnownedChecklistRows,
  UnownedRowError,
  rolesForRow
} from '../src/team/assign';
import { ROLES, type Role } from '../src/team/roles';
import { RULES } from '../src/rubric/rules';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CHECKLIST_PATH = join(REPO_ROOT, 'docs/DONE-CHECKLIST.md');

describe('assignUnmetRows', () => {
  const rows = loadChecklistRows(CHECKLIST_PATH);

  it('every checklist row maps to at least one role', () => {
    const unowned = findUnownedChecklistRows(rows.map((r) => r.id), ROLES);
    expect(unowned, `unowned rows: ${unowned.join(', ')}`).toEqual([]);
  });

  it('an unowned row raises UnownedRowError', () => {
    const statuses: RowStatus[] = [
      {
        id: 'Z99',
        section: 'Z',
        mustBeTrue: 'invented gap nobody owns',
        status: 'fail',
        detail: 'test'
      }
    ];
    expect(() => assignUnmetRows(statuses, ROLES)).toThrow(UnownedRowError);
    try {
      assignUnmetRows(statuses, ROLES);
    } catch (err) {
      expect(err).toBeInstanceOf(UnownedRowError);
      expect((err as UnownedRowError).unownedIds).toContain('Z99');
    }
  });

  it('maps real unmet rows to owning roles', () => {
    const statuses = checklistCoverage({
      rows,
      ruleOutcomes: [],
      optValues: {},
      scoreMet: false,
      noFailedRules: false
    });
    const { assignments, passed } = assignUnmetRows(statuses, ROLES);
    expect(passed.length).toBe(0);
    expect(assignments.length).toBeGreaterThan(0);
    const assignedIds = new Set(assignments.flatMap((a) => a.rows.map((r) => r.id)));
    for (const row of rows) {
      expect(assignedIds.has(row.id), `row ${row.id} was not assigned`).toBe(true);
    }
  });

  it('C10 is owned by qa-visual', () => {
    const owners = rolesForRow('C10', ROLES).map((r) => r.id);
    expect(owners).toContain('qa-visual');
  });

  it('C9 is owned by layout', () => {
    const owners = rolesForRow('C9', ROLES).map((r) => r.id);
    expect(owners).toContain('layout');
  });

  it('a custom registry with a hole raises on that hole only', () => {
    const tiny: Role[] = [
      {
        id: 'engineer',
        owns: ['A1'],
        artifacts: ['src/index.ts'],
        needsWorktree: true,
        prompt: 'only A1'
      }
    ];
    const statuses: RowStatus[] = [
      {
        id: 'A1',
        section: 'A',
        mustBeTrue: 'tsc',
        status: 'fail',
        detail: 'x'
      },
      {
        id: 'C10',
        section: 'C',
        mustBeTrue: 'viewport',
        status: 'fail',
        detail: 'x'
      }
    ];
    expect(() => assignUnmetRows(statuses, tiny)).toThrow(/C10/);
  });

  it('passing rows are not assigned', () => {
    const ruleOutcomes = RULES.map((r) => ({ ruleId: r.id, passed: true }));
    const statuses = checklistCoverage({
      rows: rows.slice(0, 3),
      ruleOutcomes,
      optValues: {
        unitTestsPass: true,
        acceptanceTestsPass: true,
        coveragePct: 100,
        screenshotsPresent: true,
        evidenceStale: false,
        independentReviewOk: true,
        qaVisualOk: true,
        userRefuseOk: true
      },
      scoreMet: true,
      noFailedRules: true
    });
    // Force first row pass only if measured; filter to known-pass
    const allPass = statuses.map((s) => ({ ...s, status: 'pass' as const, detail: 'forced' }));
    const { assignments, passed } = assignUnmetRows(allPass, ROLES);
    expect(assignments).toEqual([]);
    expect(passed).toHaveLength(allPass.length);
  });
});
