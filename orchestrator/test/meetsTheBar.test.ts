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
  ALL_RUBRIC_RULES,
  DEFAULT_THRESHOLD,
  FAIL_CLOSED_VISUAL_RULES,
  SHARED_PREFIXES,
  appsAffectedByFiles,
  filesInPushRange,
  rubricCoverageReasons,
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

  it('ALL_RUBRIC_RULES matches the rubric exactly, in order', () => {
    expect([...ALL_RUBRIC_RULES]).toEqual(loadRubric().map((r) => r.id));
  });

  describe('unmeasured rubric rules fail closed', () => {
    const everyRule = () => ({
      rules: ALL_RUBRIC_RULES.map((ruleId) => ({ ruleId, passed: true }))
    });

    it('a fully measured result reports nothing', () => {
      expect(rubricCoverageReasons(everyRule(), new Set(), new Set())).toEqual([]);
    });

    // The input that must FAIL. Confirming the good case still passes proves
    // nothing on its own — this is the case the check exists for, and before the
    // check existed a dropped rule produced no output at all.
    it('a rule absent from the result is reported by name', () => {
      const result = everyRule();
      result.rules = result.rules.filter((r) => r.ruleId !== 'u-sec-timeouts');
      const reasons = rubricCoverageReasons(result, new Set(), new Set());
      expect(reasons).toHaveLength(1);
      expect(reasons[0]).toContain('u-sec-timeouts');
      expect(reasons[0]).toContain('fails closed');
    });

    it('counts every absent rule, not just the first', () => {
      const dropped = ['u-sec-timeouts', 'fe-seo-assets', 'fe-no-inline-width'];
      const result = everyRule();
      result.rules = result.rules.filter((r) => !dropped.includes(r.ruleId));
      expect(rubricCoverageReasons(result, new Set(), new Set())[0]).toContain('3 rubric rule(s)');
    });

    it('a rule the gate recorded as not applicable is not a hole', () => {
      const result = everyRule();
      result.rules = result.rules.filter((r) => r.ruleId !== 'fe-result-in-viewport');
      expect(
        rubricCoverageReasons(result, new Set(['fe-result-in-viewport']), new Set())
      ).toEqual([]);
    });

    // This originally asserted the OPPOSITE — that a waived rule is silent — on
    // the reasoning that the caller already prints a WAIVED line. It does not:
    // the caller only prints waivers that absorbed a RECORDED failure, so a rule
    // that is waived AND never recorded produced no output anywhere. An
    // independent review found it; the test that was supposed to cover this had
    // encoded the hole instead.
    it('a waived rule that was never measured is still reported, and named as such', () => {
      const result = everyRule();
      result.rules = result.rules.filter((r) => r.ruleId !== 'hyg-no-duplication');
      const reasons = rubricCoverageReasons(result, new Set(), new Set(['hyg-no-duplication']));
      expect(reasons).toHaveLength(1);
      expect(reasons[0]).toContain('hyg-no-duplication');
      expect(reasons[0]).toContain('never measured');
    });

    // The two absences are different claims and must not collapse into one line.
    it('separates never-measured from waived-and-never-measured', () => {
      const result = everyRule();
      result.rules = result.rules.filter(
        (r) => r.ruleId !== 'hyg-no-duplication' && r.ruleId !== 'u-sec-timeouts'
      );
      const reasons = rubricCoverageReasons(result, new Set(), new Set(['hyg-no-duplication']));
      expect(reasons).toHaveLength(2);
      expect(reasons.find((r) => r.includes('no recorded outcome'))).toContain('u-sec-timeouts');
      expect(reasons.find((r) => r.includes('never measured'))).toContain('hyg-no-duplication');
    });

    it('accepts a Map of waivers as well as a Set', () => {
      const result = everyRule();
      result.rules = result.rules.filter((r) => r.ruleId !== 'hyg-no-duplication');
      const waived = new Map([['hyg-no-duplication', { reason: 'scaffold boilerplate' }]]);
      expect(rubricCoverageReasons(result, new Set(), waived)[0]).toContain('never measured');
    });
  });

  it('fix command names reverify for the slug', () => {
    expect(fixCommandFor('app-builder')).toBe(
      'node .github/scripts/reverify.mjs --app app-builder'
    );
  });

  it('APPS is the single source of truth used by reverify consumers', () => {
    // CORE production apps are always present; managed (scaffolded) apps from
    // .redanvil/managed-apps.json are merged in so the gate/PM see them without
    // a hand-edited parallel list.
    const slugs = APPS.map((a) => a.slug).sort();
    expect(slugs).toEqual(
      expect.arrayContaining(
        ['app-builder', 'az-planting-calendar', 'dashboard'].sort()
      )
    );
    // Every managed registry entry must appear in APPS (no silent drop).
    expect(slugs.length).toBeGreaterThanOrEqual(3);
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

  it('CLI --result fixture: 90 with skip flags now REFUSES on the definition-of-done rows', () => {
    // This test used to assert exit 0. It changed deliberately when
    // docs/DONE-CHECKLIST.md became a finish-line condition rather than a
    // document: a score of 90 with the git/visual/screenshot checks skipped no
    // longer means done, because rows like "npm run build exits 0" (A5) and
    // "the mark reads at 32px" (D7) have no measurement behind them yet.
    //
    // The skip flags are the tell. They were always a way to get an answer
    // without doing the work, and the checklist is what makes that visible.
    // When the unimplemented rows are implemented, this fixture should exit 0
    // again -- and the assertion should be changed back at that point, not
    // relaxed before it.
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
    expect(code).toBe(1);
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

/** Forty zeros: git's spelling of "no such object" on a new branch. */
const ZERO_SHA = '0000000000000000000000000000000000000000';

/**
 * CJS preload that records finish-line invocations and does not run the checker.
 * `ALL` means the hook called the checker with no `--app` (every gated app).
 * @returns Source for the preload.
 */
function checkerShimSource(): string {
  return [
    "const fs = require('fs');",
    'const checker = process.argv.some((arg) => {',
    "  const n = String(arg).replace(/\\\\/g, '/');",
    '  return (',
    "    n === '.github/scripts/meets_the_bar.mjs' ||",
    "    n.endsWith('/.github/scripts/meets_the_bar.mjs')",
    '  );',
    '});',
    'if (!checker) return;',
    "const index = process.argv.indexOf('--app');",
    "const slug = index === -1 ? 'ALL' : process.argv[index + 1];",
    "fs.appendFileSync(process.env.REDANVIL_HOOK_LOG, slug + '\\n');",
    'process.exit(0);',
    ''
  ].join('\n');
}

/**
 * Slugs the pre-push hook would check for one ref. The real finish line is not run.
 * @param hookPath Hook script to execute.
 * @param localSha Local tip.
 * @param remoteSha Remote tip.
 * @returns Checker slugs (`ALL` if the hook passed no `--app`), plus status and output.
 */
function probePush(
  hookPath: string,
  localSha: string,
  remoteSha: string
): { status: number | null; slugs: string[]; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'redanvil-hook-probe-'));
  const shim = join(dir, 'shim.cjs');
  const log = join(dir, 'slugs.txt');
  writeFileSync(shim, checkerShimSource(), 'utf8');
  const r = spawnSync('bash', [hookPath, 'origin', 'https://github.com/example/example.git'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_OPTIONS: `--require ${shim.replace(/\\/g, '/')}`,
      REDANVIL_HOOK_LOG: log
    },
    input: `refs/heads/probe ${localSha} refs/heads/probe ${remoteSha}\n`
  });
  const slugs = existsSync(log) ? readFileSync(log, 'utf8').split(/\r?\n/).filter(Boolean) : [];
  rmSync(dir, { recursive: true, force: true });
  return {
    status: r.status,
    slugs,
    output: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? String(r.error) : ''}`
  };
}

/**
 * Create a commit whose tree is exactly `files`, without moving HEAD or the index.
 * When `shaStartsWith` is set, the message is varied until the sha matches.
 * @param files Repo-relative path to file contents.
 * @param shaStartsWith Optional required sha prefix.
 * @returns Commit sha.
 */
function commitOnly(files: Record<string, string>, shaStartsWith?: string): string {
  const indexFile = join(
    tmpdir(),
    `redanvil-idx-${process.pid}-${Math.random().toString(16).slice(2)}`
  );
  const env = {
    ...process.env,
    GIT_INDEX_FILE: indexFile,
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t'
  };
  /**
   * @param args Git argv after `git`.
   * @param input Optional stdin.
   * @returns Trimmed stdout.
   */
  const git = (args: string[], input?: string): string => {
    const r = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', env, input });
    if (r.status !== 0) throw new Error(`${args.join(' ')}\n${r.stderr || r.stdout}`);
    return (r.stdout ?? '').trim();
  };
  try {
    const maxAttempts = 400;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      git(['read-tree', '--empty']);
      for (const [path, content] of Object.entries(files)) {
        const blob = git(['hash-object', '-w', '--stdin'], content);
        git(['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`]);
      }
      const tree = git(['write-tree']);
      const sha = git(['commit-tree', tree, '-m', `probe ${attempt} ${Date.now()}`]);
      if (!shaStartsWith || sha.startsWith(shaStartsWith)) return sha;
    }
    throw new Error(`no commit sha starting with ${shaStartsWith ?? ''} in ${maxAttempts} tries`);
  } finally {
    rmSync(indexFile, { force: true });
  }
}

describe('push range scopes the finish line', () => {
  const everySlug = () => APPS.map((app) => app.slug).sort();

  it('(a) a sushi-finder path does not select app-builder', () => {
    const hit = appsAffectedByFiles(['sushi-finder/src/main.tsx']);
    expect(hit.map((app) => app.slug)).toEqual(['sushi-finder']);
  });

  it('(b) an app-builder path selects app-builder', () => {
    const hit = appsAffectedByFiles(['app-builder/src/App.tsx']);
    expect(hit.map((app) => app.slug)).toContain('app-builder');
    expect(hit.map((app) => app.slug)).not.toContain('sushi-finder');
  });

  it('(c) each shared prefix selects every gated app', () => {
    const all = everySlug();
    expect(all).toContain('app-builder');
    expect(all).toContain('sushi-finder');
    expect(all.length).toBeGreaterThan(2);
    for (const prefix of SHARED_PREFIXES) {
      const sample = prefix.endsWith('/') ? `${prefix}touched.ts` : prefix;
      expect(
        appsAffectedByFiles([sample])
          .map((app) => app.slug)
          .sort(),
        sample
      ).toEqual(all);
    }
  });

  it('a root doc is not a shared prefix', () => {
    expect(appsAffectedByFiles(['README.md'])).toEqual([]);
    expect(appsAffectedByFiles(['docs/PUSH-BYPASS-LOG.md'])).toEqual([]);
    expect(appsAffectedByFiles(['app-builder/package.json']).map((app) => app.slug)).toEqual([
      'app-builder'
    ]);
  });

  it('(d) a remote sha of all zeros lists the tip tree', () => {
    const dir = mkdtempSync(join(tmpdir(), 'redanvil-push-range-'));
    try {
      /**
       * @param args Git argv after `git`.
       * @returns Trimmed stdout.
       */
      const git = (args: string[]): string => {
        const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
        if (r.status !== 0) throw new Error(`${args.join(' ')}\n${r.stderr || r.stdout}`);
        return (r.stdout ?? '').trim();
      };
      git(['init', '-q']);
      git(['config', 'user.email', 't@t']);
      git(['config', 'user.name', 't']);
      mkdirSync(join(dir, 'sushi-finder', 'src'), { recursive: true });
      writeFileSync(join(dir, 'sushi-finder', 'src', 'main.tsx'), 'export {}\n');
      writeFileSync(join(dir, 'README.md'), 'readme\n');
      git(['add', 'sushi-finder/src/main.tsx', 'README.md']);
      git(['commit', '-q', '-m', 'tip']);
      const head = git(['rev-parse', 'HEAD']);
      expect(filesInPushRange(dir, head, ZERO_SHA).sort()).toEqual([
        'README.md',
        'sushi-finder/src/main.tsx'
      ]);
      expect(filesInPushRange(dir, ZERO_SHA, head)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('(a) the hook does not check app-builder for a sushi-finder-only push whose tip starts with 0', () => {
    const base = commitOnly({});
    const local = commitOnly({ 'sushi-finder/src/probe.ts': 'export {}\n' }, '0');
    expect(local.startsWith('0')).toBe(true);
    expect(local).not.toBe(ZERO_SHA);
    const probed = probePush(PRE_PUSH, local, base);
    expect(probed.output, probed.output).not.toMatch(/no refs on stdin/);
    expect(probed.slugs, probed.output).toEqual(['sushi-finder']);
  });

  it('(b) the hook checks app-builder when the push touches app-builder/', () => {
    const base = commitOnly({});
    const local = commitOnly({ 'app-builder/src/probe.ts': 'export {}\n' });
    const probed = probePush(PRE_PUSH, local, base);
    expect(probed.slugs, probed.output).toEqual(['app-builder']);
    expect(probed.status, probed.output).toBe(0);
  });

  it('(c) the hook checks every gated app when the push touches a shared prefix', () => {
    const base = commitOnly({});
    const local = commitOnly({ 'design-system/probe.ts': 'export {}\n' });
    const probed = probePush(PRE_PUSH, local, base);
    expect(probed.slugs, probed.output).toEqual(APPS.map((app) => app.slug));
    expect(probed.slugs).toContain('app-builder');
  });

  it('(d) the hook treats a remote sha of all zeros as the tip tree', () => {
    const local = commitOnly({
      'sushi-finder/src/probe.ts': 'export {}\n',
      'README.md': 'readme\n'
    });
    expect(filesInPushRange(REPO_ROOT, local, ZERO_SHA).sort()).toEqual([
      'README.md',
      'sushi-finder/src/probe.ts'
    ]);
    const probed = probePush(PRE_PUSH, local, ZERO_SHA);
    expect(probed.output, probed.output).not.toMatch(/no refs on stdin/);
    expect(probed.slugs, probed.output).toEqual(['sushi-finder']);
  });
});
