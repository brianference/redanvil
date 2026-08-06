/**
 * Close the three orchestration gaps that let a mandatory design step be skipped.
 *
 * Failing inputs (each must produce a real refusal exit / plan):
 *   a. No design-refs → PM refuses engineer/content, assigns logo+layout
 *   b. Empty/placeholder DECISION.md → still MISSING, still refuses
 *   c. All design deliverables present and decided → build roles dispatch
 *   d. pre-commit rejects a commit whose role artifacts are absent or empty
 *   e. pre-push still refuses when an app is below the finish line
 *
 * Injected fakes for spawn/git; no real grok CLI, no push, no deploy.
 */
import { describe, it, expect } from 'vitest';
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync
} from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  evaluateDesignDeliverables,
  enforceDesignBeforeBuild,
  isRealDecision,
  BUILD_ROLE_IDS
} from '../src/team/designPrecondition';
import { planIteration, runPm, dryRunAssignments } from '../src/team/pm';
import { ROLES, getRole } from '../src/team/roles';
import {
  engageTeamAfterScaffold,
  isHandBuildBlocked,
  readTeamBinding,
  loadManagedAppsRegistry
} from '../src/team/registerManagedApp';
import {
  buildAssignment,
  evaluatePreCommit,
  writeAssignment
} from '../src/team/worktreeEnforcement';
import { loadChecklistRows } from '../src/done/checklist.mjs';
import { checklistCoverage } from '../src/done/coverage.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CHECKLIST_PATH = join(REPO_ROOT, 'docs/DONE-CHECKLIST.md');
const PRE_PUSH = join(REPO_ROOT, '.githooks', 'pre-push');
const PRE_COMMIT = join(REPO_ROOT, '.githooks', 'pre-commit');
const TEAM_PRE_COMMIT = join(
  REPO_ROOT,
  'orchestrator/scripts/team/hooks/pre-commit.mjs'
);
const FIXTURES = join(REPO_ROOT, 'orchestrator/test/fixtures/finish-line');
const node = process.execPath;

/**
 * Statuses that would otherwise dispatch engineer + content + layout + logo.
 *
 * @returns Checklist row statuses.
 */
function unmetWithBuildAndDesign() {
  const rows = loadChecklistRows(CHECKLIST_PATH);
  return checklistCoverage({
    rows,
    ruleOutcomes: [
      { ruleId: 'u-typing-strict', passed: false },
      { ruleId: 'fe-brand-mark-size', passed: false },
      { ruleId: 'proc-design-options', passed: false },
      { ruleId: 'fe-legal-substance', passed: false }
    ],
    optValues: {
      unitTestsPass: false,
      acceptanceTestsPass: false,
      screenshotsPresent: true,
      evidenceStale: false,
      independentReviewOk: true,
      qaVisualOk: true,
      userRefuseOk: true
    },
    scoreMet: false,
    noFailedRules: false
  });
}

/**
 * Write a product brief so design-before-build tests can reach the design gate
 * (product runs first; without this brief, logo/layout are refused).
 *
 * @param appDir - App root.
 * @param slug - App slug for the brief filename.
 */
function writeProductBrief(appDir: string, slug = 'fixture-app'): void {
  const docs = join(appDir, 'docs');
  mkdirSync(docs, { recursive: true });
  writeFileSync(
    join(docs, `${slug}-product-brief.md`),
    [
      '# Product brief',
      '',
      '## Promises',
      '',
      '- Search works | owns: B4',
      '',
      '## Core user job',
      '',
      'A visitor finds and uses the primary capability end to end.',
      '',
      '## Acceptance evidence',
      '',
      '- Search works: acceptance test names the search control and asserts visible results.',
      ''
    ].join('\n')
  );
  writeFileSync(
    join(docs, `${slug}-prd.md`),
    '# PRD\n\nProduct requirements for the fixture app.\n'
  );
}

/**
 * Write a complete, real design decision tree under appDir.
 *
 * @param appDir - App root.
 */
function writeDecidedDesign(appDir: string): void {
  const logoDir = join(appDir, 'design-refs', 'logo');
  const layoutDir = join(appDir, 'design-refs', 'design-options');
  mkdirSync(logoDir, { recursive: true });
  mkdirSync(layoutDir, { recursive: true });
  for (const n of ['mark-01.png', 'mark-02.png', 'mark-03.png']) {
    writeFileSync(join(logoDir, n), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]));
  }
  writeFileSync(join(logoDir, 'gallery.html'), '<html><body>marks</body></html>\n');
  writeFileSync(
    join(logoDir, 'DECISION.md'),
    [
      '# Logo decision',
      '',
      'Chosen: mark-02',
      '',
      'Why: mark-02 stays legible at 16px because the mark is a simple geometric form,',
      'prefer this over mark-01 which muddies at favicon size.',
      ''
    ].join('\n')
  );
  writeFileSync(join(layoutDir, 'gallery.html'), '<html><body>options</body></html>\n');
  writeFileSync(join(layoutDir, 'option-a.html'), '<html><body>tile grid</body></html>\n');
  writeFileSync(join(layoutDir, 'option-b.html'), '<html><body>timeline</body></html>\n');
  writeFileSync(join(layoutDir, 'option-c.html'), '<html><body>hero card</body></html>\n');
  writeFileSync(
    join(layoutDir, 'DECISION.md'),
    [
      '# Layout decision',
      '',
      'Chosen: option B (timeline chronicle)',
      '',
      'Why: the timeline architecture surfaces planting windows better for this app;',
      'the three options differ structurally — tile grid vs timeline vs hero card —',
      'not only colours.',
      ''
    ].join('\n')
  );
}

describe('a. no design-refs → PM refuses build roles, assigns logo+layout', () => {
  it('refuses engineer/content and assigns design roles first', async () => {
    const appDir = mkdtempSync(join(tmpdir(), 'ra-gap-a-'));
    const slug = 'fixture-app';
    try {
      // Product brief present so we reach the design gate (product runs earlier).
      writeProductBrief(appDir, slug);
      // Failing input: empty app dir, no design-refs at all.
      const statuses = unmetWithBuildAndDesign();
      const plan = planIteration(statuses, ROLES, 1, appDir, slug);
      const ids = plan.assignments.map((a) => a.role.id);

      expect(plan.designPrecondition).toBeDefined();
      expect(plan.designPrecondition!.deliverables.ok).toBe(false);
      expect(plan.designPrecondition!.refusedBuildRoles.length).toBeGreaterThan(0);
      expect(ids).not.toContain('engineer');
      expect(ids).not.toContain('content');
      expect(ids).not.toContain('testwriter');
      expect(ids).toEqual(expect.arrayContaining(['logo', 'layout']));

      const refusal = plan.designPrecondition!.messages.join('\n');
      expect(refusal).toMatch(/REFUSED to dispatch build role/i);
      console.log('a. refusal:\n' + refusal);

      // runPm with injected fakes must not invoke engineer either.
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
            score: 10,
            blockers: ['design'],
            feedback: 'design missing'
          }),
          isDone: async () => ({ done: false, reasons: ['design missing'] })
        },
        { threshold: 90, maxIters: 1, budgetCeiling: 10, stagnationLimit: 2 }
      );
      expect(ran).not.toContain('engineer');
      expect(ran).not.toContain('content');
      expect(ran).toEqual(expect.arrayContaining(['logo', 'layout']));
      expect(result.plans[0]?.designPrecondition?.refusedBuildRoles ?? []).toEqual(
        expect.arrayContaining(['engineer', 'content'])
      );
      // Exit-shaped signal: design not ok.
      expect(result.plans[0]?.designPrecondition?.deliverables.ok).toBe(false);
      console.log('a. roles actually run:', ran.join(', '));
      console.log('a. deliverables.ok exit-shaped:', result.plans[0]?.designPrecondition?.deliverables.ok ? 0 : 1);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });
});

describe('b. empty/placeholder DECISION.md → still MISSING', () => {
  it('treats empty DECISION.md as missing and refuses build roles', () => {
    const appDir = mkdtempSync(join(tmpdir(), 'ra-gap-b-'));
    const slug = 'fixture-app';
    try {
      writeProductBrief(appDir, slug);
      // Failing input: files exist but DECISION.md is blank / placeholder.
      writeDecidedDesign(appDir);
      writeFileSync(join(appDir, 'design-refs/logo/DECISION.md'), '\n');
      writeFileSync(
        join(appDir, 'design-refs/design-options/DECISION.md'),
        'TBD\nFill this in later.\n'
      );

      const status = evaluateDesignDeliverables(appDir);
      expect(status.ok).toBe(false);
      expect(status.reasons.join(' ')).toMatch(/empty|placeholder|unwritten|TBD/i);

      const statuses = unmetWithBuildAndDesign();
      const plan = planIteration(statuses, ROLES, 1, appDir, slug);
      const ids = plan.assignments.map((a) => a.role.id);
      expect(ids).not.toContain('engineer');
      expect(plan.designPrecondition!.messages.join('\n')).toMatch(/REFUSED|undecided|missing/i);
      console.log('b. refusal:\n' + plan.designPrecondition!.messages.join('\n'));
      console.log('b. deliverables.ok exit-shaped:', status.ok ? 0 : 1);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  it('isRealDecision rejects placeholder text', () => {
    expect(isRealDecision('').ok).toBe(false);
    expect(isRealDecision('TBD — Fill this in').ok).toBe(false);
    expect(
      isRealDecision(
        'Chosen: mark-02\n\nWhy: because it is legible at 16px on light and dark backgrounds.\n'
      ).ok
    ).toBe(true);
  });
});

describe('c. all design deliverables present and decided → build roles dispatch', () => {
  it('allows engineer/content when design is decided', async () => {
    const appDir = mkdtempSync(join(tmpdir(), 'ra-gap-c-'));
    const slug = 'fixture-app';
    try {
      writeProductBrief(appDir, slug);
      writeDecidedDesign(appDir);
      const status = evaluateDesignDeliverables(appDir);
      expect(status.ok).toBe(true);

      const statuses = unmetWithBuildAndDesign();
      const plan = planIteration(statuses, ROLES, 1, appDir, slug);
      const ids = plan.assignments.map((a) => a.role.id);
      expect(plan.designPrecondition?.refusedBuildRoles ?? []).toEqual([]);
      expect(ids).toEqual(expect.arrayContaining(['engineer', 'content', 'logo', 'layout']));

      const ran: string[] = [];
      await runPm(
        {
          appDir,
          slug,
          readStatuses: async () => statuses,
          runRole: async (a) => {
            ran.push(a.role.id);
          },
          gate: async () => ({ score: 50, blockers: [], feedback: 'still building' }),
          isDone: async () => ({ done: false, reasons: ['score'] })
        },
        { threshold: 90, maxIters: 1, budgetCeiling: 20, stagnationLimit: 2 }
      );
      expect(ran).toEqual(expect.arrayContaining(['engineer', 'content']));
      console.log('c. roles run (build allowed):', ran.join(', '));
      console.log('c. deliverables.ok exit-shaped:', status.ok ? 0 : 1);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });
});

describe('d. pre-commit rejects missing/empty role artifacts', () => {
  it('team pre-commit.mjs exits non-zero when artifacts are absent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ra-gap-d-'));
    try {
      // Failing input: assignment present, required artifacts empty/absent.
      const role = getRole('qa-visual');
      if (!role) throw new Error('qa-visual missing');
      writeAssignment(dir, buildAssignment(role, 'demo', ['C10']));
      writeFileSync(
        join(dir, '.redanvil', 'gate-status.json'),
        JSON.stringify({ passed: true, checkedAt: new Date().toISOString() })
      );

      const pure = evaluatePreCommit(dir);
      expect(pure.ok).toBe(false);
      expect(pure.reasons.join(' ')).toMatch(/artifact/i);

      const r = spawnSync(node, [TEAM_PRE_COMMIT], {
        cwd: dir,
        encoding: 'utf8'
      });
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
      expect(r.status ?? -1, out).not.toBe(0);
      expect(out).toMatch(/REFUSED|artifact/i);
      console.log('d. pre-commit exit:', r.status);
      console.log('d. pre-commit output:', out.slice(0, 400));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('.githooks/pre-commit invokes team logic when assignment is present', () => {
    // Structural: the installed hook must reference the team enforcement path.
    const body = readFileSync(PRE_COMMIT, 'utf8');
    expect(body).toMatch(/orchestrator\/scripts\/team\/hooks\/pre-commit\.mjs/);
    expect(existsSync(join(REPO_ROOT, '.githooks', 'commit-msg'))).toBe(true);
    const commitMsg = readFileSync(join(REPO_ROOT, '.githooks', 'commit-msg'), 'utf8');
    expect(commitMsg).toMatch(/orchestrator\/scripts\/team\/hooks\/commit-msg\.mjs/);
    const prePush = readFileSync(PRE_PUSH, 'utf8');
    expect(prePush).toMatch(/orchestrator\/scripts\/team\/hooks\/pre-push\.mjs/);
    expect(prePush).toMatch(/meets_the_bar/);
  });
});

describe('e. pre-push still refuses below the finish line (no regression)', () => {
  it('exits non-zero for result-89 fixture via .githooks/pre-push', () => {
    const shells = process.platform === 'win32' ? ['bash', 'sh'] : ['sh'];
    for (const shell of shells) {
      const r = spawnSync(
        shell,
        [PRE_PUSH, 'origin', 'https://github.com/example/example.git'],
        {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          env: {
            ...process.env,
            REDANVIL_MEETS_THE_BAR_RESULT: join(FIXTURES, 'result-89.json'),
            REDANVIL_MEETS_THE_BAR_SLUG: 'fixture-app',
            REDANVIL_MEETS_THE_BAR_DIR: 'fixture-app',
            REDANVIL_MEETS_THE_BAR_SKIP_GIT: '1',
            REDANVIL_MEETS_THE_BAR_SKIP_VISUAL: '1',
            REDANVIL_MEETS_THE_BAR_SKIP_SCREENSHOTS: '1'
          },
          input: ''
        }
      );
      const output = `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? String(r.error) : ''}`;
      if (r.error && /ENOENT/i.test(String(r.error))) continue;
      expect(r.status ?? -1, output).not.toBe(0);
      expect(output).toMatch(/REFUSED|FINISH LINE|finalScore 89|reverify/i);
      console.log('e. pre-push exit:', r.status);
      console.log('e. pre-push output slice:', output.slice(0, 500));
      return;
    }
    // Fallback: checker itself must refuse (finish-line still load-bearing).
    const cli = spawnSync(
      node,
      [
        join(REPO_ROOT, '.github/scripts/meets_the_bar.mjs'),
        '--result',
        join(FIXTURES, 'result-89.json'),
        '--slug',
        'fixture-app',
        '--skip-git',
        '--skip-visual',
        '--skip-screenshots'
      ],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    );
    expect(cli.status, `${cli.stdout}${cli.stderr}`).toBe(1);
    console.log('e. meets_the_bar fallback exit:', cli.status);
  });
});

describe('B. scaffold engages the managed team process', () => {
  it('registers the app, sets PM entry, blocks hand-build', () => {
    const root = mkdtempSync(join(tmpdir(), 'ra-gap-scaffold-root-'));
    const outDir = join(root, 'fresh-app');
    try {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'package.json'), '{"name":"fresh-app"}\n');

      const team = engageTeamAfterScaffold({
        outDir,
        slug: 'fresh-app',
        monorepoRoot: root
      });

      expect(existsSync(team.teamJsonPath)).toBe(true);
      expect(isHandBuildBlocked(outDir)).toBe(true);
      const binding = readTeamBinding(outDir);
      expect(binding?.entryPoint).toBe('pm');
      expect(binding?.nextCommand).toMatch(/pm fresh-app --execute/);

      const reg = loadManagedAppsRegistry(root);
      expect(reg.apps.some((a) => a.slug === 'fresh-app')).toBe(true);
      expect(existsSync(join(root, 'results', 'fresh-app.json'))).toBe(true);
      expect(team.messages.join('\n')).toMatch(/entry point is the PM/i);
      console.log('B. nextCommand:', team.nextCommand);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('hooksPath stays .githooks with full team set', () => {
  it('install-hooks requires pre-commit, commit-msg, pre-push under .githooks', () => {
    const installSrc = readFileSync(join(REPO_ROOT, 'scripts/install-hooks.mjs'), 'utf8');
    expect(installSrc).toMatch(/hooksPath = '\.githooks'/);
    expect(installSrc).toMatch(/pre-commit/);
    expect(installSrc).toMatch(/commit-msg/);
    expect(installSrc).toMatch(/pre-push/);
    for (const name of ['pre-commit', 'commit-msg', 'pre-push']) {
      expect(existsSync(join(REPO_ROOT, '.githooks', name))).toBe(true);
    }
  });
});

describe('enforceDesignBeforeBuild pure edge cases', () => {
  it('strips only BUILD roles and keeps qa roles', () => {
    const appDir = mkdtempSync(join(tmpdir(), 'ra-gap-edge-'));
    try {
      const engineer = getRole('engineer');
      const qa = getRole('qa-visual');
      const logo = getRole('logo');
      if (!engineer || !qa || !logo) throw new Error('roles missing');
      const raw = {
        iteration: 1,
        assignments: [
          { role: engineer, rows: [], matchedOwns: [...engineer.owns] },
          { role: qa, rows: [], matchedOwns: [...qa.owns] }
        ],
        worktreeRoles: ['engineer', 'qa-visual'] as const,
        readOnlyRoles: [] as const
      };
      // cast for readonly RoleId[]
      const plan = {
        iteration: 1,
        assignments: raw.assignments,
        worktreeRoles: ['engineer', 'qa-visual'] as import('../src/team/roles').RoleId[],
        readOnlyRoles: [] as import('../src/team/roles').RoleId[]
      };
      const gated = enforceDesignBeforeBuild(plan, appDir, ROLES);
      const ids = gated.plan.assignments.map((a) => a.role.id);
      expect(ids).not.toContain('engineer');
      expect(ids).toContain('qa-visual');
      expect(ids).toEqual(expect.arrayContaining(['logo', 'layout']));
      expect(gated.refusedBuildRoles).toContain('engineer');
      for (const id of BUILD_ROLE_IDS) {
        expect(ids).not.toContain(id);
      }
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });
});

describe('dryRun surfaces product then design refusal lines', () => {
  it('prints product refusal when brief is missing (before design)', () => {
    const appDir = mkdtempSync(join(tmpdir(), 'ra-gap-dry-'));
    try {
      const { lines, plan } = dryRunAssignments(
        unmetWithBuildAndDesign(),
        ROLES,
        appDir,
        'fixture-app'
      );
      // Product runs first — without a brief, design is never reached.
      expect(lines.join('\n')).toMatch(/product brief missing|product has not run|REFUSED/i);
      expect(plan.assignments.map((a) => a.role.id)).not.toContain('engineer');
      expect(plan.assignments.map((a) => a.role.id)).toContain('product');
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });
});
