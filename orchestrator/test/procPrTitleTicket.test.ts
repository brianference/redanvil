/**
 * Unit and CLI tests for proc-pr-title-ticket.
 * Pure title checks do not need git/gh; the full CLI is exercised for the N/A path.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT = fileURLToPath(
  new URL('../scripts/checks/proc-pr-title-ticket.mjs', import.meta.url)
);
const node = process.execPath;

/** Temp dirs created this file; cleaned in afterEach. */
const tempDirs: string[] = [];

/**
 * Create a unique empty temp directory and track it for cleanup.
 * @returns Absolute path to the empty directory.
 */
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'redanvil-pr-title-'));
  tempDirs.push(dir);
  return dir;
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

/**
 * Load the check module (ESM) for pure-function tests.
 */
async function loadModule() {
  return import(pathToFileURL(SCRIPT).href);
}

/**
 * Outcome collector: records pass/fail/na without exiting the process.
 */
function makeIo() {
  const record: {
    kind: 'pass' | 'fail' | 'na' | null;
    msg?: string;
  } = { kind: null };
  const io = {
    pass: (): never => {
      record.kind = 'pass';
      throw Object.assign(new Error('io-exit'), { exitCode: 0 });
    },
    fail: (msg?: string): never => {
      record.kind = 'fail';
      record.msg = msg;
      throw Object.assign(new Error('io-exit'), { exitCode: 1 });
    },
    notApplicable: (why?: string): never => {
      record.kind = 'na';
      record.msg = why;
      throw Object.assign(new Error('io-exit'), { exitCode: 3 });
    }
  };
  return { io, record };
}

/**
 * Invoke a function expected to call an io exit path; return the recorded outcome.
 * @param fn Function that should call io.pass/fail/notApplicable.
 * @param record Shared outcome record from makeIo().
 */
function captureOutcome(
  fn: () => void,
  record: { kind: 'pass' | 'fail' | 'na' | null; msg?: string }
): { kind: 'pass' | 'fail' | 'na' | null; msg?: string } {
  try {
    fn();
  } catch (err) {
    if (!(err instanceof Error) || err.message !== 'io-exit') throw err;
  }
  return { kind: record.kind, msg: record.msg };
}

describe('titleHasTicket (pure)', () => {
  it('accepts ticket-prefixed titles', async () => {
    const { titleHasTicket } = await loadModule();
    const good = [
      'RA-42: fix login',
      '[RA-42] fix login',
      'PROJ-123 stuff',
      'ABC-1: tiny',
      'RA-42',
      '[PROJ-99]: bracket colon'
    ];
    for (const title of good) {
      expect(titleHasTicket(title), title).toBe(true);
    }
  });

  it('accepts conventional type then ticket', async () => {
    const { titleHasTicket } = await loadModule();
    const good = [
      'feat: RA-42 login',
      'fix(api): RA-42 login',
      'chore!: PROJ-7 release prep',
      'docs(readme): [RA-1] clarify gate',
      'refactor: ABC-99 simplify check'
    ];
    for (const title of good) {
      expect(titleHasTicket(title), title).toBe(true);
    }
  });

  it('rejects titles without a leading ticket', async () => {
    const { titleHasTicket } = await loadModule();
    const bad = [
      'WIP: update stuff',
      'fix: update stuff',
      'update stuff',
      'feat: update RA-42 later',
      'ra-42: lowercase project key',
      'Fix RA-42 login',
      '',
      '   ',
      'feat(api): missing ticket entirely'
    ];
    for (const title of bad) {
      expect(titleHasTicket(title), JSON.stringify(title)).toBe(false);
    }
  });
});

describe('checkPrTitle', () => {
  it('passes with a ticket-prefixed title', async () => {
    const { checkPrTitle } = await loadModule();
    const { io, record } = makeIo();
    const outcome = captureOutcome(() => checkPrTitle('RA-123: fix the gate', io), record);
    expect(outcome.kind).toBe('pass');
  });

  it('fails with a non-ticket title and quotes it', async () => {
    const { checkPrTitle } = await loadModule();
    const { io, record } = makeIo();
    const outcome = captureOutcome(() => checkPrTitle('WIP: update stuff', io), record);
    expect(outcome.kind).toBe('fail');
    expect(outcome.msg).toContain('WIP: update stuff');
    expect(outcome.msg).toMatch(/missing ticket key/i);
  });
});

describe('CLI harness', () => {
  it('exits 2 on missing appDir', () => {
    const r = spawnSync(node, [SCRIPT], { encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/usage:/i);
  });

  it('exits 3 (not applicable) for a non-git temp directory', () => {
    const dir = makeTempDir();
    const r = spawnSync(node, [SCRIPT, dir], {
      encoding: 'utf8',
      env: process.env
    });
    expect(r.status, `stderr=${r.stderr} stdout=${r.stdout}`).toBe(3);
    expect(r.stderr).toMatch(/n\/a:/i);
  });
});

/** Outcome callbacks the check calls instead of exiting. */
interface Outcome {
  pass: () => never;
  fail: (m?: string) => never;
  notApplicable: (w?: string) => never;
}

describe('proc-pr-title-ticket via the GitHub API', () => {
  // The CLI path had never once run on the machine this gate was built for —
  // `gh` is not installed there — so the rule reported "gh not available" for
  // its whole life and silently left the denominator. These tests exercise the
  // API path with an injected fetcher so it does not depend on a binary, a
  // network, or a token.

  interface PrTitleModule {
    parseRemote: (url: string) => { owner: string; repo: string } | null;
    runProcPrTitleTicket: (
      appDir: string,
      io: Outcome,
      httpGet: (url: string) => Promise<{ ok: boolean; json: unknown }>
    ) => Promise<void>;
  }

  /** Load the module fresh so env changes take effect. */
  const load = async (): Promise<PrTitleModule> =>
    (await import(
      `${pathToFileURL(SCRIPT).href}?t=${Date.now()}${Math.random()}`
    )) as unknown as PrTitleModule;

  /** Collect the outcome instead of exiting the process. */
  const collector = (): { io: Outcome; out: string[] } => {
    const out: string[] = [];
    return {
      out,
      io: {
        pass: () => out.push('pass') as never,
        fail: (m?: string) => out.push(`fail:${m ?? ''}`) as never,
        notApplicable: (w?: string) => out.push(`na:${w ?? ''}`) as never
      }
    };
  };

  it('parses owner/repo from both ssh and https remotes', async () => {
    const { parseRemote } = await load();
    expect(parseRemote('https://github.com/brianference/redanvil.git')).toEqual({
      owner: 'brianference',
      repo: 'redanvil'
    });
    expect(parseRemote('git@github.com:brianference/redanvil.git')).toEqual({
      owner: 'brianference',
      repo: 'redanvil'
    });
    expect(parseRemote('https://gitlab.com/x/y.git')).toBeNull();
  });

  it('passes when the API returns a ticket-prefixed PR title', async () => {
    const mod = await load();
    process.env['GITHUB_TOKEN'] = 'test-token-not-a-secret';
    const { io, out } = collector();
    await mod.runProcPrTitleTicket(process.cwd(), io, async (url: string) =>
      url.includes('/pulls')
        ? { ok: true, json: [{ number: 7, title: 'RA-42: add the thing' }] }
        : { ok: true, json: [] }
    );
    expect(out).toEqual(['pass']);
  });

  it('FAILS when the API returns a PR title with no ticket key', async () => {
    const mod = await load();
    process.env['GITHUB_TOKEN'] = 'test-token-not-a-secret';
    const { io, out } = collector();
    await mod.runProcPrTitleTicket(process.cwd(), io, async () => ({
      ok: true,
      json: [{ number: 8, title: 'just fixing stuff' }]
    }));
    expect(out[0]).toMatch(/^fail:/);
  });

  it('reports a missing token distinctly from a repo with no PRs', async () => {
    const mod = await load();
    delete process.env['GITHUB_TOKEN'];
    delete process.env['GH_TOKEN'];
    const noToken = collector();
    await mod.runProcPrTitleTicket(process.cwd(), noToken.io, async () => ({
      ok: true,
      json: []
    }));
    expect(noToken.out[0]).toMatch(/no GITHUB_TOKEN/);

    process.env['GITHUB_TOKEN'] = 'test-token-not-a-secret';
    const noPr = collector();
    await mod.runProcPrTitleTicket(process.cwd(), noPr.io, async () => ({ ok: true, json: [] }));
    // A repo that pushes straight to master genuinely has nothing to measure.
    // That must not read as "the tool is missing", which is what it used to say.
    expect(noPr.out[0]).toMatch(/no pull request for this commit or branch/);
  });
});
