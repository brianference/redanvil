import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { planFromResult } from '../src/commands/pm';
import { findUnownedChecklistRows } from '../src/team/assign';
import { ROLES } from '../src/team/roles';

/**
 * `redanvil pm` is the caller that made team/pm.ts and team/assign.ts reachable.
 * Both had passing tests and ZERO importers, so the behaviour was proven and
 * unreachable at the same time. These cover the command itself.
 */
describe('pm command', () => {
  /**
   * Write a minimal gate result file into a temp repo root.
   *
   * @param rules Rule outcomes to record.
   * @returns Temp root and cleanup.
   */
  async function repoWithResult(
    rules: Array<{ ruleId: string; passed: boolean }>
  ): Promise<{ root: string; cleanup: () => Promise<void> }> {
    const root = await mkdtemp(join(tmpdir(), 'redanvil-pm-'));
    await mkdir(join(root, 'results'), { recursive: true });
    await writeFile(
      join(root, 'results', 'x.json'),
      JSON.stringify({ slug: 'x', finalScore: 0, threshold: 90, rules })
    );
    return { root, cleanup: async () => rm(root, { recursive: true, force: true }) };
  }

  it('plans a role batch for an unmet row, from a real result file', async () => {
    const { root, cleanup } = await repoWithResult([
      { ruleId: 'meas-standard-tool', passed: false }
    ]);
    const out = planFromResult({ resultPath: 'results/x.json', repoRoot: root });

    expect(out.batches).toBeGreaterThan(0);
    expect(out.lines.join('\n')).toMatch(/role=/);
    expect(out.unowned).toEqual([]);
    await cleanup();
  });

  it('reports NO unowned rows for the real checklist — every row has an owner', async () => {
    // The positive control. If this ever fails, a row was added to the checklist
    // without giving any role the `owns` token for it, and the PM would have an
    // unworkable requirement.
    const { root, cleanup } = await repoWithResult([{ ruleId: 'lg-shipped', passed: false }]);
    const out = planFromResult({ resultPath: 'results/x.json', repoRoot: root });
    expect(out.unowned).toEqual([]);
    await cleanup();
  });

  it('FAILS a row id that no role owns (known-bad)', () => {
    // The negative control, and the one that matters: without it, a check that
    // could never report an unowned row would look identical to one that works.
    const unowned = findUnownedChecklistRows(['Z99-nobody-owns-this'], ROLES);
    expect(unowned).toEqual(['Z99-nobody-owns-this']);
  });

  it('does not treat an absent `passed` flag as a pass', async () => {
    // Pass-by-default is the failure this repo removes everywhere else; a rule
    // recorded without an outcome must not silently count as satisfied.
    const { root, cleanup } = await repoWithResult([
      { ruleId: 'meas-standard-tool' } as unknown as { ruleId: string; passed: boolean }
    ]);
    const out = planFromResult({ resultPath: 'results/x.json', repoRoot: root });
    expect(out.batches).toBeGreaterThan(0);
    await cleanup();
  });
});
