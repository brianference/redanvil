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
  readdirSync,
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

/**
 * Capture stdout while still letting the test runner print.
 * @param {() => Promise<T>} fn
 * @returns {Promise<{result: T, stdout: string}>}
 * @template T
 */
async function withStdout(fn) {
  /** @type {string[]} */
  const chunks = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, encoding, callback) => {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    return original(chunk, encoding, callback);
  };
  try {
    const result = await fn();
    return { result, stdout: chunks.join('') };
  } finally {
    process.stdout.write = original;
  }
}

/**
 * @param {string} repo
 * @param {{completed: string[], spentUsd: number, startedAt: string|null}} state
 */
function writeCheckpointFile(repo, state) {
  const dir = join(repo, '.redanvil', 'overnight');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'checkpoint.json'), `${JSON.stringify(state, null, 2)}\n`);
}

/**
 * Temp repo with an empty results feed. Caller deletes it.
 * @param {string} label
 * @returns {string}
 */
function makeOvernightRepo(label) {
  const repo = mkdtempSync(join(tmpdir(), label));
  mkdirSync(join(repo, 'results'), { recursive: true });
  writeFileSync(join(repo, 'results', 'all.json'), '[]\n');
  return repo;
}

describe('8. checkpoint night rollover', () => {
  test('FAIL INPUT: a 2026-08-21 start is not the night whose deadline is 2026-09-23', () => {
    const started = new Date(2026, 7, 21, 23, 30, 0, 0).toISOString();
    const deadline = new Date(2026, 8, 23, 6, 0, 0, 0).getTime();
    assert.equal(overnight.checkpointIsCurrentNight(started, deadline, '06:00'), false);
  });

  test('a 23:30 start resumed at 02:00 is the same night when the checkpoint stored that 06:00 key', () => {
    const started = new Date(2026, 8, 22, 23, 30, 0, 0).toISOString();
    const deadline = new Date(2026, 8, 23, 6, 0, 0, 0).getTime();
    assert.equal(overnight.nightKeyForDeadline(deadline), '2026-09-23T06:00:00');
    assert.equal(
      overnight.checkpointIsCurrentNight(
        { startedAt: started, nightKey: '2026-09-23T06:00:00', deadlineAt: deadline },
        deadline
      ),
      true
    );
  });

  test('FAIL INPUT: a checkpoint with no stored night key is a previous night', () => {
    const started = new Date(2026, 8, 22, 23, 30, 0, 0).toISOString();
    const deadline = new Date(2026, 8, 23, 6, 0, 0, 0).getTime();
    // The old function returned true for this pair. A legacy checkpoint
    // does not carry the night it actually ran, so it is not resumed.
    assert.equal(overnight.checkpointIsCurrentNight(started, deadline), false);
    assert.equal(overnight.checkpointIsCurrentNight({ startedAt: started }, deadline), false);
  });

  test('FAIL INPUT: 21 Sep 23:30 against --until 18:00 is not the current night', () => {
    const started = new Date(2026, 8, 21, 23, 30, 0, 0).toISOString();
    const deadline = new Date(2026, 8, 22, 18, 0, 0, 0).getTime();
    assert.equal(overnight.checkpointIsCurrentNight(started, deadline, '18:00'), false);
  });

  test('FAIL INPUT: missing startedAt is not the current night', () => {
    assert.equal(overnight.checkpointIsCurrentNight(null, Date.now()), false);
    assert.equal(overnight.checkpointIsCurrentNight('not-a-date', Date.now()), false);
  });

  test('checkpoint from a previous night is archived and the night starts fresh', async () => {
    const repo = makeOvernightRepo('overnight-prev-');
    const started = new Date(2026, 7, 21, 23, 30, 0, 0);
    writeCheckpointFile(repo, {
      completed: ['item-old'],
      spentUsd: 1.25,
      startedAt: started.toISOString()
    });
    const prevRepo = process.env.REDANVIL_REPO;
    try {
      const { result, stdout } = await withStdout(() =>
        overnight.runOvernight({
          args: { 'dry-run': true },
          repoRoot: repo,
          // Far enough ahead that the item is started. The checkpoint's own
          // night is 2026-08-22 (06:00 after a 23:30 start), so this is not
          // that night. A deadline of 06:00 on the day the test runs is
          // already in the past by afternoon and would skip the item.
          deadlineAt: Date.now() + 60_000,
          queue: [{ id: 'item-old', kind: 'fix-known-bug', summary: 'previous night item' }],
          loki: { available: false, version: null }
        })
      );
      assert.equal(result.receipts.length, 1, stdout);
      assert.equal(result.exitCode, 1, stdout);
      assert.match(stdout, /archived previous-night checkpoint/);
      assert.doesNotMatch(stdout, /resuming:/);
      assert.match(stdout, /previous night item/);
      const stateDir = join(repo, '.redanvil', 'overnight');
      const archives = readdirSync(stateDir).filter((name) => name.startsWith('checkpoint-'));
      assert.equal(archives.length, 1, archives.join(','));
      assert.match(archives[0], /^checkpoint-\d{8}-\d{6}(?:-\d+)?\.json$/);
      const archived = JSON.parse(readFileSync(join(stateDir, archives[0]), 'utf8'));
      assert.deepEqual(archived.completed, ['item-old']);
      assert.equal(archived.startedAt, started.toISOString());
      const live = JSON.parse(readFileSync(join(stateDir, 'checkpoint.json'), 'utf8'));
      assert.deepEqual(live.completed, ['item-old']);
      assert.notEqual(live.startedAt, started.toISOString());
      assert.equal(live.nightKey, overnight.nightKeyForDeadline(result.deadlineAt));
      assert.equal(live.deadlineAt, result.deadlineAt);
      const alert = JSON.parse(readFileSync(join(stateDir, 'ALERT.json'), 'utf8'));
      assert.deepEqual(alert.items, [{ id: 'item-old', status: 'UNVERIFIED' }]);
    } finally {
      process.env.REDANVIL_REPO = prevRepo;
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('checkpoint from the same night is resumed, not archived', async () => {
    const repo = makeOvernightRepo('overnight-same-');
    const started = new Date(2026, 8, 22, 23, 30, 0, 0);
    const sameNightDeadline = new Date(
      started.getFullYear(),
      started.getMonth(),
      started.getDate() + 1,
      6,
      0,
      0,
      0
    ).getTime();
    writeCheckpointFile(repo, {
      completed: ['item-same'],
      spentUsd: 0.5,
      startedAt: started.toISOString(),
      deadlineAt: sameNightDeadline,
      nightKey: '2026-09-23T06:00:00'
    });
    const prevRepo = process.env.REDANVIL_REPO;
    try {
      const { result, stdout } = await withStdout(() =>
        overnight.runOvernight({
          args: { 'dry-run': true },
          repoRoot: repo,
          // Same deadline the checkpoint stored: 06:00 the next morning.
          deadlineAt: sameNightDeadline,
          nowFn: () => started.getTime() + 2 * 60 * 60 * 1000,
          queue: [{ id: 'item-same', kind: 'fix-known-bug', summary: 'same night item' }],
          loki: { available: false, version: null }
        })
      );
      assert.equal(result.receipts.length, 0, stdout);
      assert.equal(result.exitCode, 0, stdout);
      assert.match(stdout, /resuming: 1 item/);
      assert.match(stdout, /already done, skipping/);
      assert.doesNotMatch(stdout, /same night item/);
      assert.doesNotMatch(stdout, /archived previous-night/);
      const stateDir = join(repo, '.redanvil', 'overnight');
      const archives = readdirSync(stateDir).filter((name) => name.startsWith('checkpoint-'));
      assert.equal(archives.length, 0);
      const live = JSON.parse(readFileSync(join(stateDir, 'checkpoint.json'), 'utf8'));
      assert.equal(live.startedAt, started.toISOString());
      assert.deepEqual(live.completed, ['item-same']);
      assert.equal(existsSync(join(stateDir, 'ALERT.json')), false);
    } finally {
      process.env.REDANVIL_REPO = prevRepo;
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('FAIL INPUT: a legacy checkpoint is archived when --until 18:00 recomputes the same date', () => {
    const repo = makeOvernightRepo('overnight-until18-');
    writeCheckpointFile(repo, {
      completed: ['item-old'],
      spentUsd: 0,
      startedAt: new Date(2026, 8, 21, 23, 30, 0, 0).toISOString()
    });
    const prevRepo = process.env.REDANVIL_REPO;
    process.env.REDANVIL_REPO = repo;
    try {
      const rolled = overnight.rolloverCheckpoint({
        deadlineAt: new Date(2026, 8, 22, 18, 0, 0, 0).getTime(),
        untilFlag: '18:00',
        now: new Date(2026, 8, 22, 12, 0, 0, 0)
      });
      assert.notEqual(rolled.archived, null);
      assert.deepEqual(rolled.checkpoint.completed, []);
    } finally {
      process.env.REDANVIL_REPO = prevRepo;
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('FAIL INPUT: a stored 06:00 night is not an 18:00 run on the same date', () => {
    const repo = makeOvernightRepo('overnight-key-18-');
    writeCheckpointFile(repo, {
      completed: ['item-old'],
      spentUsd: 0,
      startedAt: new Date(2026, 8, 21, 23, 30, 0, 0).toISOString(),
      deadlineAt: new Date(2026, 8, 22, 6, 0, 0, 0).getTime(),
      nightKey: '2026-09-22T06:00:00'
    });
    const prevRepo = process.env.REDANVIL_REPO;
    process.env.REDANVIL_REPO = repo;
    try {
      const rolled = overnight.rolloverCheckpoint({
        deadlineAt: new Date(2026, 8, 22, 18, 0, 0, 0).getTime(),
        untilFlag: '18:00',
        now: new Date(2026, 8, 22, 12, 0, 0, 0)
      });
      assert.notEqual(rolled.archived, null);
      assert.deepEqual(rolled.checkpoint.completed, []);
    } finally {
      process.env.REDANVIL_REPO = prevRepo;
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('FAIL INPUT: the same OVERNIGHT_DEADLINE_ISO resumes instead of repeating the night', async () => {
    const repo = makeOvernightRepo('overnight-iso-same-');
    const deadline = new Date(2026, 8, 21, 23, 50, 0, 0).getTime();
    const prevRepo = process.env.REDANVIL_REPO;
    try {
      const first = await overnight.runOvernight({
        args: { 'dry-run': true },
        repoRoot: repo,
        deadlineAt: deadline,
        nowFn: () => new Date(2026, 8, 21, 23, 30, 0, 0).getTime(),
        queue: [{ id: 'item-iso', kind: 'fix-known-bug', summary: 'iso item' }],
        loki: { available: false, version: null }
      });
      assert.equal(first.receipts.length, 1);
      const live = JSON.parse(
        readFileSync(join(repo, '.redanvil', 'overnight', 'checkpoint.json'), 'utf8')
      );
      assert.equal(live.nightKey, '2026-09-21T23:50:00');
      assert.equal(live.deadlineAt, deadline);
      const { result, stdout } = await withStdout(() =>
        overnight.runOvernight({
          args: { 'dry-run': true },
          repoRoot: repo,
          deadlineAt: deadline,
          nowFn: () => new Date(2026, 8, 21, 23, 40, 0, 0).getTime(),
          queue: [{ id: 'item-iso', kind: 'fix-known-bug', summary: 'iso item' }],
          loki: { available: false, version: null }
        })
      );
      assert.match(stdout, /resuming:/);
      assert.doesNotMatch(stdout, /archived previous-night/);
      assert.equal(result.receipts.length, 0, stdout);
    } finally {
      process.env.REDANVIL_REPO = prevRepo;
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe('9. prompt delivery on win32', () => {
  const PROMPT = 'alpha beta\nline "two" & three %PERCENT%\n';

  /**
   * Child that echoes the prompt file or stdin, and fails if the prompt
   * text itself was placed on argv (cmd.exe would already have eaten it).
   * @param {string} path
   */
  function writeEchoAgent(path) {
    writeFileSync(
      path,
      [
        "import { readFileSync } from 'node:fs';",
        'const argv = process.argv.slice(2);',
        "if (argv.some((arg) => arg.includes('%PERCENT%') || arg.includes('line \"two\"'))) {",
        "  process.stderr.write('LEAK');",
        '  process.exit(2);',
        '}',
        "const fileFlag = argv.indexOf('--prompt-file');",
        'if (fileFlag >= 0) process.stdout.write(readFileSync(argv[fileFlag + 1]));',
        'else process.stdout.write(readFileSync(0));',
        ''
      ].join('\n')
    );
  }

  // cmd.exe quoting only exists on Windows; elsewhere there is nothing to prove.
  test('spaces, newlines, quotes, & and % reach the child byte-identical', {
    skip: process.platform !== 'win32' && 'cmd.exe argument quoting only exists on Windows'
  }, () => {
    const parent = mkdtempSync(join(tmpdir(), 'overnight-prompt-'));
    const cwd = join(parent, 'space & pct');
    mkdirSync(cwd);
    const script = join(parent, 'echo-agent.mjs');
    writeEchoAgent(script);
    try {
      for (const agent of overnight.AGENTS) {
        const plan = overnight.prepareAgentLaunch(agent, PROMPT, cwd);
        assert.ok(
          plan.args.every((arg) => !arg.includes('%PERCENT%') && !arg.includes('\n') && !arg.includes('line "two"')),
          `${agent.name} put the prompt on argv: ${JSON.stringify(plan.args)}`
        );
        if (agent.promptVia === 'file') {
          assert.equal(readFileSync(plan.promptFile, 'utf8'), PROMPT);
          assert.equal(plan.input, null);
        } else {
          assert.equal(plan.input, PROMPT);
        }
        const res = overnight.spawnAgent(agent, PROMPT, cwd, {
          bin: process.execPath,
          argsPrefix: [script],
          timeout: 15_000
        });
        assert.equal(res.status, 0, `${agent.name} stderr=${res.stderr}`);
        assert.equal(res.stdout, PROMPT, `${agent.name} delivered ${JSON.stringify(res.stdout)}`);
      }
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe('10. executor: claude only', () => {
  test('the only agent is claude; grok is not an executor (owner rule 2026-09-24)', () => {
    assert.deepEqual(
      overnight.AGENTS.map((agent) => agent.name),
      ['claude']
    );
    assert.equal(overnight.AGENTS.some((agent) => agent.bin === 'grok'), false);
    assert.equal('grokCannotRun' in overnight, false);
  });

  test('the cost cap defaults to $25', () => {
    assert.equal(overnight.COST_CAP_USD, 25);
  });

  /**
   * @param {(cmd: string, args: string[], opts: object) => {status: number|null, stdout: string, stderr: string, error?: object|null}} run
   * @param {{budgetUsd?: number}} [extra]
   */
  function dispatchWith(run, extra = {}) {
    const cwd = mkdtempSync(join(tmpdir(), 'overnight-order-'));
    try {
      return overnight.dispatchFix('demo', ['lg-shipped'], cwd, {
        run,
        deadlineAt: Date.now() + 120_000,
        itemTimeoutMs: 5_000,
        ...extra
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }

  test('claude runs with the prompt on stdin, shell false, and reports its cost', () => {
    /** @type {string[]} */
    const seen = [];
    /** @type {string[]} */
    let claudeArgs = [];
    const result = dispatchWith((cmd, args, opts) => {
      seen.push(cmd);
      if (cmd === 'where' || cmd === 'which') return { status: 0, stdout: cmd, stderr: '' };
      if (cmd === 'claude') {
        claudeArgs = args;
        assert.equal(opts.shell, false);
        assert.match(String(opts.input), /RedAnvil gate rules/);
        assert.ok(!args.some((arg) => arg.includes('\n') || arg.includes('RedAnvil gate rules')));
        return {
          status: 0,
          stdout: '{"is_error":false,"subtype":"success","total_cost_usd":1.5}',
          stderr: ''
        };
      }
      return { status: 1, stdout: '', stderr: `unexpected ${cmd}` };
    });
    assert.deepEqual(seen.filter((cmd) => cmd !== 'where' && cmd !== 'which'), ['claude']);
    assert.equal(claudeArgs[claudeArgs.indexOf('--permission-mode') + 1], 'auto');
    assert.equal(result.agent, 'claude');
    assert.equal(result.ok, true);
    assert.equal(result.costUsd, 1.5);
  });

  test('FAIL INPUT: claude failing, hanging, or erroring never invokes grok', () => {
    const failures = [
      { status: 1, stdout: '', stderr: 'edit failed', error: null },
      { status: 1, stdout: '', stderr: 'HTTP 403 Forbidden spending limit', error: null },
      { status: null, stdout: '', stderr: '', error: { code: 'ETIMEDOUT', message: 'spawnSync ETIMEDOUT' } },
      { status: 0, stdout: '{"is_error":true,"subtype":"error_during_execution","total_cost_usd":0.2}', stderr: '' }
    ];
    for (const failure of failures) {
      /** @type {string[]} */
      const seen = [];
      const result = dispatchWith((cmd) => {
        seen.push(cmd);
        if (cmd === 'where' || cmd === 'which') return { status: 0, stdout: cmd, stderr: '' };
        if (cmd === 'claude') return failure;
        return { status: 0, stdout: '', stderr: '' };
      });
      const label = JSON.stringify(failure);
      assert.equal(seen.includes('grok'), false, label);
      assert.deepEqual(seen.filter((cmd) => cmd !== 'where' && cmd !== 'which'), ['claude'], label);
      assert.equal(result.agent, 'claude', label);
      assert.equal(result.ok, false, label);
    }
  });

  test('FAIL INPUT: claude not on PATH fails the item and never probes or runs grok', () => {
    /** @type {Array<{cmd: string, args: string[]}>} */
    const seen = [];
    const result = dispatchWith((cmd, args) => {
      seen.push({ cmd, args });
      if (cmd === 'where' || cmd === 'which') return { status: 1, stdout: '', stderr: 'not found' };
      return { status: 0, stdout: '', stderr: '' };
    });
    assert.equal(result.agent, null);
    assert.equal(result.ok, false);
    assert.equal(seen.some((call) => call.cmd === 'grok' || call.args.includes('grok')), false);
  });

  test('the remaining night budget becomes --max-budget-usd, and an exhausted budget does not spawn', () => {
    /** @type {string[]} */
    let claudeArgs = [];
    dispatchWith(
      (cmd, args) => {
        if (cmd === 'where' || cmd === 'which') return { status: 0, stdout: cmd, stderr: '' };
        claudeArgs = args;
        return { status: 0, stdout: '{"is_error":false,"total_cost_usd":0.4}', stderr: '' };
      },
      { budgetUsd: 3.2 }
    );
    assert.equal(claudeArgs[claudeArgs.indexOf('--max-budget-usd') + 1], '3.20');

    /** @type {string[]} */
    const seen = [];
    const spent = dispatchWith(
      (cmd) => {
        seen.push(cmd);
        if (cmd === 'where' || cmd === 'which') return { status: 0, stdout: cmd, stderr: '' };
        return { status: 0, stdout: '{"is_error":false,"total_cost_usd":0}', stderr: '' };
      },
      { budgetUsd: 0 }
    );
    assert.equal(seen.includes('claude'), false);
    assert.equal(spent.ok, false);
    assert.match(spent.output, /cost cap/);
  });

  test('FAIL INPUT: the $25 cap stops the night once recorded claude spend reaches it', async () => {
    const repo = makeOvernightRepo('overnight-cap-');
    const started = new Date(2026, 8, 22, 23, 30, 0, 0);
    const sameNightDeadline = new Date(2026, 8, 23, 6, 0, 0, 0).getTime();
    // Spend already recorded tonight from claude envelopes (total_cost_usd).
    writeCheckpointFile(repo, {
      completed: [],
      spentUsd: overnight.COST_CAP_USD,
      startedAt: started.toISOString(),
      deadlineAt: sameNightDeadline,
      nightKey: '2026-09-23T06:00:00'
    });
    const prevRepo = process.env.REDANVIL_REPO;
    try {
      const { result, stdout } = await withStdout(() =>
        overnight.runOvernight({
          args: { 'dry-run': true },
          repoRoot: repo,
          deadlineAt: sameNightDeadline,
          nowFn: () => started.getTime() + 60 * 60 * 1000,
          queue: [{ id: 'item-capped', kind: 'fix-known-bug', summary: 'capped item' }],
          loki: { available: false, version: null },
          dispatchFix: () => {
            throw new Error('dispatched past the cost cap');
          }
        })
      );
      assert.equal(result.stoppedEarly, true, stdout);
      assert.equal(result.receipts.length, 0, stdout);
      assert.match(stdout, /cost cap \$25 reached; stopping before item-capped/);
      const summary = JSON.parse(readFileSync(result.summaryPath, 'utf8'));
      assert.equal(summary.executor, 'claude');
    } finally {
      process.env.REDANVIL_REPO = prevRepo;
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe('11. zero-receipt alert', () => {
  test('FAIL INPUT: a failed drift run writes ALERT.json listing the UNVERIFIED receipt', async () => {
    const repo = makeOvernightRepo('overnight-alert-');
    const alertFile = join(repo, '.redanvil', 'overnight', 'ALERT.json');
    mkdirSync(join(repo, '.redanvil', 'overnight'), { recursive: true });
    writeFileSync(alertFile, '{"at":"2000-01-01T00:00:00.000Z","reason":"stale","items":[],"receipts":0}\n');
    const prevRepo = process.env.REDANVIL_REPO;
    try {
      const { result, stdout } = await withStdout(() =>
        overnight.runOvernight({
          args: {},
          repoRoot: repo,
          deadlineAt: Date.now() + 60_000,
          queue: [{ id: 'drift-regate', kind: 'drift', summary: 'gate fails' }],
          loki: { available: false, version: null },
          run: () => ({ status: 1, stdout: 'score 10/100', stderr: 'blockers failed: lg-shipped' })
        })
      );
      assert.equal(result.receipts.length, 1);
      assert.equal(result.exitCode, 1);
      assert.match(stdout, /(^|\n)ALERT:/);
      const receipt = JSON.parse(readFileSync(result.receipts[0], 'utf8'));
      assert.equal(receipt.status, 'UNVERIFIED');
      const alert = JSON.parse(readFileSync(alertFile, 'utf8'));
      assert.equal(typeof alert.at, 'string');
      assert.ok(alert.at.length > 0);
      assert.notEqual(alert.at, '2000-01-01T00:00:00.000Z');
      assert.equal(alert.reason, 'night finished with 0 VERIFIED receipts');
      assert.equal(alert.verified, 0);
      assert.deepEqual(alert.items, [{ id: 'drift-regate', status: 'UNVERIFIED' }]);
    } finally {
      process.env.REDANVIL_REPO = prevRepo;
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('FAIL INPUT: an item that throws before a receipt is listed and does not exit 0', async () => {
    const repo = makeOvernightRepo('overnight-alert-throw-');
    const prevRepo = process.env.REDANVIL_REPO;
    try {
      const { result } = await withStdout(() =>
        overnight.runOvernight({
          args: {},
          repoRoot: repo,
          deadlineAt: Date.now() + 60_000,
          queue: [{ id: 'item-z', kind: 'drift', summary: 'throws before a receipt' }],
          loki: { available: false, version: null },
          run: () => {
            throw new Error('no executor');
          }
        })
      );
      assert.equal(result.receipts.length, 0);
      assert.equal(result.exitCode, 1);
      const alert = JSON.parse(
        readFileSync(join(repo, '.redanvil', 'overnight', 'ALERT.json'), 'utf8')
      );
      assert.deepEqual(alert.items, [{ id: 'item-z', status: 'ERROR' }]);
      assert.equal(alert.verified, 0);
    } finally {
      process.env.REDANVIL_REPO = prevRepo;
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('one VERIFIED receipt deletes a stale ALERT.json', () => {
    const repo = makeOvernightRepo('overnight-alert-clear-');
    const alertFile = join(repo, '.redanvil', 'overnight', 'ALERT.json');
    mkdirSync(join(repo, '.redanvil', 'overnight'), { recursive: true });
    writeFileSync(alertFile, '{"at":"2000-01-01T00:00:00.000Z","reason":"stale","items":[],"receipts":0}\n');
    const prevRepo = process.env.REDANVIL_REPO;
    process.env.REDANVIL_REPO = repo;
    try {
      const code = overnight.settleNightAlert({
        outcomes: [
          { id: 'drift-regate', status: 'UNVERIFIED' },
          { id: 'gate-ok', status: 'VERIFIED' }
        ],
        at: '2026-09-23T06:00:00.000Z'
      });
      assert.equal(code, 0);
      assert.equal(existsSync(alertFile), false);
    } finally {
      process.env.REDANVIL_REPO = prevRepo;
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('every item skipped does not alert and exits 0', async () => {
    const repo = makeOvernightRepo('overnight-alert-skip-');
    const prevRepo = process.env.REDANVIL_REPO;
    try {
      const result = await overnight.runOvernight({
        args: { 'dry-run': true },
        repoRoot: repo,
        deadlineAt: Date.parse('2000-01-01T00:00:00.000Z'),
        queue: [{ id: 'item-a', kind: 'fix-known-bug', summary: 'too late' }],
        loki: { available: false, version: null }
      });
      assert.equal(result.receipts.length, 0);
      assert.equal(result.exitCode, 0);
      assert.equal(existsSync(join(repo, '.redanvil', 'overnight', 'ALERT.json')), false);
    } finally {
      process.env.REDANVIL_REPO = prevRepo;
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
