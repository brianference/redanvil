/**
 * Known-answer tests for overnight.mjs hardening.
 *
 * A check that cannot fail is not a check. Each case names the input that
 * must FAIL (or must flip a previously-always-false fact) and produces it.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, describe, test } from 'node:test';

const HERE = dirname(fileURLToPath(import.meta.url));
const OVERNIGHT = join(HERE, '..', 'loki', 'overnight.mjs');
const NODE = process.execPath;

/** Shared import sandbox — never the real repo, so receipts cannot land in evidence/. */
const IMPORT_REPO = mkdtempSync(join(tmpdir(), 'overnight-import-'));
process.env.REDANVIL_REPO = IMPORT_REPO;
mkdirSync(join(IMPORT_REPO, 'results'), { recursive: true });
writeFileSync(join(IMPORT_REPO, 'results', 'all.json'), '[]\n');

const overnight = await import('../loki/overnight.mjs');

/**
 * Run a git command in `cwd`. Throws on non-zero so a silent git failure cannot
 * look like a passing test.
 * @param {string} cwd directory
 * @param {string[]} args git argv after `git`
 * @returns {string} trimmed stdout
 */
function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  }
  return (r.stdout ?? '').trim();
}

/**
 * Unique work-item id so leftover sibling worktrees cannot leak across runs.
 * @param {string} label short label
 * @returns {string}
 */
function uniqueSlug(label) {
  return `${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Path overnight.mjs uses for a worktree: resolve(repo, '..', `redanvil-wt-${slug}`).
 * @param {string} repo
 * @param {string} slug
 * @returns {string}
 */
function resolveSiblingWorktree(repo, slug) {
  return join(dirname(repo), `redanvil-wt-${slug}`);
}

/**
 * Drop a temp repo and its sibling worktree. Never touches the workspace.
 * @param {string} repo
 * @param {string} slug
 */
function cleanupRepo(repo, slug) {
  const wt = resolveSiblingWorktree(repo, slug);
  try {
    rmSync(wt, { recursive: true, force: true });
  } catch {
    /* already gone */
  }
  try {
    git(repo, ['worktree', 'prune']);
  } catch {
    /* repo may already be gone */
  }
  rmSync(repo, { recursive: true, force: true });
}

/**
 * Isolated git repo under os.tmpdir, never the workspace.
 * @returns {string} repo path
 */
function makeGitRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'overnight-repo-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 't@t']);
  git(dir, ['config', 'user.name', 't']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  return dir;
}

/**
 * Spawn overnight.mjs against a temp repo. Never the workspace.
 * @param {string[]} args CLI args
 * @param {Record<string, string|undefined>} extraEnv env overlay
 * @param {string} [repo] REDANVIL_REPO
 * @returns {{status: number|null, stdout: string, stderr: string, repo: string}}
 */
function spawnOvernight(args, extraEnv = {}, repo = mkdtempSync(join(tmpdir(), 'overnight-cli-'))) {
  mkdirSync(join(repo, 'results'), { recursive: true });
  if (!existsSync(join(repo, 'results', 'all.json'))) {
    writeFileSync(join(repo, 'results', 'all.json'), '[]\n');
  }
  const r = spawnSync(NODE, [OVERNIGHT, ...args], {
    encoding: 'utf8',
    timeout: 20_000,
    env: { ...process.env, REDANVIL_REPO: repo, ...extraEnv }
  });
  return {
    status: r.status,
    stdout: String(r.stdout ?? ''),
    stderr: String(r.stderr ?? ''),
    repo
  };
}

/**
 * Read last-run.json from a temp repo.
 * @param {string} repo repo path
 * @returns {object}
 */
function readSummary(repo) {
  return JSON.parse(readFileSync(join(repo, '.redanvil', 'overnight', 'last-run.json'), 'utf8'));
}

after(() => {
  rmSync(IMPORT_REPO, { recursive: true, force: true });
});

describe('1. deadline', () => {
  test('FAIL INPUT: OVERNIGHT_DEADLINE_ISO in the past must NOT roll to tomorrow', () => {
    const past = '2020-01-01T00:00:00.000Z';
    const now = new Date('2026-08-21T23:30:00.000Z');
    const ms = overnight.resolveDeadline({ envIso: past, now });
    assert.equal(ms, Date.parse(past));
  });

  test('--until 06:00 from 23:30 local rolls to the next morning', () => {
    const now = new Date(2026, 7, 21, 23, 30, 0, 0);
    const ms = overnight.resolveDeadline({ untilFlag: '06:00', now });
    const got = new Date(ms);
    assert.equal(got.getHours(), 6);
    assert.equal(got.getMinutes(), 0);
    assert.equal(got.getDate(), 22);
  });

  test('--until later today stays today', () => {
    const now = new Date(2026, 7, 21, 22, 0, 0, 0);
    const ms = overnight.resolveDeadline({ untilFlag: '23:00', now });
    const got = new Date(ms);
    assert.equal(got.getHours(), 23);
    assert.equal(got.getDate(), 21);
  });

  test('default is 06:00 local', () => {
    const now = new Date(2026, 7, 21, 23, 30, 0, 0);
    const ms = overnight.resolveDeadline({ now });
    const got = new Date(ms);
    assert.equal(got.getHours(), 6);
    assert.equal(got.getMinutes(), 0);
  });

  test('FAIL INPUT: 45-minute item timeout with 10 minutes left must clamp, not keep 45', () => {
    const fortyFive = 45 * 60 * 1000;
    const ten = 10 * 60 * 1000;
    assert.equal(overnight.clampToRemaining(fortyFive, ten), ten);
  });

  test('FAIL INPUT: a 60-minute backoff with 20 minutes left must not fit', () => {
    assert.equal(overnight.backoffFits(60 * 60 * 1000, 20 * 60 * 1000), false);
    assert.equal(overnight.backoffFits(5 * 60 * 1000, 20 * 60 * 1000), true);
  });

  test('CLI: deadline in the near past starts zero items and records why', () => {
    const { status, stdout, repo } = spawnOvernight(
      ['--dry-run', '--max-items', '5'],
      { OVERNIGHT_DEADLINE_ISO: '2000-01-01T00:00:00.000Z' }
    );
    assert.equal(status, 0, stdout + '\n' + spawnOvernight.name);
    const summary = readSummary(repo);
    assert.equal(summary.stoppedEarly, true);
    assert.ok(summary.itemsSkipped > 0, `itemsSkipped=${summary.itemsSkipped}`);
    assert.equal(summary.receipts.length, 0);
    assert.ok(typeof summary.deadline === 'string' && summary.deadline.length > 0);
    assert.ok(
      /deadline|stopping before/i.test(stdout) || /deadline|stopping before/i.test(String(summary.stopReason ?? '')),
      `stdout=${stdout}`
    );
    assert.ok(!/--- (gate-|bug-|drift-)/.test(stdout), `started an item:\n${stdout}`);
    rmSync(repo, { recursive: true, force: true });
  });

  test('short way ahead: the second item is skipped rather than started', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'overnight-clock-'));
    mkdirSync(join(repo, 'results'), { recursive: true });
    writeFileSync(join(repo, 'results', 'all.json'), '[]\n');
    const start = 1_700_000_000_000;
    let n = 0;
    const result = await overnight.runOvernight({
      args: { 'dry-run': true },
      repoRoot: repo,
      deadlineAt: start + 1000,
      nowFn: () => {
        n += 1;
        return n === 1 ? start : start + 2000;
      },
      queue: [
        { id: 'item-a', kind: 'fix-known-bug', summary: 'first' },
        { id: 'item-b', kind: 'fix-known-bug', summary: 'second' }
      ],
      loki: { available: false, version: null }
    });
    assert.equal(result.receipts.length, 1, 'first item should start');
    assert.equal(result.stoppedEarly, true);
    assert.equal(result.itemsSkipped, 1);
    rmSync(repo, { recursive: true, force: true });
  });
});

describe('2. shouldMerge — each missing condition is a FAIL input', () => {
  const good = {
    testsRan: true,
    testsPassed: true,
    buildSucceeded: true,
    gatePassed: true,
    diffChanged: true,
    mainDirty: false
  };

  test('all conditions hold → merge', () => {
    assert.equal(overnight.shouldMerge(good), true);
  });

  for (const key of ['testsRan', 'testsPassed', 'buildSucceeded', 'gatePassed', 'diffChanged']) {
    test(`FAIL INPUT: ${key}=false refuses the merge`, () => {
      assert.equal(overnight.shouldMerge({ ...good, [key]: false }), false);
    });
  }

  test('FAIL INPUT: dirty main tree refuses the merge (the 18-file path)', () => {
    assert.equal(overnight.shouldMerge({ ...good, mainDirty: true }), false);
  });
});

describe('3. writeReceipt verified conjunction', () => {
  /**
   * @param {object} extra
   */
  function facts(extra = {}) {
    return {
      id: 't',
      kind: 'close-gate-failures',
      app: 'dashboard',
      startedAt: '2026-08-21T00:00:00.000Z',
      executor: 'test',
      commitBefore: 'aaa',
      commitAfter: 'bbb',
      testsRan: true,
      testsPassed: true,
      buildSucceeded: true,
      gateScore: 91,
      gatePassed: true,
      ...extra
    };
  }

  test('FAIL INPUT: deploy attempted and deployHashMatches=false stays UNVERIFIED', () => {
    const path = overnight.writeReceipt(
      facts({ deployAttempted: true, deployed: true, deployHashMatches: false })
    );
    const rec = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(rec.status, 'UNVERIFIED');
    assert.equal(rec.facts.deployed, true);
    assert.equal(rec.facts.deployHashMatches, false);
  });

  test('deploy attempted and hash matches can be VERIFIED', () => {
    const path = overnight.writeReceipt(
      facts({ deployAttempted: true, deployed: true, deployHashMatches: true })
    );
    const rec = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(rec.status, 'VERIFIED');
    assert.equal(rec.facts.deployed, true);
    assert.equal(rec.facts.deployHashMatches, true);
  });

  test('no deploy attempted: conjunction is unchanged (hash false does not block)', () => {
    const path = overnight.writeReceipt(facts({ deployAttempted: false, deployed: false, deployHashMatches: false }));
    const rec = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(rec.status, 'VERIFIED');
    assert.equal(rec.facts.deployed, false);
    assert.equal(rec.facts.deployHashMatches, false);
  });

  test('FAIL INPUT: identical commits keep diffChanged false, so VERIFIED is unreachable', () => {
    const path = overnight.writeReceipt(facts({ commitBefore: 'same', commitAfter: 'same' }));
    const rec = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(rec.facts.diffChanged, false);
    assert.equal(rec.status, 'UNVERIFIED');
  });
});

describe('4. production_branch is read, never guessed', () => {
  test('FAIL INPUT: API result with no production_branch skips (does not default to main)', async () => {
    const got = await overnight.readProductionBranch('demo', {
      token: 't',
      accountId: 'acct',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, result: { name: 'demo' } })
      })
    });
    assert.equal(got.branch, null);
    assert.match(got.reason, /production_branch/);
    assert.notEqual(got.branch, 'main');
  });

  test('FAIL INPUT: HTTP 404 skips rather than guessing main', async () => {
    const got = await overnight.readProductionBranch('missing', {
      token: 't',
      accountId: 'acct',
      fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) })
    });
    assert.equal(got.branch, null);
  });

  test('API production_branch is used as-is', async () => {
    const got = await overnight.readProductionBranch('demo', {
      token: 't',
      accountId: 'acct',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, result: { production_branch: 'production' } })
      })
    });
    assert.equal(got.branch, 'production');
  });
});

describe('5. deployAndVerify', () => {
  /** @type {string} */
  let appRepo;

  before(() => {
    appRepo = mkdtempSync(join(tmpdir(), 'overnight-deploy-'));
    const app = join(appRepo, 'dashboard');
    mkdirSync(join(app, 'dist', 'assets'), { recursive: true });
    mkdirSync(join(app, 'functions', 'api'), { recursive: true });
    mkdirSync(join(app, '.redanvil'), { recursive: true });
    writeFileSync(
      join(app, 'wrangler.toml'),
      'name = "redanvil-dashboard"\ncompatibility_date = "2026-07-01"\npages_build_output_dir = "dist"\n'
    );
    writeFileSync(
      join(app, 'dist', 'index.html'),
      '<script src="/assets/index-LOCALHASH.js"></script>\n'
    );
    writeFileSync(join(app, 'dist', 'assets', 'index-LOCALHASH.js'), '/* local */\n');
    writeFileSync(join(app, 'functions', 'api', 'health.ts'), 'export function onRequest() {}\n');
    writeFileSync(
      join(app, '.redanvil', 'claims.json'),
      JSON.stringify({ deployUrl: 'https://redanvil-dashboard.pages.dev' })
    );
  });

  after(() => {
    rmSync(appRepo, { recursive: true, force: true });
  });

  /**
   * @param {object} opts
   */
  function runStub(opts = {}) {
    return (cmd, args) => {
      if (cmd === 'npm' && args.includes('build')) return { status: 0, stdout: 'built', stderr: '' };
      if (cmd === 'npx' && args.includes('wrangler')) {
        if (opts.capture) opts.capture.push({ cmd, args });
        return { status: opts.wranglerStatus ?? 0, stdout: 'Compiled. Success', stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    };
  }

  test('FAIL INPUT: missing production_branch does not deploy', async () => {
    const captures = [];
    const result = await overnight.deployAndVerify('dashboard', appRepo, {
      run: runStub({ capture: captures }),
      fetchImpl: async (url) => {
        if (String(url).includes('/pages/projects/')) {
          return { ok: true, status: 200, json: async () => ({ result: {} }), text: async () => '' };
        }
        return { ok: true, status: 200, text: async () => '', json: async () => ({}) };
      },
      env: { CLOUDFLARE_API_TOKEN: 'test-token-not-a-secret' }
    });
    assert.equal(result.attempted, false);
    assert.equal(result.deployed, false);
    assert.ok(captures.every((c) => !c.args.includes('wrangler')));
    assert.ok(result.notes.some((n) => /production_branch|skipped/i.test(n)));
  });

  test('FAIL INPUT: prod hash differs from local → deployHashMatches false', async () => {
    const result = await overnight.deployAndVerify('dashboard', appRepo, {
      run: runStub(),
      fetchImpl: async (url) => {
        if (String(url).includes('/pages/projects/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ result: { production_branch: 'main' } }),
            text: async () => ''
          };
        }
        return {
          ok: true,
          status: 200,
          text: async () => '<script src="/assets/index-OTHER.js"></script>',
          json: async () => ({})
        };
      },
      env: { CLOUDFLARE_API_TOKEN: 'test-token-not-a-secret' },
      pollMs: 0,
      pollAttempts: 1
    });
    assert.equal(result.attempted, true);
    assert.equal(result.hashMatches, false);
  });

  test('matching asset hash is the proof that matters', async () => {
    const fetched = [];
    const result = await overnight.deployAndVerify('dashboard', appRepo, {
      run: runStub(),
      fetchImpl: async (url) => {
        fetched.push(String(url));
        if (String(url).includes('/pages/projects/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ result: { production_branch: 'main' } }),
            text: async () => ''
          };
        }
        if (String(url).includes('/api/health')) {
          return { ok: true, status: 200, text: async () => '{"status":"ok"}', json: async () => ({ status: 'ok' }) };
        }
        return {
          ok: true,
          status: 200,
          text: async () => '<script src="/assets/index-LOCALHASH.js"></script>',
          json: async () => ({})
        };
      },
      env: { CLOUDFLARE_API_TOKEN: 'test-token-not-a-secret' },
      pollMs: 0,
      pollAttempts: 1
    });
    assert.equal(result.hashMatches, true);
    assert.equal(result.deployed, true);
    assert.ok(
      fetched.some((u) => u.startsWith('https://redanvil-dashboard.pages.dev')),
      `prod URL not fetched: ${fetched.join(',')}`
    );
    assert.ok(
      fetched.some((u) => u.includes('/api/health')),
      'Pages Functions exist so /api/health must be curled'
    );
    assert.ok(
      result.notes.every((n) => !/\.pages\.dev\/[a-f0-9]{8}/.test(n)),
      'must not report a per-deploy hash URL'
    );
  });

  test('FAIL INPUT: no functions directory means backend health is not probed', async () => {
    const bare = mkdtempSync(join(tmpdir(), 'overnight-static-'));
    const app = join(bare, 'static-app');
    mkdirSync(join(app, 'dist', 'assets'), { recursive: true });
    writeFileSync(
      join(app, 'wrangler.toml'),
      'name = "static-app"\npages_build_output_dir = "dist"\n'
    );
    writeFileSync(join(app, 'dist', 'index.html'), '<script src="/assets/index-AAA.js"></script>\n');
    writeFileSync(join(app, 'dist', 'assets', 'index-AAA.js'), 'x\n');
    const fetched = [];
    await overnight.deployAndVerify('static-app', bare, {
      run: runStub(),
      fetchImpl: async (url) => {
        fetched.push(String(url));
        if (String(url).includes('/pages/projects/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ result: { production_branch: 'main' } }),
            text: async () => ''
          };
        }
        return {
          ok: true,
          status: 200,
          text: async () => '<script src="/assets/index-AAA.js"></script>',
          json: async () => ({})
        };
      },
      env: { CLOUDFLARE_API_TOKEN: 'test-token-not-a-secret' },
      pollMs: 0,
      pollAttempts: 1
    });
    assert.ok(!fetched.some((u) => u.includes('/api/health')));
    rmSync(bare, { recursive: true, force: true });
  });

  test('FAIL INPUT: token must not appear in notes or wrangler argv', async () => {
    const token = 'super-secret-token-xyz-test-only';
    const captures = [];
    const result = await overnight.deployAndVerify('dashboard', appRepo, {
      run: runStub({ capture: captures }),
      fetchImpl: async (url) => {
        if (String(url).includes('/pages/projects/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ result: { production_branch: 'main' } }),
            text: async () => ''
          };
        }
        return {
          ok: true,
          status: 200,
          text: async () => '<script src="/assets/index-LOCALHASH.js"></script>',
          json: async () => ({})
        };
      },
      env: { CLOUDFLARE_API_TOKEN: token },
      pollMs: 0,
      pollAttempts: 1
    });
    const blob = JSON.stringify(result) + captures.map((c) => c.args.join(' ')).join(' ');
    assert.ok(!blob.includes(token), 'token leaked');
  });
});

describe('6. worktree measure and merge', () => {
  test('source does not pass --force to git worktree remove', () => {
    const src = readFileSync(OVERNIGHT, 'utf8');
    assert.equal(
      (src.match(/worktree',\s*'remove',\s*'--force/g) || []).length,
      0,
      'FAIL INPUT: --force on worktree remove'
    );
    assert.match(src, /worktree',\s*'remove'/);
  });

  test('agent change in the worktree flips diffChanged to true and can merge', async () => {
    const repo = makeGitRepo();
    const app = 'dashboard';
    mkdirSync(join(repo, app, 'src'), { recursive: true });
    mkdirSync(join(repo, 'results'), { recursive: true });
    writeFileSync(join(repo, app, 'src', 'index.js'), 'export const n = 1;\n');
    writeFileSync(
      join(repo, 'results', 'all.json'),
      JSON.stringify([{ slug: app, finalScore: 0 }])
    );
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-qm', 'setup']);
    const before = git(repo, ['rev-parse', 'HEAD']);

    let vitestCwd = null;
    let gateCwds = [];
    let gateCalls = 0;
    const runCmd = (cmd, args, opts = {}) => {
      if (cmd === 'npx' && args[0] === 'vitest') {
        vitestCwd = opts.cwd;
        return { status: 0, stdout: 'passed', stderr: '' };
      }
      if (cmd === 'npm' && args[0] === 'run' && args[1] === 'build') {
        return { status: 0, stdout: 'built', stderr: '' };
      }
      if (cmd === 'npm' && args[0] === 'run' && args[1] === 'gate') {
        gateCalls += 1;
        gateCwds.push(opts.cwd);
        if (gateCalls === 1) {
          return { status: 1, stdout: 'score 0 / 100\nblockers failed: lg-shipped\n', stderr: '' };
        }
        return { status: 0, stdout: 'score 91 / 100\nblockers failed: \n', stderr: '' };
      }
      const proc = spawnSync(cmd, args, {
        cwd: opts.cwd,
        encoding: 'utf8',
        timeout: opts.timeout ?? 60_000,
        shell: process.platform === 'win32'
      });
      return {
        status: proc.status,
        stdout: String(proc.stdout ?? ''),
        stderr: String(proc.stderr ?? '')
      };
    };

    const slug = uniqueSlug(`gate-${app}-flip`);
    const receiptPath = await overnight.processItem(
      { id: slug, kind: 'close-gate-failures', app, summary: 'flip' },
      {
        lokiAvailable: false,
        allowDeploy: false,
        dryRun: false,
        repoRoot: repo,
        run: runCmd,
        dispatchFix: (_a, _b, cwd) => {
          writeFileSync(join(cwd, app, 'src', 'index.js'), 'export const n = 2;\n');
          return { agent: 'test-agent', status: 0, ok: true, costUsd: 0, output: 'changed n' };
        }
      }
    );
    const rec = JSON.parse(readFileSync(receiptPath, 'utf8'));
    assert.equal(rec.facts.diffChanged, true, JSON.stringify(rec.facts));
    assert.notEqual(rec.facts.commitAfter, before);
    assert.ok(
      vitestCwd && vitestCwd.includes('redanvil-wt-'),
      `tests ran in main tree, not worktree: ${vitestCwd}`
    );
    assert.ok(
      gateCwds[1] && gateCwds[1].includes('redanvil-wt-') === false
        ? gateCwds[1] === repo || String(gateCwds[1]).includes('redanvil-wt-')
        : true
    );
    assert.ok(
      gateCwds.some((c) => c && String(c).includes('redanvil-wt-')),
      `post-fix gate did not run in the worktree: ${JSON.stringify(gateCwds)}`
    );
    assert.ok(
      rec.notes.some((n) => /merged/i.test(n)),
      `expected merge, notes=${rec.notes.join(' | ')}`
    );
    const afterFile = readFileSync(join(repo, app, 'src', 'index.js'), 'utf8');
    assert.match(afterFile, /n = 2/);
    cleanupRepo(repo, slug);
  });

  test('FAIL INPUT: agent changes nothing → diffChanged stays false, no merge', async () => {
    const repo = makeGitRepo();
    const app = 'dashboard';
    mkdirSync(join(repo, app, 'src'), { recursive: true });
    writeFileSync(join(repo, app, 'src', 'index.js'), 'export const n = 1;\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-qm', 'setup']);

    let gateCalls = 0;
    const runCmd = (cmd, args, opts = {}) => {
      if (cmd === 'npx' && args[0] === 'vitest') return { status: 0, stdout: 'passed', stderr: '' };
      if (cmd === 'npm' && args[0] === 'run' && args[1] === 'build') {
        return { status: 0, stdout: 'built', stderr: '' };
      }
      if (cmd === 'npm' && args[0] === 'run' && args[1] === 'gate') {
        gateCalls += 1;
        if (gateCalls === 1) {
          return { status: 1, stdout: 'score 0 / 100\nblockers failed: lg-shipped\n', stderr: '' };
        }
        return { status: 0, stdout: 'score 91 / 100\nblockers failed: \n', stderr: '' };
      }
      const proc = spawnSync(cmd, args, {
        cwd: opts.cwd,
        encoding: 'utf8',
        timeout: opts.timeout ?? 60_000,
        shell: process.platform === 'win32'
      });
      return {
        status: proc.status,
        stdout: String(proc.stdout ?? ''),
        stderr: String(proc.stderr ?? '')
      };
    };

    const slug = uniqueSlug(`gate-${app}-noop`);
    const receiptPath = await overnight.processItem(
      { id: slug, kind: 'close-gate-failures', app, summary: 'noop' },
      {
        lokiAvailable: false,
        allowDeploy: false,
        dryRun: false,
        repoRoot: repo,
        run: runCmd,
        dispatchFix: () => ({ agent: 'test-agent', status: 0, ok: true, costUsd: 0, output: 'no edits' })
      }
    );
    const rec = JSON.parse(readFileSync(receiptPath, 'utf8'));
    assert.equal(rec.facts.diffChanged, false);
    assert.ok(
      rec.notes.every((n) => !/^merged /i.test(n)),
      `merged a no-op: ${rec.notes.join(' | ')}`
    );
    cleanupRepo(repo, slug);
  });

  test('FAIL INPUT: dirty main tree skips merge with a note, does not crash', async () => {
    const repo = makeGitRepo();
    const app = 'dashboard';
    mkdirSync(join(repo, app, 'src'), { recursive: true });
    writeFileSync(join(repo, app, 'src', 'index.js'), 'export const n = 1;\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-qm', 'setup']);
    writeFileSync(join(repo, 'dirty.txt'), 'in-flight work\n');

    let gateCalls = 0;
    const runCmd = (cmd, args, opts = {}) => {
      if (cmd === 'npx' && args[0] === 'vitest') return { status: 0, stdout: 'passed', stderr: '' };
      if (cmd === 'npm' && args[0] === 'run' && args[1] === 'build') {
        return { status: 0, stdout: 'built', stderr: '' };
      }
      if (cmd === 'npm' && args[0] === 'run' && args[1] === 'gate') {
        gateCalls += 1;
        if (gateCalls === 1) {
          return { status: 1, stdout: 'score 0 / 100\nblockers failed: lg-shipped\n', stderr: '' };
        }
        return { status: 0, stdout: 'score 91 / 100\nblockers failed: \n', stderr: '' };
      }
      const proc = spawnSync(cmd, args, {
        cwd: opts.cwd,
        encoding: 'utf8',
        timeout: opts.timeout ?? 60_000,
        shell: process.platform === 'win32'
      });
      return {
        status: proc.status,
        stdout: String(proc.stdout ?? ''),
        stderr: String(proc.stderr ?? '')
      };
    };

    const slug = uniqueSlug(`gate-${app}-dirty`);
    const receiptPath = await overnight.processItem(
      { id: slug, kind: 'close-gate-failures', app, summary: 'dirty' },
      {
        lokiAvailable: false,
        allowDeploy: false,
        dryRun: false,
        repoRoot: repo,
        run: runCmd,
        dispatchFix: (_a, _b, cwd) => {
          writeFileSync(join(cwd, app, 'src', 'index.js'), 'export const n = 2;\n');
          return { agent: 'test-agent', status: 0, ok: true, costUsd: 0, output: 'changed n' };
        }
      }
    );
    const rec = JSON.parse(readFileSync(receiptPath, 'utf8'));
    assert.equal(rec.facts.diffChanged, true);
    assert.ok(
      rec.notes.some((n) => /dirty/i.test(n)),
      `missing dirty-main note: ${rec.notes.join(' | ')}`
    );
    assert.ok(rec.notes.every((n) => !/^merged /i.test(n)));
    assert.equal(readFileSync(join(repo, app, 'src', 'index.js'), 'utf8'), 'export const n = 1;\n');
    cleanupRepo(repo, slug);
  });

  test('FAIL INPUT: tests fail → no merge, worktree left in place', async () => {
    const repo = makeGitRepo();
    const app = 'dashboard';
    mkdirSync(join(repo, app, 'src'), { recursive: true });
    writeFileSync(join(repo, app, 'src', 'index.js'), 'export const n = 1;\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-qm', 'setup']);

    let gateCalls = 0;
    const runCmd = (cmd, args, opts = {}) => {
      if (cmd === 'npx' && args[0] === 'vitest') return { status: 1, stdout: 'failed', stderr: '' };
      if (cmd === 'npm' && args[0] === 'run' && args[1] === 'build') {
        return { status: 0, stdout: 'built', stderr: '' };
      }
      if (cmd === 'npm' && args[0] === 'run' && args[1] === 'gate') {
        gateCalls += 1;
        return { status: 1, stdout: 'score 0 / 100\nblockers failed: lg-shipped\n', stderr: '' };
      }
      const proc = spawnSync(cmd, args, {
        cwd: opts.cwd,
        encoding: 'utf8',
        timeout: opts.timeout ?? 60_000,
        shell: process.platform === 'win32'
      });
      return {
        status: proc.status,
        stdout: String(proc.stdout ?? ''),
        stderr: String(proc.stderr ?? '')
      };
    };

    const slug = uniqueSlug(`gate-${app}-failtests`);
    const receiptPath = await overnight.processItem(
      { id: slug, kind: 'close-gate-failures', app, summary: 'failtests' },
      {
        lokiAvailable: false,
        allowDeploy: false,
        dryRun: false,
        repoRoot: repo,
        run: runCmd,
        dispatchFix: (_a, _b, cwd) => {
          writeFileSync(join(cwd, app, 'src', 'index.js'), 'export const n = 2;\n');
          return { agent: 'test-agent', status: 0, ok: true, costUsd: 0, output: 'changed n' };
        }
      }
    );
    const rec = JSON.parse(readFileSync(receiptPath, 'utf8'));
    assert.equal(rec.facts.testsPassed, false);
    assert.ok(rec.notes.every((n) => !/^merged /i.test(n)));
    const wtPath = resolveSiblingWorktree(repo, slug);
    assert.ok(existsSync(wtPath), `worktree should remain at ${wtPath}`);
    cleanupRepo(repo, slug);
  });

  test('FAIL INPUT: --allow-deploy is a no-op unless the merge actually landed', async () => {
    const repo = makeGitRepo();
    const app = 'dashboard';
    mkdirSync(join(repo, app, 'src'), { recursive: true });
    writeFileSync(join(repo, app, 'src', 'index.js'), 'export const n = 1;\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-qm', 'setup']);

    let wranglerCalled = false;
    let gateCalls = 0;
    const runCmd = (cmd, args, opts = {}) => {
      if (cmd === 'npx' && args.includes('wrangler')) {
        wranglerCalled = true;
        return { status: 0, stdout: 'should not run', stderr: '' };
      }
      if (cmd === 'npx' && args[0] === 'vitest') return { status: 0, stdout: 'passed', stderr: '' };
      if (cmd === 'npm' && args[0] === 'run' && args[1] === 'build') {
        return { status: 0, stdout: 'built', stderr: '' };
      }
      if (cmd === 'npm' && args[0] === 'run' && args[1] === 'gate') {
        gateCalls += 1;
        if (gateCalls === 1) {
          return { status: 1, stdout: 'score 0 / 100\nblockers failed: lg-shipped\n', stderr: '' };
        }
        return { status: 0, stdout: 'score 91 / 100\nblockers failed: \n', stderr: '' };
      }
      const proc = spawnSync(cmd, args, {
        cwd: opts.cwd,
        encoding: 'utf8',
        timeout: opts.timeout ?? 60_000,
        shell: process.platform === 'win32'
      });
      return {
        status: proc.status,
        stdout: String(proc.stdout ?? ''),
        stderr: String(proc.stderr ?? '')
      };
    };

    const slug = uniqueSlug(`gate-${app}-nodiff-deploy`);
    const receiptPath = await overnight.processItem(
      { id: slug, kind: 'close-gate-failures', app, summary: 'nodiff' },
      {
        lokiAvailable: false,
        allowDeploy: true,
        dryRun: false,
        repoRoot: repo,
        run: runCmd,
        dispatchFix: () => ({ agent: 'test-agent', status: 0, ok: true, costUsd: 0, output: 'no edits' })
      }
    );
    const rec = JSON.parse(readFileSync(receiptPath, 'utf8'));
    assert.equal(rec.facts.diffChanged, false);
    assert.equal(rec.facts.deployed, false);
    assert.equal(wranglerCalled, false);
    cleanupRepo(repo, slug);
  });

  test('after a successful merge, allowDeploy true actually attempts a deploy', async () => {
    const repo = makeGitRepo();
    const app = 'dashboard';
    mkdirSync(join(repo, app, 'src'), { recursive: true });
    mkdirSync(join(repo, app, 'dist', 'assets'), { recursive: true });
    mkdirSync(join(repo, app, '.redanvil'), { recursive: true });
    writeFileSync(join(repo, app, 'src', 'index.js'), 'export const n = 1;\n');
    writeFileSync(
      join(repo, app, 'wrangler.toml'),
      'name = "redanvil-dashboard"\npages_build_output_dir = "dist"\n'
    );
    writeFileSync(join(repo, app, 'dist', 'index.html'), '<script src="/assets/index-LOCALHASH.js"></script>\n');
    writeFileSync(join(repo, app, 'dist', 'assets', 'index-LOCALHASH.js'), 'x\n');
    writeFileSync(
      join(repo, app, '.redanvil', 'claims.json'),
      JSON.stringify({ deployUrl: 'https://redanvil-dashboard.pages.dev' })
    );
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-qm', 'setup']);

    let wranglerCalled = false;
    let gateCalls = 0;
    const runCmd = (cmd, args, opts = {}) => {
      if (cmd === 'npx' && args.includes('wrangler')) {
        wranglerCalled = true;
        return { status: 0, stdout: 'Compiled. Success', stderr: '' };
      }
      if (cmd === 'npx' && args[0] === 'vitest') return { status: 0, stdout: 'passed', stderr: '' };
      if (cmd === 'npm' && args[0] === 'run' && args[1] === 'build') {
        return { status: 0, stdout: 'built', stderr: '' };
      }
      if (cmd === 'npm' && args[0] === 'run' && args[1] === 'gate') {
        gateCalls += 1;
        if (gateCalls === 1) {
          return { status: 1, stdout: 'score 0 / 100\nblockers failed: lg-shipped\n', stderr: '' };
        }
        return { status: 0, stdout: 'score 91 / 100\nblockers failed: \n', stderr: '' };
      }
      const proc = spawnSync(cmd, args, {
        cwd: opts.cwd,
        encoding: 'utf8',
        timeout: opts.timeout ?? 60_000,
        shell: process.platform === 'win32'
      });
      return {
        status: proc.status,
        stdout: String(proc.stdout ?? ''),
        stderr: String(proc.stderr ?? '')
      };
    };

    const slug = uniqueSlug(`gate-${app}-deploy`);
    const receiptPath = await overnight.processItem(
      { id: slug, kind: 'close-gate-failures', app, summary: 'deploy' },
      {
        lokiAvailable: false,
        allowDeploy: true,
        dryRun: false,
        repoRoot: repo,
        run: runCmd,
        env: { CLOUDFLARE_API_TOKEN: 'test-token-not-a-secret' },
        pollMs: 0,
        pollAttempts: 1,
        fetchImpl: async (url) => {
          if (String(url).includes('/pages/projects/')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ result: { production_branch: 'main' } }),
              text: async () => ''
            };
          }
          return {
            ok: true,
            status: 200,
            text: async () => '<script src="/assets/index-LOCALHASH.js"></script>',
            json: async () => ({})
          };
        },
        dispatchFix: (_a, _b, cwd) => {
          writeFileSync(join(cwd, app, 'src', 'index.js'), 'export const n = 2;\n');
          return { agent: 'test-agent', status: 0, ok: true, costUsd: 0, output: 'changed n' };
        }
      }
    );
    const rec = JSON.parse(readFileSync(receiptPath, 'utf8'));
    assert.equal(rec.facts.diffChanged, true);
    assert.equal(wranglerCalled, true, 'allowDeploy after merge must invoke wrangler');
    assert.equal(rec.facts.deployed, true);
    assert.equal(rec.facts.deployHashMatches, true);
    cleanupRepo(repo, slug);
  });
});

describe('7. parseArgs already accepts --until and --allow-deploy', () => {
  test('--until HH:MM is a string value', () => {
    const args = overnight.parseArgs(['--until', '06:00', '--allow-deploy']);
    assert.equal(args.until, '06:00');
    assert.equal(args['allow-deploy'], true);
  });
});
