/**
 * Known-answer fixtures for `proc-artifact-verified`.
 *
 * A verdict citing a .md plan FAILS; a verdict citing a real design_audit JSON
 * with findings PASSES; a 0-byte screenshot FAILS. Specs are not deliverables.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadRubric } from '../src/rubric/index';
import { APP_CHECKS } from '../src/commands/gate';
import {
  isPlanArtifact,
  jsonTrivialReason,
  validateEvidencePath,
  validateVerdicts
} from '../scripts/checks/proc-artifact-verified.mjs';

const CHECK_SCRIPT = fileURLToPath(
  new URL('../scripts/checks/proc-artifact-verified.mjs', import.meta.url)
);
const CHECK_VIA_ROUTER = fileURLToPath(
  new URL('../scripts/checks/check.mjs', import.meta.url)
);
const node = process.execPath;

/** Temp dirs cleaned after each test. */
const tempDirs: string[] = [];

/**
 * Create a unique temp app directory (also acts as repo root when not in git).
 * @returns Absolute app path.
 */
function makeApp(): string {
  const app = mkdtempSync(join(tmpdir(), 'redanvil-proc-art-'));
  tempDirs.push(app);
  mkdirSync(join(app, 'evidence', 'screenshots'), { recursive: true });
  mkdirSync(join(app, 'docs', 'plans'), { recursive: true });
  return app;
}

/**
 * Write a verdicts file under app/evidence/verdicts.json.
 *
 * @param app App root.
 * @param verdicts Verdict rows.
 * @returns Absolute path to the verdicts file.
 */
function writeVerdicts(
  app: string,
  verdicts: Array<{
    ruleId: string;
    passed: boolean;
    method: string;
    evidence: string[];
    note: string;
    reviewedAt: string;
    reviewedCommit: string;
  }>
): string {
  const path = join(app, 'evidence', 'verdicts.json');
  writeFileSync(path, JSON.stringify(verdicts, null, 2), 'utf8');
  return path;
}

/**
 * Run the standalone check.
 *
 * @param appDir App root.
 * @returns Child result.
 */
function runStandalone(appDir: string) {
  return spawnSync(node, [CHECK_SCRIPT, appDir], { encoding: 'utf8', env: process.env });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) break;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
});

describe('proc-artifact-verified registration', () => {
  it('is encoded as a pure-det process blocker and wired into APP_CHECKS', () => {
    const rule = loadRubric().find((r) => r.id === 'proc-artifact-verified');
    expect(rule, 'missing from rubric').toBeDefined();
    expect(rule!.lane).toBe('process');
    expect(rule!.severity).toBe('blocker');
    expect(rule!.method).toBe('det');
    expect(APP_CHECKS.map((c) => c.ruleId)).toContain('proc-artifact-verified');
  });
});

describe('proc-artifact-verified pure classifiers', () => {
  it('treats plans, prompts, and rule markdown as PLAN artifacts', () => {
    expect(isPlanArtifact('docs/plans/feature-plan.md')).toBe(true);
    expect(isPlanArtifact('prompts/grok-coder.md')).toBe(true);
    expect(isPlanArtifact('rules/rubric/frontend.md')).toBe(true);
    expect(isPlanArtifact('some-feature-prd.md')).toBe(true);
  });

  it('treats evidence reports and screenshots as non-plan', () => {
    expect(isPlanArtifact('evidence/design-app-builder.json')).toBe(false);
    expect(isPlanArtifact('evidence/screenshots/home.png')).toBe(false);
  });

  it('flags empty findings / empty results as trivial', () => {
    expect(jsonTrivialReason({ findings: {} })).toMatch(/findings/i);
    expect(jsonTrivialReason({ results: [] })).toMatch(/results/i);
    expect(
      jsonTrivialReason({
        findings: { 'fe-touch-targets': { ok: true, detail: 'ok' } },
        ok: true
      })
    ).toBeNull();
  });
});

describe('proc-artifact-verified known-answer failures and passes', () => {
  const stamp = {
    method: 'visual' as const,
    note: 'observed on fixture',
    reviewedAt: '2026-08-01T00:00:00.000Z',
    // Unknown to git → existence-at-commit is skipped; disk + class still checked.
    reviewedCommit: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
  };

  it('FAILS a verdict that cites a .md plan', () => {
    const app = makeApp();
    writeFileSync(
      join(app, 'docs', 'plans', 'ship-it.md'),
      '# Plan\n\nWe will take screenshots later.\n',
      'utf8'
    );
    writeVerdicts(app, [
      {
        ruleId: 'fe-visual-review-recorded',
        passed: true,
        evidence: ['docs/plans/ship-it.md'],
        ...stamp
      }
    ]);
    const r = runStandalone(app);
    expect(r.status, r.stderr + r.stdout).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/fe-visual-review-recorded/);
    expect(r.stderr + r.stdout).toMatch(/ship-it\.md|PLAN|plan/i);
  });

  it('PASSES a verdict that cites a real design_audit JSON with findings', () => {
    const app = makeApp();
    const report = {
      baseUrl: 'https://example.pages.dev',
      checkedAt: '2026-08-01T00:00:00.000Z',
      findings: {
        'fe-touch-targets': { ok: true, detail: 'all targets >= 44px' },
        'fe-type-floor': { ok: true, detail: 'body 16px' }
      },
      ok: true
    };
    writeFileSync(
      join(app, 'evidence', 'design-demo.json'),
      JSON.stringify(report, null, 2),
      'utf8'
    );
    writeVerdicts(app, [
      {
        ruleId: 'fe-touch-targets',
        passed: true,
        evidence: ['evidence/design-demo.json'],
        ...stamp
      }
    ]);
    const r = runStandalone(app);
    expect(r.status, r.stderr + r.stdout).toBe(0);
    expect(r.stdout).toMatch(/PASS/i);
  });

  it('FAILS a verdict that cites a 0-byte screenshot', () => {
    const app = makeApp();
    writeFileSync(join(app, 'evidence', 'screenshots', 'empty.png'), '', 'utf8');
    writeVerdicts(app, [
      {
        ruleId: 'fe-visual-review-recorded',
        passed: true,
        evidence: ['evidence/screenshots/empty.png'],
        ...stamp
      }
    ]);
    const r = runStandalone(app);
    expect(r.status, r.stderr + r.stdout).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/fe-visual-review-recorded/);
    expect(r.stderr + r.stdout).toMatch(/empty\.png|0 bytes|empty/i);
  });

  it('FAILS a tiny under-threshold screenshot', () => {
    const app = makeApp();
    writeFileSync(join(app, 'evidence', 'screenshots', 'tiny.png'), 'x'.repeat(100), 'utf8');
    const fails = validateEvidencePath(
      'fe-responsive-375',
      'evidence/screenshots/tiny.png',
      app,
      stamp.reviewedCommit
    );
    expect(fails.join(' ')).toMatch(/few KB|bytes/i);
  });

  it('FAILS a report with an empty results array', () => {
    const app = makeApp();
    writeFileSync(
      join(app, 'evidence', 'width-empty.json'),
      JSON.stringify({ baseUrl: 'x', checkedAt: 't', results: [], ok: true }),
      'utf8'
    );
    const fails = validateVerdicts(
      [
        {
          ruleId: 'fe-desktop-width',
          passed: true,
          evidence: ['evidence/width-empty.json'],
          reviewedCommit: stamp.reviewedCommit
        }
      ],
      app
    );
    expect(fails.join(' ')).toMatch(/fe-desktop-width/);
    expect(fails.join(' ')).toMatch(/results|trivial/i);
  });

  it('returns n/a when the app has no verdicts file', () => {
    const app = makeApp();
    const r = runStandalone(app);
    expect(r.status, r.stderr + r.stdout).toBe(3);
    expect(r.stderr + r.stdout).toMatch(/n\/a/i);
  });

  it('fails the same way through check.mjs (gate router)', () => {
    const app = makeApp();
    writeFileSync(
      join(app, 'docs', 'plans', 'only-plan.md'),
      '# Intent\n\nDo the thing.\n',
      'utf8'
    );
    writeVerdicts(app, [
      {
        ruleId: 'fe-cold-visitor',
        passed: true,
        evidence: ['docs/plans/only-plan.md'],
        ...stamp
      }
    ]);
    const r = spawnSync(node, [CHECK_VIA_ROUTER, 'proc-artifact-verified', app], {
      encoding: 'utf8',
      env: process.env
    });
    expect(r.status, r.stderr + r.stdout).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/fe-cold-visitor|PLAN|plan/i);
  });
});
