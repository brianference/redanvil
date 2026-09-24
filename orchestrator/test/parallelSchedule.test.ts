/**
 * Scheduling is actually parallel: independent roles overlap, a dependency
 * waits, the cap holds, and unchanged inputs skip.
 *
 * Overlap is timestamps from a fake runner that awaits a deferred. No sleeps.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runPm, PM_ROLE_CONCURRENCY } from '../src/team/pm';
import {
  assertAcyclicDependsOn,
  getRole,
  ROLES,
  RoleDependencyCycleError,
  type Role,
  type RoleId
} from '../src/team/roles';
import { recordCountedRoleInputs } from '../src/team/roleInputs';
import type { RowStatus } from '../src/done/coverage.d.mts';

/**
 * A deferred the test releases. Resolving is the signal, not a timer.
 *
 * @returns Promise plus resolve.
 */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * One failing checklist row owned by whatever role lists this id.
 *
 * @param id - Row id.
 * @returns Status row.
 */
function failingRow(id: string): RowStatus {
  return { id, section: 't', mustBeTrue: 't', status: 'fail', detail: '' };
}

/**
 * A registry role stripped of worktree requirements so the fake runner is the only effect.
 *
 * @param id - Role id to clone.
 * @param owns - Row ids this fixture owns.
 * @param extra - Dependency / input overrides.
 * @returns Role.
 */
function fixtureRole(id: RoleId, owns: string[], extra: Partial<Role> = {}): Role {
  const base = getRole(id);
  if (base === undefined) throw new Error(`missing role ${id}`);
  return {
    ...base,
    owns,
    needsWorktree: false,
    dependsOn: [],
    inputs: undefined,
    ...extra
  };
}

/**
 * Run one PM iteration with a fake role runner.
 *
 * @param roles - Fixture registry.
 * @param rows - Unmet rows.
 * @param runRole - Fake runner.
 * @param app - Optional app dir and slug for the input-hash skip.
 * @returns The in-flight runPm promise.
 */
function oneIteration(
  roles: Role[],
  rows: RowStatus[],
  runRole: (assignment: { role: Role }) => Promise<void>,
  app?: { appDir: string; slug: string }
): Promise<unknown> {
  return runPm(
    {
      readStatuses: async () => rows,
      runRole: async (assignment) => {
        await runRole(assignment);
      },
      gate: async () => ({ score: 0, blockers: [], feedback: '' }),
      isDone: async () => ({ done: true, reasons: [] }),
      appDir: app?.appDir,
      slug: app?.slug
    },
    { threshold: 90, maxIters: 1, stagnationLimit: 1, roles }
  );
}

describe('dependsOn', () => {
  it('throws at load-check time when dependsOn cycles', () => {
    expect(() =>
      assertAcyclicDependsOn([
        { id: 'a', dependsOn: ['b'] },
        { id: 'b', dependsOn: ['a'] }
      ])
    ).toThrow(RoleDependencyCycleError);
    expect(() =>
      assertAcyclicDependsOn([{ id: 'a', dependsOn: ['missing'] }])
    ).toThrow(/unknown role/);
    // The real registry is checked at import. Re-running it must still pass.
    expect(() => assertAcyclicDependsOn(ROLES)).not.toThrow();
  });

  it('build depends on design outputs that the role prompts already name', () => {
    const engineer = getRole('engineer');
    expect(engineer?.dependsOn).toEqual(
      expect.arrayContaining(['logo', 'layout', 'testwriter'])
    );
    const testwriter = getRole('testwriter');
    expect(testwriter?.dependsOn).toContain('product');
    expect(testwriter?.inputs).toContain('docs/<slug>-prd.md');
  });
});

describe('scheduleRoleRuns via runPm', () => {
  it('starts roles with no dependency concurrently', async () => {
    expect(PM_ROLE_CONCURRENCY).toBe(3);
    const roles = [
      fixtureRole('logo', ['row-logo']),
      fixtureRole('layout', ['row-layout'])
    ];
    const events: Array<{ id: string; phase: 'start' | 'end'; t: number }> = [];
    const hold = deferred();
    const both = deferred();
    let started = 0;
    const pending = oneIteration(roles, [failingRow('row-logo'), failingRow('row-layout')], async (a) => {
      events.push({ id: a.role.id, phase: 'start', t: Date.now() });
      started += 1;
      if (started === 2) both.resolve();
      await hold.promise;
      events.push({ id: a.role.id, phase: 'end', t: Date.now() });
    });
    await both.promise;
    const starts = events.filter((e) => e.phase === 'start');
    const ends = events.filter((e) => e.phase === 'end');
    expect(starts.map((e) => e.id).sort()).toEqual(['layout', 'logo']);
    expect(ends).toEqual([]);
    // Both starts are recorded before either end. That is the overlap.
    hold.resolve();
    await pending;
    const ended = events.filter((e) => e.phase === 'end');
    expect(ended).toHaveLength(2);
    for (const start of starts) {
      for (const end of ended) {
        expect(start.t).toBeLessThanOrEqual(end.t);
      }
    }
  });

  it('does not start a role until its dependency in this iteration has finished', async () => {
    const roles = [
      fixtureRole('logo', ['row-logo']),
      fixtureRole('layout', ['row-layout'], { dependsOn: ['logo'] })
    ];
    const holdLogo = deferred();
    let layoutStarted = false;
    const logoStarted = deferred();
    const pending = oneIteration(roles, [failingRow('row-logo'), failingRow('row-layout')], async (a) => {
      if (a.role.id === 'logo') {
        logoStarted.resolve();
        await holdLogo.promise;
        return;
      }
      layoutStarted = true;
    });
    await logoStarted.promise;
    await Promise.resolve();
    await Promise.resolve();
    expect(layoutStarted).toBe(false);
    holdLogo.resolve();
    await pending;
    expect(layoutStarted).toBe(true);
  });

  it('respects the concurrency cap', async () => {
    const ids: RoleId[] = ['logo', 'layout', 'palette', 'brainstorm'];
    const roles = ids.map((id) => fixtureRole(id, [`row-${id}`]));
    const hold = deferred();
    const atCap = deferred();
    let started = 0;
    const seen: string[] = [];
    const pending = oneIteration(
      roles,
      ids.map((id) => failingRow(`row-${id}`)),
      async (a) => {
        seen.push(a.role.id);
        started += 1;
        if (started === PM_ROLE_CONCURRENCY) atCap.resolve();
        await hold.promise;
      }
    );
    await atCap.promise;
    await Promise.resolve();
    expect(seen).toHaveLength(PM_ROLE_CONCURRENCY);
    hold.resolve();
    await pending;
    expect(seen).toHaveLength(4);
  });
});

/** 1x1 PNG so the design precondition sees a real non-empty mark file. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Product brief plus decided logo/layout, so planIteration does not strip the
 * role under test down to product or design.
 *
 * @param appDir - App directory.
 * @param slug - App slug.
 */
function writePassingPreconditions(appDir: string, slug: string): void {
  mkdirSync(join(appDir, 'docs'), { recursive: true });
  mkdirSync(join(appDir, 'design-refs', 'logo'), { recursive: true });
  mkdirSync(join(appDir, 'design-refs', 'design-options'), { recursive: true });
  writeFileSync(
    join(appDir, 'docs', `${slug}-product-brief.md`),
    '# Product brief\n\n## Promises\n\n- Browse the list | owns: B4\n'
  );
  for (const name of ['mark-01.png', 'mark-02.png', 'mark-03.png']) {
    writeFileSync(join(appDir, 'design-refs', 'logo', name), TINY_PNG);
  }
  writeFileSync(
    join(appDir, 'design-refs', 'logo', 'gallery.html'),
    '<p>three marks</p>\n'
  );
  writeFileSync(
    join(appDir, 'design-refs', 'logo', 'DECISION.md'),
    'Chosen: mark-02 because it stays legible at 32px on both themes.\n'
  );
  writeFileSync(
    join(appDir, 'design-refs', 'design-options', 'gallery.html'),
    '<p>three layouts</p>\n'
  );
  writeFileSync(
    join(appDir, 'design-refs', 'design-options', 'DECISION.md'),
    'We selected option B because the primary action stays above the fold at 375px.\n'
  );
}

describe('skip unchanged inputs', () => {
  /**
   * App dir with the brainstorm input and artifact already on disk.
   *
   * @returns Paths and the fixture role.
   */
  function skipApp(): { appDir: string; slug: string; role: Role; cleanup: () => void } {
    const appDir = mkdtempSync(join(tmpdir(), 'ra-skip-'));
    const slug = 'skip-app';
    writePassingPreconditions(appDir, slug);
    writeFileSync(join(appDir, 'docs', `${slug}-prd.md`), 'prd v1\n');
    writeFileSync(join(appDir, 'docs', `${slug}-features.md`), 'ranked features\n');
    const role = fixtureRole('brainstorm', ['feature-gaps'], {
      inputs: ['docs/<slug>-prd.md'],
      artifacts: ['docs/<slug>-features.md']
    });
    return {
      appDir,
      slug,
      role,
      cleanup: () => rmSync(appDir, { recursive: true, force: true })
    };
  }

  it('skips when the input hash matches and re-runs after the input changes', async () => {
    const { appDir, slug, role, cleanup } = skipApp();
    const lines: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map((a) => String(a)).join(' '));
    };
    try {
      const rows = [failingRow('feature-gaps')];
      // Two identical counted attempts: the cap is reached, so it is skipped.
      recordCountedRoleInputs(appDir, role, rows, slug);
      recordCountedRoleInputs(appDir, role, rows, slug);
      let calls = 0;
      await oneIteration([role], rows, async () => {
        calls += 1;
      }, { appDir, slug });
      expect(calls).toBe(0);
      expect(lines.some((l) => l.includes('skipped (inputs unchanged)'))).toBe(true);

      writeFileSync(join(appDir, 'docs', `${slug}-prd.md`), 'prd v2 — a real edit\n');
      await oneIteration([role], rows, async () => {
        calls += 1;
      }, { appDir, slug });
      expect(calls).toBe(1);
    } finally {
      console.log = orig;
      cleanup();
    }
  });

  it('FAIL INPUT: retries a role with a failing row on unchanged inputs, then stops after the cap', async () => {
    const { appDir, slug, role, cleanup } = skipApp();
    try {
      const rows = [failingRow('feature-gaps')];
      recordCountedRoleInputs(appDir, role, rows, slug);
      let calls = 0;
      // One counted attempt so far: a failing row must be retried.
      await oneIteration([role], rows, async () => {
        calls += 1;
      }, { appDir, slug });
      expect(calls).toBe(1);
      // A second identical counted attempt reaches the cap; the next is skipped.
      recordCountedRoleInputs(appDir, role, rows, slug);
      await oneIteration([role], rows, async () => {
        calls += 1;
      }, { appDir, slug });
      expect(calls).toBe(1);
    } finally {
      cleanup();
    }
  });

  it('runs a role that declares no inputs even when its artifact already exists', async () => {
    const appDir = mkdtempSync(join(tmpdir(), 'ra-noskip-'));
    const slug = 'noskip';
    try {
      writePassingPreconditions(appDir, slug);
      mkdirSync(join(appDir, 'src'), { recursive: true });
      writeFileSync(join(appDir, 'src', 'index.ts'), 'export const app = 1;\n');
      const role = fixtureRole('engineer', ['row-eng'], {
        artifacts: ['src/index.ts'],
        inputs: []
      });
      let calls = 0;
      await oneIteration([role], [failingRow('row-eng')], async () => {
        calls += 1;
      }, { appDir, slug: 'noskip' });
      expect(calls).toBe(1);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  it('does not skip when the owned artifact is missing', async () => {
    const { appDir, slug, role, cleanup } = skipApp();
    try {
      rmSync(join(appDir, 'docs', `${slug}-features.md`));
      const rows = [failingRow('feature-gaps')];
      recordCountedRoleInputs(appDir, role, rows, slug);
      let calls = 0;
      await oneIteration([role], rows, async () => {
        calls += 1;
      }, { appDir, slug });
      expect(calls).toBe(1);
    } finally {
      cleanup();
    }
  });
});

describe('scheduleRoleRuns after a dependency did not count', () => {
  it('skips dependents (transitively) instead of running them', async () => {
    const { scheduleRoleRuns } = await import('../src/team/pm');
    const role = (id: string, dependsOn: string[]) =>
      ({ role: { id, dependsOn }, rows: [], matchedOwns: [] }) as never;
    const ran: string[] = [];
    const skipped = await scheduleRoleRuns(
      [role('logo', []), role('layout', ['logo']), role('engineer', ['layout']), role('palette', [])],
      async (a: { role: { id: string } }) => {
        ran.push(a.role.id);
        return a.role.id !== 'logo';
      }
    );
    expect(ran.sort()).toEqual(['logo', 'palette']);
    expect(skipped.sort()).toEqual(['engineer', 'layout']);
  });
});
