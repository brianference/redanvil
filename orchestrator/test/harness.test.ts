import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { grokArgs, parseGrokJson, newSessionId } from '../src/grok/harness';
import { withWorktree } from '../src/worktree/isolate';
import { runCommand } from '../src/process/run';

describe('grokArgs', () => {
  const argv = grokArgs('/work/dir', 'do the thing', { sessionId: 'run-1' });

  it('includes the required headless flags and the scoped cwd', () => {
    expect(argv).toEqual(
      expect.arrayContaining(['--always-approve', '--no-alt-screen', '--output-format', 'json'])
    );
    expect(argv[argv.indexOf('--cwd') + 1]).toBe('/work/dir');
    expect(argv[argv.indexOf('--session-id') + 1]).toBe('run-1');
  });

  it('defaults to the grok-4.5 model and puts the prompt last', () => {
    expect(argv[argv.indexOf('-m') + 1]).toBe('grok-4.5');
    expect(argv[argv.length - 1]).toBe('do the thing');
    expect(argv[argv.length - 2]).toBe('-p');
  });
});

describe('newSessionId', () => {
  it('produces a valid UUID (grok rejects non-UUID session ids)', () => {
    expect(newSessionId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});

describe('parseGrokJson', () => {
  it('extracts text, stopReason, and usage from a real reply shape', () => {
    const r = parseGrokJson('{"text":"ok","stopReason":"EndTurn","usage":{"total_tokens":20}}');
    expect(r?.text).toBe('ok');
    expect(r?.stopReason).toBe('EndTurn');
    expect(r?.usage?.total_tokens).toBe(20);
  });

  it('returns null on malformed output', () => {
    expect(parseGrokJson('not json')).toBeNull();
    expect(parseGrokJson('{"no":"text"}')).toBeNull();
  });
});

describe('withWorktree', () => {
  it('runs fn in an isolated worktree and cleans it up afterward', async () => {
    const repo = await mkdtemp(join(tmpdir(), 'redanvil-repo-'));
    await runCommand('git', ['-C', repo, 'init', '-q']);
    await runCommand('git', ['-C', repo, 'config', 'user.email', 't@t.dev']);
    await runCommand('git', ['-C', repo, 'config', 'user.name', 't']);
    await writeFile(join(repo, 'seed.txt'), 'hi');
    await runCommand('git', ['-C', repo, 'add', '-A']);
    await runCommand('git', ['-C', repo, 'commit', '-qm', 'seed']);

    const branch = `wt-test-${process.pid}`;
    let seenDir = '';
    await withWorktree(repo, branch, async (dir) => {
      seenDir = dir;
      await access(join(dir, 'seed.txt')); // the commit is present in the isolated worktree
    });

    await expect(access(seenDir)).rejects.toBeTruthy(); // removed after
    await rm(repo, { recursive: true, force: true });
  });
});
