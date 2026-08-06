/**
 * Proof for PM-SIMULATION-LEARNINGS learning 6:
 * (d) when every score-raising role is blocked, dispatch only unblocking roles
 *     and report sessions saved in the run summary.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadChecklistRows } from '../src/done/checklist.mjs';
import { checklistCoverage } from '../src/done/coverage.mjs';
import { dirname, join as pathJoin } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planIteration, runPm } from '../src/team/pm';
import { ROLES } from '../src/team/roles';

const REPO_ROOT = pathJoin(dirname(fileURLToPath(import.meta.url)), '../..');
const CHECKLIST_PATH = pathJoin(REPO_ROOT, 'docs/DONE-CHECKLIST.md');

function unmetWithManyRoles() {
  const rows = loadChecklistRows(CHECKLIST_PATH);
  return checklistCoverage({
    rows,
    ruleOutcomes: [
      { ruleId: 'u-typing-strict', passed: false },
      { ruleId: 'fe-result-in-viewport', passed: false },
      { ruleId: 'fe-brand-mark-size', passed: false },
      { ruleId: 'proc-design-options', passed: false },
      { ruleId: 'fe-legal-substance', passed: false },
      { ruleId: 'fe-resource-links', passed: false },
      { ruleId: 'fe-product-completeness', passed: false }
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

function writeProductBrief(appDir: string, slug: string): void {
  mkdirSync(join(appDir, 'docs'), { recursive: true });
  writeFileSync(
    join(appDir, 'docs', `${slug}-product-brief.md`),
    [
      '# Product brief',
      '',
      '## Promises',
      '',
      '- Browse sitters | owns: B4',
      '',
      'Core job: find a sitter.',
      'Acceptance: list renders.',
      ''
    ].join('\n')
  );
}

describe('learning: do not pay for an iteration that cannot improve', () => {
  it('(d) design blocked → only logo/layout; sessionsSaved reported', async () => {
    const appDir = mkdtempSync(join(tmpdir(), 'ra-econ-d-'));
    const slug = 'econ-app';
    try {
      writeProductBrief(appDir, slug);
      // No design-refs → design precondition blocks build and (now) all non-design.
      const statuses = unmetWithManyRoles();
      const plan = planIteration(statuses, ROLES, 1, appDir, slug);
      const ids = plan.assignments.map((a) => a.role.id);

      // Only unblocking design roles — not QA, not engineer.
      expect(ids.sort()).toEqual(['layout', 'logo'].sort());
      expect(ids).not.toContain('engineer');
      expect(ids).not.toContain('qa-visual');
      expect(ids).not.toContain('content');
      expect(plan.sessionsSavedThisIteration ?? 0).toBeGreaterThan(0);
      expect(plan.designPrecondition!.messages.join('\n')).toMatch(
        /iteration economy|skipped \d+ role session/i
      );

      const ran: string[] = [];
      const result = await runPm(
        {
          appDir,
          slug,
          readStatuses: async () => statuses,
          runRole: async (a) => {
            ran.push(a.role.id);
          },
          gate: async () => ({
            score: 5,
            blockers: ['design'],
            feedback: 'design missing'
          }),
          isDone: async () => ({ done: false, reasons: ['design missing'] })
        },
        { threshold: 90, maxIters: 1, budgetCeiling: 20, stagnationLimit: 2 }
      );

      expect(ran.sort()).toEqual(['layout', 'logo'].sort());
      expect(result.sessionsSaved).toBeGreaterThan(0);
      expect(result.budgetUsed).toBe(2); // only unblocking roles charged
      // Run summary field the caller reports.
      expect(result.sessionsSaved).toBe(plan.sessionsSavedThisIteration);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  it('(d) product brief missing → only product; sessions saved', () => {
    const appDir = mkdtempSync(join(tmpdir(), 'ra-econ-prod-'));
    const slug = 'econ-app';
    try {
      // Empty app — no product brief.
      const statuses = unmetWithManyRoles();
      const plan = planIteration(statuses, ROLES, 1, appDir, slug);
      const ids = plan.assignments.map((a) => a.role.id);
      expect(ids).toEqual(['product']);
      expect(plan.sessionsSavedThisIteration ?? 0).toBeGreaterThan(0);
      expect(plan.productPrecondition!.messages.join('\n')).toMatch(
        /iteration economy|only unblocking/i
      );
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });
});
