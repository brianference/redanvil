/**
 * PM dry-run over unmet rows; budget ceiling halts rather than lowering the bar.
 */
import { describe, it, expect } from 'vitest';
import { loadChecklistRows } from '../src/done/checklist.mjs';
import { checklistCoverage } from '../src/done/coverage.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dryRunAssignments, planIteration, runPm } from '../src/team/pm';
import { ROLES } from '../src/team/roles';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CHECKLIST_PATH = join(REPO_ROOT, 'docs/DONE-CHECKLIST.md');

/**
 * Build statuses that look like an unfinished az-planting-calendar-style result:
 * many rules unmeasured, product-judgement opts absent.
 */
function unmetLikeAz(): ReturnType<typeof checklistCoverage> {
  const rows = loadChecklistRows(CHECKLIST_PATH);
  return checklistCoverage({
    rows,
    ruleOutcomes: [
      { ruleId: 'u-typing-strict', passed: true },
      { ruleId: 'fe-result-in-viewport', passed: false },
      { ruleId: 'fe-brand-mark-size', passed: false },
      { ruleId: 'proc-design-options', passed: false },
      { ruleId: 'fe-legal-substance', passed: false },
      { ruleId: 'fe-resource-links', passed: false }
    ],
    optValues: {
      unitTestsPass: true,
      acceptanceTestsPass: true,
      screenshotsPresent: true,
      evidenceStale: false,
      independentReviewOk: true,
      qaVisualOk: false,
      userRefuseOk: false
    },
    scoreMet: false,
    noFailedRules: false
  });
}

describe('PM dry-run assignments', () => {
  it('prints role assignments for unmet rows (az-planting-calendar-shaped)', () => {
    const statuses = unmetLikeAz();
    const { plan, lines } = dryRunAssignments(statuses, ROLES);
    expect(plan.assignments.length).toBeGreaterThan(0);
    const roleIds = plan.assignments.map((a) => a.role.id);
    // Visual / product gaps from this session map to these owners.
    expect(roleIds).toEqual(expect.arrayContaining(['qa-visual', 'logo', 'layout', 'content', 'qa-data']));
    console.log('PM dry-run (az-shaped unmet rows):\n' + lines.join('\n'));
  });

  it('withholds user-refuse while other roles still have work', () => {
    const statuses = unmetLikeAz();
    const plan = planIteration(statuses, ROLES, 1);
    const ids = plan.assignments.map((a) => a.role.id);
    // user-refuse only when nothing else is left
    if (ids.length > 1) {
      expect(ids).not.toContain('user-refuse');
    }
  });
});

describe('runPm budget ceiling', () => {
  it('halts unfinished when budget is exhausted rather than lowering the bar', async () => {
    let gateCalls = 0;
    const result = await runPm(
      {
        readStatuses: async () => unmetLikeAz(),
        runRole: async () => {
          /* no-op */
        },
        gate: async () => {
          gateCalls += 1;
          return {
            score: 40,
            blockers: ['fe-result-in-viewport'],
            feedback: 'primary result off-screen'
          };
        },
        isDone: async () => ({
          done: false,
          reasons: ['QA-visual fail', 'score below threshold']
        })
      },
      {
        threshold: 90,
        maxIters: 5,
        budgetCeiling: 2,
        stagnationLimit: 2
      }
    );
    expect(result.finished).toBe(false);
    expect(result.budgetUsed).toBeLessThanOrEqual(2);
    // Bar not lowered: score still below threshold / not passed as done.
    expect(result.loop.passed).toBe(false);
    expect(gateCalls).toBeGreaterThan(0);
    console.log(
      'PM budget halt:',
      JSON.stringify(
        {
          finished: result.finished,
          budgetUsed: result.budgetUsed,
          budgetExhausted: result.budgetExhausted,
          stopReason: result.loop.stopReason,
          doneReasons: result.doneReasons.slice(0, 4)
        },
        null,
        2
      )
    );
  });

  it('dryRun only plans and does not execute roles', async () => {
    let rolesRun = 0;
    const result = await runPm(
      {
        readStatuses: async () => unmetLikeAz(),
        runRole: async () => {
          rolesRun += 1;
        },
        gate: async () => {
          throw new Error('gate should not run in dryRun');
        },
        isDone: async () => ({ done: false, reasons: [] })
      },
      { threshold: 90, maxIters: 3, dryRun: true }
    );
    expect(rolesRun).toBe(0);
    expect(result.plans).toHaveLength(1);
    expect(result.finished).toBe(false);
  });
});
