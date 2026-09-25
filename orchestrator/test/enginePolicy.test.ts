/**
 * Which work may use Grok -- the owner rule, enforced from one definition.
 *
 * Grok is allowed ONLY for the design roles in GROK_ALLOWED_ROLES (logo,
 * palette, layout). Every other role runs on Claude and must never spawn grok,
 * including when Claude fails. The negative tests below are the input that
 * makes this suite FAIL if a Claude->Grok fallback is ever reintroduced.
 */
import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  ENGINE_CLAUDE,
  GROK_ALLOWED_ROLES,
  engineForRole,
  mayUseGrok
} from '../scripts/lib/engine-policy.mjs';
import { ROLES, type Role } from '../src/team/roles';
import { roleEngine, roleSpawnPlan, runRole } from '../src/team/runRole';

/** The design roles the owner allows on Grok, and nothing else. */
const EXPECTED_GROK_ROLES = ['layout', 'logo', 'palette'];

describe('engine policy', () => {
  it('allows grok for exactly logo, palette and layout', () => {
    expect([...GROK_ALLOWED_ROLES].sort()).toEqual(EXPECTED_GROK_ROLES);
    expect(Object.isFrozen(GROK_ALLOWED_ROLES)).toBe(true);
  });

  it('resolves every other registry role to claude', () => {
    const others = ROLES.filter((role) => !EXPECTED_GROK_ROLES.includes(role.id));
    expect(others.length).toBeGreaterThan(0);
    for (const role of others) {
      expect(engineForRole(role.id), role.id).toBe(ENGINE_CLAUDE);
      expect(mayUseGrok(role.id), role.id).toBe(false);
      expect(roleEngine(role.id), role.id).toBe('claude');
      const plan = roleSpawnPlan(role.id, '/work', 'sid');
      expect(plan.cmd, role.id).toBe('claude');
      expect(plan.args.join(' '), role.id).not.toMatch(/grok|always-approve/);
      // The instruction is stdin, never argv.
      expect(plan.input, role.id).toMatch(/ROLE_TASK\.md/);
      expect(plan.args.some((arg) => arg.includes('ROLE_TASK')), role.id).toBe(false);
    }
  });

  it('keeps grok for the design roles', () => {
    for (const id of EXPECTED_GROK_ROLES) {
      expect(roleEngine(id)).toBe('grok');
      expect(roleSpawnPlan(id, '/work', 'sid').cmd).toBe('grok');
    }
  });

  it('FAIL INPUT: unknown, empty and non-string roles never resolve to grok', () => {
    for (const bad of ['', 'Logo', 'logo ', 'judge', 'build', 'coder', undefined, null, 42]) {
      expect(mayUseGrok(bad)).toBe(false);
      expect(engineForRole(bad)).toBe('claude');
    }
  });
});

describe('runRole engine routing', () => {
  /**
   * A temp working directory.
   *
   * @returns Directory and cleanup.
   */
  async function workDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
    const dir = await mkdtemp(join(tmpdir(), 'redanvil-engine-'));
    return { dir, cleanup: async () => rm(dir, { recursive: true, force: true }) };
  }

  const nonDesign = ROLES.filter((role) => !EXPECTED_GROK_ROLES.includes(role.id)).map(
    (role): Role => ({ ...role, needsWorktree: false })
  );

  it('FAIL INPUT: a non-design role whose claude spawn fails never invokes grok', async () => {
    for (const role of nonDesign) {
      const { dir, cleanup } = await workDir();
      const spawned: string[] = [];
      try {
        const res = await runRole(
          { role, rows: [{ id: 'A1', status: 'fail' }] },
          1,
          { workDir: dir, slug: 'x' },
          {
            writeBrief: () => undefined,
            spawn: (cmd) => {
              spawned.push(cmd);
              return { code: 1, out: 'claude: usage limit reached' };
            }
          }
        );
        expect(spawned, role.id).toEqual(['claude']);
        expect(res.engine, role.id).toBe('claude');
        expect(res.countedAsRun, role.id).toBe(false);
      } finally {
        await cleanup();
      }
    }
  });

  it('FAIL INPUT: an is_error envelope on exit 0 is not a run, and still no grok', async () => {
    const role = nonDesign.find((candidate) => candidate.id === 'engineer')!;
    const { dir, cleanup } = await workDir();
    const spawned: string[] = [];
    try {
      const res = await runRole(
        { role, rows: [{ id: 'A1', status: 'fail' }] },
        1,
        { workDir: dir, slug: 'x' },
        {
          writeBrief: () => undefined,
          spawn: (cmd) => {
            spawned.push(cmd);
            return { code: 0, out: '{"is_error":true,"api_error_status":429}' };
          }
        }
      );
      expect(spawned).toEqual(['claude']);
      expect(res.exitCode).not.toBe(0);
      expect(res.countedAsRun).toBe(false);
    } finally {
      await cleanup();
    }
  });
});
