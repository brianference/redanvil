import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { claudeArgs, parseClaudeJson, CODER_PERMISSION_MODE } from '../src/claude/harness';
import { withWorktree } from '../src/worktree/isolate';
import { runCommand } from '../src/process/run';

describe('claudeArgs', () => {
  it('is headless json with no prompt on argv', () => {
    const argv = claudeArgs();
    expect(argv).toEqual(['-p', '--output-format', 'json', '--input-format', 'text']);
    expect(argv.join(' ')).not.toMatch(/grok|always-approve|prompt-file/);
  });

  it('adds the coder permission mode and a resume id only when asked', () => {
    const argv = claudeArgs({ permissionMode: CODER_PERMISSION_MODE, resumeSessionId: 'abc' });
    expect(argv[argv.indexOf('--permission-mode') + 1]).toBe('auto');
    expect(argv[argv.indexOf('--resume') + 1]).toBe('abc');
  });
});

describe('parseClaudeJson', () => {
  it('extracts result, session id and cost from a real envelope shape', () => {
    const r = parseClaudeJson(
      '{"type":"result","is_error":false,"result":"ok","session_id":"s-1","total_cost_usd":0.2}'
    );
    expect(r?.text).toBe('ok');
    expect(r?.sessionId).toBe('s-1');
    expect(r?.costUsd).toBe(0.2);
  });

  it('FAIL INPUT: an is_error envelope is not a reply, even with a result string', () => {
    expect(parseClaudeJson('{"is_error":true,"result":"done","api_error_status":429}')).toBeNull();
  });

  it('returns null on malformed output', () => {
    expect(parseClaudeJson('not json')).toBeNull();
    expect(parseClaudeJson('{"no":"result"}')).toBeNull();
    // The old grok envelope is not a Claude reply.
    expect(parseClaudeJson('{"text":"ok","stopReason":"EndTurn"}')).toBeNull();
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
