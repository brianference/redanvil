/**
 * Known-answer fixtures for the finish line (`meets_the_bar`).
 *
 * A guard that cannot fail is not a guard. These cases prove REFUSAL:
 *   - finalScore 89 blocks; 90 passes the score half
 *   - one rule with passed:false blocks regardless of score
 *   - a missing results file blocks
 *   - evidence older than the reviewed commit blocks
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadRubric } from '../src/rubric/index';
import {
  DEFAULT_THRESHOLD,
  FAIL_CLOSED_VISUAL_RULES,
  appsAffectedByFiles,
  evidenceAgeReasons,
  evaluateApp,
  fixCommandFor,
  main,
  parseResultShape,
  scoreBarReasons
} from '../../.github/scripts/meets_the_bar.mjs';
import { APPS } from '../../.github/scripts/apps.mjs';

const FIXTURES = fileURLToPath(new URL('./fixtures/finish-line', import.meta.url));
const CHECKER = fileURLToPath(new URL('../../.github/scripts/meets_the_bar.mjs', import.meta.url));
const PRE_PUSH = fileURLToPath(new URL('../../.githooks/pre-push', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const node = process.execPath;

/**
 * Parse a finish-line fixture by filename.
 * @param name Fixture file name.
 * @returns Parsed JSON.
 */
function fixtureJson(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
}

describe('finish-line constants', () => {
  it('default threshold is 90', () => {
    expect(DEFAULT_THRESHOLD).toBe(90);
  });

  it('FAIL_CLOSED_VISUAL_RULES matches every rubric visual rule', () => {
    const fromRubric = loadRubric()
      .filter((r) => r.method === 'visual')
      .map((r) => r.id)
      .sort();
    const fromModule = [...FAIL_CLOSED_VISUAL_RULES].sort();
    expect(fromModule).toEqual(fromRubric);
  });

  it('fix command names reverify for the slug', () => {
    expect(fixCommandFor('app-builder')).toBe(
      'node .github/scripts/reverify.mjs --app app-builder'
    );
  });

  it('APPS is the single source of truth used by reverify consumers', () => {
    expect(APPS.map((a) => a.slug).sort()).toEqual(
      ['app-builder', 'az-planting-calendar', 'dashboard'].sort()
    );
  });
});

describe('score half of the finish line (refusal)', () => {
  it('blocks a result recording finalScore 89', () => {
    const result = parseResultShape(fixtureJson('result-89.json'));
    const reasons = scoreBarReasons(result);
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.some((r) => /89/.test(r) && /90|threshold/i.test(r))).toBe(true);
  });

  it('passes the score half for finalScore 90 with no failed rules', () => {
    const result = parseResultShape(fixtureJson('result-90.json'));
    const reasons = scoreBarReasons(result);
    expect(reasons).toEqual([]);
  });

  it('blocks a result with one rule passed:false regardless of score', () => {
    const result = parseResultShape(fixtureJson('result-failed-rule.json'));
    // Score is 95 — still must refuse because a rule failed.
    expect(result?.finalScore).toBe(95);
    const reasons = scoreBarReasons(result);
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.some((r) => /passed === false|fe-required-pages/.test(r))).toBe(true);
  });

  it('blocks a missing / null result', () => {
    const reasons = scoreBarReasons(null);
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons[0]).toMatch(/missing|parseable/i);
  });
});

describe('evidence older than the reviewed commit blocks', () => {
  it('refuses when checkedAt predates the reviewed commit', () => {
    const dir = mkdtempSync(join(tmpdir(), 'redanvil-evidence-age-'));
    try {
      /**
       * @param args Git argv after `git`.
       * @returns Trimmed stdout.
       */
      const git = (args: string[]): string => {
        const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
        if (r.status !== 0) throw new Error(r.stderr || r.stdout);
        return (r.stdout ?? '').trim();
      };
      git(['init', '-q']);
      git(['config', 'user.email', 't@t']);
      git(['config', 'user.name', 't']);
      writeFileSync(join(dir, 'x.txt'), 'x\n');
      git(['add', 'x.txt']);
      // Date the commit in 2024 so the 2020 evidence is clearly older.
      git(['commit', '-q', '--date=2024-06-01T12:00:00', '-m', 'init']);
      const sha = git(['rev-parse', 'HEAD']);

      mkdirSync(join(dir, 'evidence'), { recursive: true });
      writeFileSync(
        join(dir, 'evidence', 'stale.json'),
        JSON.stringify({
          baseUrl: 'https://example.pages.dev',
          checkedAt: '2020-01-01T00:00:00.000Z',
          findings: {},
          ok: true
        }),
        'utf8'
      );

      const reasons = evidenceAgeReasons(dir, 'fe-touch-targets', sha, [
        'evidence/stale.json'
      ]);
      expect(reasons.length).toBeGreaterThan(0);
      expect(reasons[0]).toMatch(/BEFORE the commit|produced at/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('evaluateApp end-to-end refusal', () => {
  it('blocks when the results file is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'redanvil-no-result-'));
    try {
      const verdict = evaluateApp(
        dir,
        { slug: 'ghost-app', dir: 'ghost-app' },
        {
          skipGit: true,
          skipVisual: true
        }
      );
      expect(verdict.ok).toBe(false);
      expect(verdict.reasons.some((r) => /missing/i.test(r))).toBe(true);
      expect(verdict.fixCommand).toContain('reverify.mjs --app ghost-app');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('CLI --result fixture: 89 exits 1 and prints the fix command', () => {
    const code = main(
      [
        '--result',
        join(FIXTURES, 'result-89.json'),
        '--slug',
        'fixture-app',
        '--skip-git',
        '--skip-visual',
        '--skip-screenshots'
      ],
      REPO_ROOT
    );
    expect(code).toBe(1);
  });

  it('CLI --result fixture: 90 with skip flags exits 0', () => {
    const code = main(
      [
        '--result',
        join(FIXTURES, 'result-90.json'),
        '--slug',
        'fixture-app',
        '--skip-git',
        '--skip-visual',
        '--skip-screenshots'
      ],
      REPO_ROOT
    );
    expect(code).toBe(0);
  });

  it('CLI --result fixture: failed rule exits 1 regardless of score', () => {
    const code = main(
      [
        '--result',
        join(FIXTURES, 'result-failed-rule.json'),
        '--slug',
        'fixture-app',
        '--skip-git',
        '--skip-visual',
        '--skip-screenshots'
      ],
      REPO_ROOT
    );
    expect(code).toBe(1);
  });
});

describe('appsAffectedByFiles', () => {
  it('maps a path under an app dir to that app', () => {
    const hit = appsAffectedByFiles(['app-builder/src/App.tsx', 'README.md']);
    expect(hit.map((a) => a.slug)).toEqual(['app-builder']);
  });

  it('maps results/<slug>.json to the app', () => {
    const hit = appsAffectedByFiles(['results/dashboard.json']);
    expect(hit.map((a) => a.slug)).toEqual(['dashboard']);
  });
});

describe('pre-push refuses a sub-90 fixture', () => {
  it('exits non-zero when REDANVIL_MEETS_THE_BAR_RESULT records 89', () => {
    // Git Bash / sh on Windows; fall back to bash if sh is absent.
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
      return;
    }
    // No sh/bash available — still prove the checker refuses.
    expect(existsSync(PRE_PUSH)).toBe(true);
    const cli = spawnSync(
      node,
      [
        CHECKER,
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
  });
});
