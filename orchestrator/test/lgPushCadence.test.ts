/**
 * Known-bad / known-good fixtures for `lg-push-cadence`.
 *
 * Spec: every outcome must be produced by a real input and the exit code
 * read, not predicted. Temp git repos only — never this repo's own state.
 *
 * Four cases (SPEC-push-cadence.md):
 * 1. Remote-tracking ref + backlog above threshold → exit 1
 * 2. Same shape at or below threshold → exit 0
 * 3. No remote-tracking branch → exit 3 (n/a)
 * 4. REDANVIL_PRE_PUSH=1 + backlog over threshold → exit 0, finding printed
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadRubric } from '../src/rubric/index';
import { APP_CHECKS } from '../src/commands/gate';
import {
  PUSH_CADENCE_THRESHOLD,
  evaluatePushCadence,
  cadenceFailMessage
} from '../scripts/checks/lg-push-cadence.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CHECK_SCRIPT = join(here, '..', 'scripts', 'checks', 'check.mjs');
const DIRECT_SCRIPT = join(here, '..', 'scripts', 'checks', 'lg-push-cadence.mjs');
const node = process.execPath;

/** Temp dirs created this file; cleaned in afterEach. */
const tempDirs: string[] = [];

/**
 * Create a unique temp directory and track it for cleanup.
 * @returns Absolute path.
 */
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'redanvil-lg-push-cadence-'));
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
 * Point origin at a dummy URL, freeze origin/main at the current HEAD, and
 * set the current branch's upstream to origin/main.
 * No network required — the rule measures against @{upstream}, so the
 * tracking config must exist (not merely a refs/remotes/origin/* ref).
 * @param app Repo root.
 */
function markHeadAsOriginMain(app: string): void {
  const sha = git(app, ['rev-parse', 'HEAD']);
  const existing = spawnSync('git', ['remote'], { cwd: app, encoding: 'utf8' });
  if ((existing.stdout ?? '').split(/\s+/).includes('origin')) {
    git(app, ['remote', 'remove', 'origin']);
  }
  git(app, ['remote', 'add', 'origin', 'https://github.com/example/example.git']);
  git(app, ['update-ref', 'refs/remotes/origin/main', sha]);
  git(app, ['branch', '--set-upstream-to=origin/main']);
}

/**
 * Create a repo where the local branch name differs from its upstream
 * (feature tracks origin/main), then N local commits ahead of that upstream.
 * Reproduces the defect where inventing origin/<local-branch> yields a false n/a.
 * @param aheadCount Commits ahead of origin/main.
 * @returns Repo path on branch `feature`.
 */
function repoWithMismatchedUpstreamName(aheadCount: number): string {
  const app = makeTempDir();
  initRepo(app);
  commitFile(app, 'base.txt', 'base', 'base');
  markHeadAsOriginMain(app);
  // Local name "feature", upstream still origin/main — no origin/feature ref.
  git(app, ['checkout', '-q', '-b', 'feature', '--track', 'origin/main']);
  for (let i = 1; i <= aheadCount; i += 1) {
    commitFile(app, `c${i}.txt`, `commit ${i}`, `ahead-${i}`);
  }
  return app;
}

/**
 * Create a repo with origin/main frozen, then N additional local commits.
 * @param aheadCount Commits ahead of origin/main.
 * @returns Repo path.
 */
function repoWithAhead(aheadCount: number): string {
  const app = makeTempDir();
  initRepo(app);
  commitFile(app, 'base.txt', 'base', 'base');
  markHeadAsOriginMain(app);
  for (let i = 1; i <= aheadCount; i += 1) {
    commitFile(app, `c${i}.txt`, `commit ${i}`, `ahead-${i}`);
  }
  return app;
}

/**
 * Create a repo with commits but no remote-tracking branch.
 * @returns Repo path.
 */
function repoWithNoRemote(): string {
  const app = makeTempDir();
  initRepo(app);
  commitFile(app, 'a.txt', 'a', 'init');
  return app;
}

/**
 * Run check.mjs lg-push-cadence against an app directory.
 * @param appDir App / repo directory.
 * @param env Extra env vars (merged onto process.env).
 * @returns Exit status and combined stdout+stderr.
 */
function runViaCheck(
  appDir: string,
  env: Record<string, string | undefined> = {}
): { status: number | null; output: string } {
  const merged: NodeJS.ProcessEnv = { ...process.env, ...env };
  // Ensure a stale REDANVIL_PRE_PUSH from the parent does not leak unless set.
  if (!('REDANVIL_PRE_PUSH' in env)) {
    delete merged.REDANVIL_PRE_PUSH;
  }
  const r = spawnSync(node, [CHECK_SCRIPT, 'lg-push-cadence', appDir], {
    encoding: 'utf8',
    env: merged
  });
  return {
    status: r.status,
    output: `${r.stdout ?? ''}${r.stderr ?? ''}`
  };
}

/**
 * Run lg-push-cadence.mjs directly (same exits as through check.mjs).
 * @param appDir App / repo directory.
 * @param env Extra env vars.
 * @returns Exit status and combined output.
 */
function runDirect(
  appDir: string,
  env: Record<string, string | undefined> = {}
): { status: number | null; output: string } {
  const merged: NodeJS.ProcessEnv = { ...process.env, ...env };
  if (!('REDANVIL_PRE_PUSH' in env)) {
    delete merged.REDANVIL_PRE_PUSH;
  }
  const r = spawnSync(node, [DIRECT_SCRIPT, appDir], {
    encoding: 'utf8',
    env: merged
  });
  return {
    status: r.status,
    output: `${r.stdout ?? ''}${r.stderr ?? ''}`
  };
}

afterEach(() => {
  delete process.env.REDANVIL_PRE_PUSH;
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

describe('lg-push-cadence wiring', () => {
  it('is registered in the rubric as det blocker on loop-gate', () => {
    const rule = loadRubric().find((r) => r.id === 'lg-push-cadence');
    expect(rule, 'lg-push-cadence missing from rubric').toBeDefined();
    expect(rule?.method).toBe('det');
    expect(rule?.severity).toBe('blocker');
    expect(rule?.lane).toBe('loop-gate');
  });

  it('is listed in APP_CHECKS', () => {
    expect(APP_CHECKS.some((c) => c.ruleId === 'lg-push-cadence')).toBe(true);
  });

  it('exports a single named threshold of 20', () => {
    expect(PUSH_CADENCE_THRESHOLD).toBe(20);
  });
});

describe('evaluatePushCadence (pure)', () => {
  it('FAILS above threshold with count + threshold + remedy in the message', () => {
    const over = PUSH_CADENCE_THRESHOLD + 1;
    const v = evaluatePushCadence({
      count: over,
      hasRemoteTracking: true,
      prePush: false
    });
    expect(v.kind).toBe('fail');
    if (v.kind !== 'fail') return;
    expect(v.count).toBe(over);
    expect(v.message).toContain(String(over));
    expect(v.message).toContain(String(PUSH_CADENCE_THRESHOLD));
    expect(v.message).toMatch(/push now/i);
    expect(v.message).toMatch(/waiver/i);
    console.log('lg-push-cadence pure known-bad:', v.message);
  });

  it('PASSes at the threshold and below', () => {
    for (const count of [0, 1, PUSH_CADENCE_THRESHOLD]) {
      const v = evaluatePushCadence({ count, hasRemoteTracking: true });
      expect(v.kind, `count=${count}`).toBe('pass');
    }
  });

  it('returns n/a when there is no remote-tracking branch', () => {
    const v = evaluatePushCadence({ count: null, hasRemoteTracking: false });
    expect(v.kind).toBe('notApplicable');
  });

  it('errors (not n/a) when remote-tracking existence is unresolvable', () => {
    const v = evaluatePushCadence({ count: null, hasRemoteTracking: null });
    expect(v.kind).toBe('error');
  });

  it('errors when count cannot be measured despite a remote ref', () => {
    const v = evaluatePushCadence({ count: null, hasRemoteTracking: true });
    expect(v.kind).toBe('error');
  });

  it('defers to pass under prePush while keeping the finding message', () => {
    const over = PUSH_CADENCE_THRESHOLD + 5;
    const v = evaluatePushCadence({
      count: over,
      hasRemoteTracking: true,
      prePush: true
    });
    expect(v.kind).toBe('pass');
    if (v.kind !== 'pass') return;
    expect(v.deferred).toBe(true);
    expect(v.message).toBe(cadenceFailMessage(over));
  });
});

describe('lg-push-cadence — four real exit codes (temp git fixtures)', () => {
  it('1. backlog above threshold → exit 1, message names the real count', () => {
    const ahead = PUSH_CADENCE_THRESHOLD + 1;
    const app = repoWithAhead(ahead);
    const measured = git(app, ['rev-list', '--count', 'origin/main..HEAD']);
    expect(Number(measured)).toBe(ahead);

    const r = runViaCheck(app);
    console.log('lg-push-cadence known-bad (over threshold):', r.output.slice(0, 400));
    console.log('lg-push-cadence case1 exit:', r.status);
    expect(r.status).toBe(1);
    expect(r.output).toContain(String(ahead));
    expect(r.output).toContain(String(PUSH_CADENCE_THRESHOLD));
    expect(r.output).toMatch(/push now/i);
  });

  it('2. at or below threshold → exit 0', () => {
    const app = repoWithAhead(0);
    const measured = git(app, ['rev-list', '--count', 'origin/main..HEAD']);
    expect(Number(measured)).toBe(0);

    const r = runViaCheck(app);
    console.log('lg-push-cadence known-good (at origin):', r.output.slice(0, 200));
    console.log('lg-push-cadence case2 exit:', r.status);
    expect(r.status).toBe(0);
  });

  it('2b. exactly at threshold still exits 0', () => {
    const app = repoWithAhead(PUSH_CADENCE_THRESHOLD);
    const measured = git(app, ['rev-list', '--count', 'origin/main..HEAD']);
    expect(Number(measured)).toBe(PUSH_CADENCE_THRESHOLD);

    const r = runViaCheck(app);
    console.log('lg-push-cadence at-threshold exit:', r.status);
    expect(r.status).toBe(0);
  });

  it('3. no remote-tracking branch → exit 3 (n/a)', () => {
    const app = repoWithNoRemote();
    const r = runViaCheck(app);
    console.log('lg-push-cadence known-na (no remote):', r.output.slice(0, 300));
    console.log('lg-push-cadence case3 exit:', r.status);
    expect(r.status).toBe(3);
    expect(r.output).toMatch(/n\/a|remote-tracking/i);
  });

  it('4. REDANVIL_PRE_PUSH=1 + backlog over threshold → exit 0, finding printed', () => {
    const ahead = PUSH_CADENCE_THRESHOLD + 1;
    const app = repoWithAhead(ahead);
    const r = runViaCheck(app, { REDANVIL_PRE_PUSH: '1' });
    console.log('lg-push-cadence pre-push deferred:', r.output.slice(0, 400));
    console.log('lg-push-cadence case4 exit:', r.status);
    expect(r.status).toBe(0);
    expect(r.output).toContain(String(ahead));
    expect(r.output).toMatch(/lg-push-cadence/i);
    expect(r.output).toMatch(/push now|deferred|REDANVIL_PRE_PUSH/i);
  });

  it('direct script agrees with check.mjs on the over-threshold fail', () => {
    const ahead = PUSH_CADENCE_THRESHOLD + 1;
    const app = repoWithAhead(ahead);
    const viaCheck = runViaCheck(app);
    const direct = runDirect(app);
    expect(viaCheck.status).toBe(1);
    expect(direct.status).toBe(1);
    expect(direct.output).toContain(String(ahead));
  });

  it('branch name differs from upstream name + backlog over threshold → exit 1 (not n/a)', () => {
    // Reproduction: local `feature` tracks `origin/master` (here origin/main).
    // Inventing origin/feature would n/a; real @{upstream} is origin/main with a backlog.
    const ahead = PUSH_CADENCE_THRESHOLD + 1;
    const app = repoWithMismatchedUpstreamName(ahead);

    const upstream = git(app, ['rev-parse', '--abbrev-ref', '@{upstream}']);
    expect(upstream).toBe('origin/main');

    const measured = git(app, ['rev-list', '--count', '@{upstream}..HEAD']);
    expect(Number(measured)).toBe(ahead);

    // origin/feature must not exist — that is the false path the bug used.
    const featureRef = spawnSync('git', ['rev-parse', '--verify', 'origin/feature'], {
      cwd: app,
      encoding: 'utf8'
    });
    expect(featureRef.status, 'origin/feature must be absent for this fixture').not.toBe(0);

    const r = runViaCheck(app);
    console.log('lg-push-cadence mismatched-upstream-name:', r.output.slice(0, 400));
    console.log('lg-push-cadence mismatched-upstream exit:', r.status);
    expect(r.status).toBe(1);
    expect(r.output).toContain(String(ahead));
    expect(r.output).toContain(String(PUSH_CADENCE_THRESHOLD));
    expect(r.output).toMatch(/push now/i);
  });
});
