/**
 * Known-answer fixtures for `lg-shipped`.
 *
 * This check exists because apps cleared 90+ and then sat on a local disk with
 * no remote and no URL — "done" meant "the gate passed". A check that answers
 * pass for every input carries no information. These cases bind the script to
 * answers that must FAIL (or return n/a), so a vacuous pass cannot land again.
 *
 * Pattern mirrors desktopWidth.test.ts / procConventionalCommits.test.ts:
 * real temp git repos, a real local HTTP server for the hash comparison, and
 * the real CLI script — never a mocked helper that cannot fail.
 */
import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync
} from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { loadRubric } from '../src/rubric/index';
import { APP_CHECKS } from '../src/commands/gate';
import { requireGateResultMeetsBar } from '../scripts/checks/lg-shipped.mjs';

const CHECK_SCRIPT = fileURLToPath(
  new URL('../scripts/checks/lg-shipped.mjs', import.meta.url)
);
const node = process.execPath;

/** Temp dirs created this file; cleaned in afterEach. */
const tempDirs: string[] = [];

/**
 * Create a unique temp app directory and track it for cleanup.
 * @returns Absolute path to the empty app root.
 */
function makeAppDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'redanvil-lg-shipped-'));
  tempDirs.push(dir);
  return dir;
}

/**
 * Run a git command in `cwd`. Throws if git exits non-zero.
 * @param cwd Working directory.
 * @param args Git argv after `git`.
 * @returns Trimmed stdout.
 */
function git(cwd: string, args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  }
  return (r.stdout ?? '').trim();
}

/**
 * Initialise a git repo on branch main with a local identity for commits.
 * @param app Repo root.
 */
function initRepo(app: string): void {
  git(app, ['init', '-q']);
  git(app, ['config', 'user.email', 't@t']);
  git(app, ['config', 'user.name', 't']);
  git(app, ['checkout', '-q', '-b', 'main']);
}

/**
 * Write a file, stage it, and commit with the given subject.
 * @param app Repo root.
 * @param relPath Path relative to app root.
 * @param body File contents.
 * @param subject Commit subject line.
 */
function commitFile(app: string, relPath: string, body: string, subject: string): void {
  const full = join(app, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, 'utf8');
  git(app, ['add', relPath]);
  git(app, ['commit', '-qm', subject]);
}

/**
 * Point origin at a GitHub URL and mark the current HEAD as origin/main so the
 * push check treats this commit as already pushed (no network required).
 * @param app Repo root.
 */
function markHeadPushedToGitHub(app: string): void {
  const sha = git(app, ['rev-parse', 'HEAD']);
  // Add origin even if a prior test helper left one — reset cleanly.
  const existing = spawnSync('git', ['remote'], { cwd: app, encoding: 'utf8' });
  if ((existing.stdout ?? '').split(/\s+/).includes('origin')) {
    git(app, ['remote', 'remove', 'origin']);
  }
  git(app, ['remote', 'add', 'origin', 'https://github.com/example/example.git']);
  git(app, ['update-ref', 'refs/remotes/origin/main', sha]);
}

/**
 * Write a minimal wrangler.toml so the app is treated as deployable.
 * @param app App root.
 * @param name Pages project name.
 */
function writeWrangler(app: string, name = 'example-app'): void {
  writeFileSync(join(app, 'wrangler.toml'), `name = "${name}"\npages_build_output_dir = "dist"\n`);
}

/**
 * Write a local dist entry so the hash comparison has something to read.
 * @param app App root.
 * @param assetName Basename under dist/assets/.
 */
function writeLocalDist(app: string, assetName: string): void {
  const dir = join(app, 'dist', 'assets');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, assetName), `/* ${assetName} */\n`);
}

/**
 * Write claims.json with an optional deployUrl.
 * @param app App root.
 * @param deployUrl Production URL, or omit.
 */
function writeClaims(app: string, deployUrl?: string): void {
  mkdirSync(join(app, '.redanvil'), { recursive: true });
  const body: Record<string, unknown> = {
    kind: 'claims',
    slug: 'example',
    features: []
  };
  if (deployUrl !== undefined) body.deployUrl = deployUrl;
  writeFileSync(join(app, '.redanvil', 'claims.json'), JSON.stringify(body));
}

/**
 * Run lg-shipped.mjs against an app directory (sync — no local server needed).
 * @param appDir App directory.
 * @returns Exit status and combined output.
 */
function runCheckSync(appDir: string): { status: number; output: string } {
  const r = spawnSync(node, [CHECK_SCRIPT, appDir], {
    encoding: 'utf8',
    env: process.env
  });
  return {
    status: r.status ?? -1,
    output: `${r.stdout ?? ''}${r.stderr ?? ''}`
  };
}

/**
 * Run lg-shipped.mjs asynchronously so a same-process fixture server can answer.
 * @param appDir App directory.
 * @returns Exit status and combined output.
 */
function runCheckAsync(appDir: string): Promise<{ status: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(node, [CHECK_SCRIPT, appDir], { env: process.env });
    let out = '';
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      out += d.toString();
    });
    child.on('close', (code) => resolve({ status: code ?? 1, output: out }));
  });
}

/**
 * Serve fixed HTML on a random localhost port.
 * @param html Body returned for every request.
 * @returns Base URL and close handle.
 */
function serveHtml(html: string): Promise<{ base: string; close: () => void }> {
  return new Promise((resolve) => {
    const server: Server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ base: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) break;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
});

describe('lg-shipped registration', () => {
  it('is encoded as a pure-det blocker on the loop-gate lane', () => {
    const rule = loadRubric().find((r) => r.id === 'lg-shipped');
    expect(rule).toBeDefined();
    expect(rule!.lane).toBe('loop-gate');
    expect(rule!.severity).toBe('blocker');
    expect(rule!.method).toBe('det');
  });

  it('is wired into APP_CHECKS so the gate actually runs it', () => {
    expect(APP_CHECKS.map((c) => c.ruleId)).toContain('lg-shipped');
  });

  it('ships a real check script on disk', () => {
    expect(existsSync(CHECK_SCRIPT)).toBe(true);
  });
});

describe('lg-shipped known-answer failures', () => {
  it('returns n/a (3) when there is no wrangler.toml and no deployUrl', () => {
    // Narrow n/a: only when the app is not a deployable site at all.
    const app = makeAppDir();
    writeFileSync(join(app, 'README.md'), 'not a site\n');
    const { status, output } = runCheckSync(app);
    expect(status, output).toBe(3);
    expect(output).toMatch(/n\/a/i);
  });

  it('FAILS a deployable app with no origin remote (not n/a)', () => {
    // wrangler present + no remote must be FAIL. Returning n/a here would
    // re-open the hole this rule exists to close.
    const app = makeAppDir();
    initRepo(app);
    commitFile(app, 'wrangler.toml', 'name = "example-app"\n', 'chore: init');
    // No origin remote at all.
    const { status, output } = runCheckSync(app);
    expect(status, output).toBe(1);
    expect(output).toMatch(/origin/i);
  });

  it('FAILS when HEAD has unpushed commits', () => {
    const app = makeAppDir();
    initRepo(app);
    writeWrangler(app);
    commitFile(app, 'wrangler.toml', 'name = "example-app"\n', 'chore: init');
    markHeadPushedToGitHub(app);
    // Second commit after origin/main was frozen → unpushed.
    commitFile(app, 'extra.txt', 'local only\n', 'chore: unpushed work');

    const { status, output } = runCheckSync(app);
    expect(status, output).toBe(1);
    expect(output).toMatch(/unpushed/i);
  });

  it('FAILS when the served bundle hash differs from local dist', async () => {
    // The exact shape that makes a wrangler "success" look like a ship: local
    // dist has one hash, production HTML points at another. Matching is proof;
    // anything else is a fail.
    const app = makeAppDir();
    initRepo(app);
    writeWrangler(app);
    writeLocalDist(app, 'index-LOCALHASH.js');
    commitFile(app, 'wrangler.toml', 'name = "example-app"\n', 'chore: init');
    commitFile(
      app,
      'dist/assets/index-LOCALHASH.js',
      '/* local */\n',
      'chore: build local'
    );
    markHeadPushedToGitHub(app);

    const server = await serveHtml(
      '<!doctype html><html><head>' +
        '<script type="module" src="/assets/index-REMOTEHASH.js"></script>' +
        '</head><body></body></html>'
    );
    servers.push(server);
    writeClaims(app, server.base + '/');

    const { status, output } = await runCheckAsync(app);
    expect(status, output).toBe(1);
    expect(output).toMatch(/does not match|REMOTEHASH|LOCALHASH/i);
  }, 60_000);

  it('FAILS when repo+push+URL+hash hold but the gate result is missing', async () => {
    // The hole this step closes: an app looked "shipped" on deploy proof alone
    // while it was never measured. Shipping an unmeasured app must FAIL.
    const app = makeAppDir();
    initRepo(app);
    writeWrangler(app);
    writeLocalDist(app, 'index-SHIPPED.js');
    commitFile(app, 'wrangler.toml', 'name = "example-app"\n', 'chore: init');
    commitFile(app, 'dist/assets/index-SHIPPED.js', '/* shipped */\n', 'chore: build');
    markHeadPushedToGitHub(app);

    const server = await serveHtml(
      '<!doctype html><html><head>' +
        '<script type="module" src="/assets/index-SHIPPED.js"></script>' +
        '</head><body></body></html>'
    );
    servers.push(server);
    writeClaims(app, server.base + '/');
    // No results/<slug>.json anywhere.

    const { status, output } = await runCheckAsync(app);
    expect(status, output).toBe(1);
    expect(output).toMatch(/unmeasured|no gate result|finish line|reverify/i);
  }, 60_000);

  it('FAILS when the gate result records finalScore below threshold', async () => {
    const app = makeAppDir();
    initRepo(app);
    writeWrangler(app);
    writeLocalDist(app, 'index-SHIPPED.js');
    commitFile(app, 'wrangler.toml', 'name = "example-app"\n', 'chore: init');
    commitFile(app, 'dist/assets/index-SHIPPED.js', '/* shipped */\n', 'chore: build');
    markHeadPushedToGitHub(app);

    const server = await serveHtml(
      '<!doctype html><html><head>' +
        '<script type="module" src="/assets/index-SHIPPED.js"></script>' +
        '</head><body></body></html>'
    );
    servers.push(server);
    writeClaims(app, server.base + '/');

    // Results next to the app root (standalone-app layout).
    const slug = app.split(/[/\\]/).pop() ?? 'example';
    mkdirSync(join(app, 'results'), { recursive: true });
    writeFileSync(
      join(app, 'results', `${slug}.json`),
      JSON.stringify({
        kind: 'results',
        slug,
        finalScore: 89,
        threshold: 90,
        passed: false,
        evaluated: 1,
        total: 1,
        rules: [{ ruleId: 'u-typing-strict', passed: true }],
        iterations: [{ index: 1, score: 89, blockers: [] }],
        deployUrl: null,
        finishedAt: '2026-08-01T00:00:00.000Z',
        provenance: {
          commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          dirty: false,
          rubricHash: '0'.repeat(64),
          rubricRuleCount: 68,
          node: 'v22.0.0',
          verdictsHash: null,
          notApplicable: [],
          generatedAt: '2026-08-01T00:00:00.000Z'
        }
      }),
      'utf8'
    );

    const { status, output } = await runCheckAsync(app);
    expect(status, output).toBe(1);
    expect(output).toMatch(/89|finish line|below|threshold|reverify/i);
  }, 60_000);

  it('FAILS origin that is not a GitHub URL', () => {
    const app = makeAppDir();
    initRepo(app);
    writeWrangler(app);
    commitFile(app, 'wrangler.toml', 'name = "example-app"\n', 'chore: init');
    const sha = git(app, ['rev-parse', 'HEAD']);
    git(app, ['remote', 'add', 'origin', 'https://gitlab.com/example/example.git']);
    git(app, ['update-ref', 'refs/remotes/origin/main', sha]);

    const { status, output } = runCheckSync(app);
    expect(status, output).toBe(1);
    expect(output).toMatch(/GitHub/i);
  });
});

describe('lg-shipped condition 5 does not pin itself on its own prior failure', () => {
  /**
   * Capture whether requireGateResultMeetsBar calls io.fail.
   * @returns Fail-capture io and the reasons object.
   */
  function captureFailIo(): { io: { fail: (m?: string) => void }; failed: { msg: string | null } } {
    const failed: { msg: string | null } = { msg: null };
    return { io: { fail: (m) => { failed.msg = m ?? ''; } }, failed };
  }

  it('does NOT pin forever when the stored result records lg-shipped: false from a prior run', () => {
    // Root cause: a run where lg-shipped itself failed (e.g. an earlier
    // unpushed-commit run) writes `lg-shipped: false` into results/<slug>.json.
    // The next run's condition 5 used to read that same file, see its own past
    // failure in the rules list, and fail again citing it -- pinned forever,
    // since the only way to clear it required lg-shipped to have already passed.
    const app = makeAppDir();
    const slug = app.split(/[/\\]/).pop() ?? 'example';
    mkdirSync(join(app, 'results'), { recursive: true });
    const rules = loadRubric()
      .filter((r) => r.id !== 'lg-shipped')
      .map((r) => ({ ruleId: r.id, passed: true }));
    rules.push({ ruleId: 'lg-shipped', passed: false });
    writeFileSync(
      join(app, 'results', `${slug}.json`),
      JSON.stringify({
        kind: 'results',
        slug,
        finalScore: 100,
        threshold: 90,
        rules,
        provenance: { commit: 'a'.repeat(40), notApplicable: [] }
      }),
      'utf8'
    );

    const { io, failed } = captureFailIo();
    requireGateResultMeetsBar(app, io);
    expect(failed.msg, failed.msg ?? '').toBeNull();
  });

  it('still FAILS when a DIFFERENT rule is recorded as failing (known-bad: not blanket-exempt)', () => {
    const app = makeAppDir();
    const slug = app.split(/[/\\]/).pop() ?? 'example';
    mkdirSync(join(app, 'results'), { recursive: true });
    const rules = loadRubric()
      .filter((r) => r.id !== 'lg-shipped')
      .map((r, i) => ({ ruleId: r.id, passed: i !== 0 })); // fail exactly one real rule
    rules.push({ ruleId: 'lg-shipped', passed: false });
    writeFileSync(
      join(app, 'results', `${slug}.json`),
      JSON.stringify({
        kind: 'results',
        slug,
        // finalScore stays at 100 (as if only pass/fail counted, not weighted)
        // so the failure asserted below is isolated to the failing-rules half
        // of scoreBarReasons, not the threshold half.
        finalScore: 100,
        threshold: 90,
        rules,
        provenance: { commit: 'a'.repeat(40), notApplicable: [] }
      }),
      'utf8'
    );

    const { io, failed } = captureFailIo();
    requireGateResultMeetsBar(app, io);
    expect(failed.msg).not.toBeNull();
    console.log('lg-shipped condition 5 known-bad (other rule still failing):', failed.msg);
  });
});

/** Fixture servers that must close when the file ends. */
const servers: { base: string; close: () => void }[] = [];

afterAll(() => {
  for (const s of servers) {
    try {
      s.close();
    } catch {
      // ignore
    }
  }
});


