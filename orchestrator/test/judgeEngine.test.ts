/**
 * The per-iteration judge runs on Claude only.
 *
 * Runners are injected. A rate-limit or error envelope must not be recorded
 * as a review, and there is no Grok fallback: a Claude failure fails the
 * review closed (UNVERIFIED), per orchestrator/scripts/lib/engine-policy.mjs.
 */
import { describe, it, expect, vi } from 'vitest';

/** Every command the review asks runCommand to spawn in this file. */
const spawnedCommands: string[] = vi.hoisted(() => []);

// Pass-through wrapper that records the command name, so a negative test can
// prove no code path shells out to grok. Behaviour is otherwise unchanged.
vi.mock('../src/process/run', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/process/run')>();
  return {
    ...actual,
    runCommand: (command: string, ...rest: Parameters<typeof actual.runCommand> extends [string, ...infer R] ? R : never) => {
      spawnedCommands.push(command);
      return actual.runCommand(command, ...rest);
    }
  };
});
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { classifyClaude, claudeDidNotReview } from '../src/loop/classifyClaude';
import { claudeSpawnPlan, parseJudgeJson } from '../src/loop/independentReview';
import { invokeIterationJudge } from '../src/team/pm';
import type { EngineSpawnResult } from '../src/loop/independentReview';

/**
 * Init a temp git repo with one committed file, so the judge has a diff.
 *
 * @returns Absolute repo path.
 */
function repoWithDiff(): string {
  const dir = mkdtempSync(join(tmpdir(), 'redanvil-judge-engine-'));
  const git = (args: string[]): void => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
    }
  };
  git(['init', '-q']);
  git(['config', 'user.email', 't@t']);
  git(['config', 'user.name', 't']);
  git(['checkout', '-q', '-b', 'main']);
  writeFileSync(join(dir, 'a.ts'), 'export const a = 1;\n', 'utf8');
  git(['add', 'a.ts']);
  git(['commit', '-qm', 'init']);
  return dir;
}

/** A Claude envelope whose model text is a clean review. */
function claudeOk(): EngineSpawnResult {
  return {
    status: 0,
    stderr: '',
    unavailable: false,
    stdout: JSON.stringify({
      is_error: false,
      subtype: 'success',
      total_cost_usd: 0.01,
      result: JSON.stringify({ foundNothingExplicit: true, findings: [] })
    })
  };
}

/** The rate-limit envelope overnight.mjs classifies as "wait". */
function claudeLimited(): EngineSpawnResult {
  return {
    status: 1,
    stderr: '',
    unavailable: false,
    stdout: JSON.stringify({
      is_error: true,
      api_error_status: 429,
      subtype: 'error',
      permission_denials: []
    })
  };
}

describe('classifyClaude', () => {
  it('treats api_error_status 429 and 529 as rate limits', () => {
    const limited = classifyClaude(claudeLimited());
    expect(limited.rateLimited).toBe(true);
    expect(limited.ok).toBe(false);
    const overloaded = classifyClaude({
      status: 1,
      stderr: '',
      stdout: JSON.stringify({ is_error: true, api_error_status: 529, subtype: 'error' })
    });
    expect(overloaded.rateLimited).toBe(true);
  });

  it('does not treat a clean envelope as a rate limit', () => {
    const clean = classifyClaude(claudeOk());
    expect(clean.rateLimited).toBe(false);
    expect(clean.ok).toBe(true);
    expect(clean.costUsd).toBe(0.01);
  });

  it('falls back to text when there is no envelope', () => {
    const text = classifyClaude({
      status: 1,
      stdout: 'not json',
      stderr: 'usage limit reached'
    });
    expect(text.rateLimited).toBe(true);
    expect(claudeDidNotReview({ status: 1, stdout: '', stderr: '', unavailable: true })).toBe(
      true
    );
    expect(
      claudeDidNotReview({ status: 1, stdout: 'nope', stderr: '', unavailable: false })
    ).toBe(false);
  });
});

describe('claude spawn plan', () => {
  it('sends the prompt on stdin, without a shell or a resumed session', () => {
    const plan = claudeSpawnPlan('review this diff');
    expect(plan.command).toBe('claude');
    expect(plan.shell).toBe(false);
    expect(plan.input).toBe('review this diff');
    expect(plan.args).toEqual(['-p', '--output-format', 'json']);
    expect(plan.args.join(' ')).not.toMatch(/resume|session/i);
  });
});

describe('per-iteration judge engine', () => {
  it('records claude when claude answers', async () => {
    const dir = repoWithDiff();
    try {
      let claudeCalls = 0;
      const result = await invokeIterationJudge(dir, {
        runClaude: () => {
          claudeCalls += 1;
          return claudeOk();
        }
      });
      expect(claudeCalls).toBeGreaterThan(0);
      expect(result.ok).toBe(true);
      expect(result.engine).toBe('claude');
      expect(result.summary).toMatch(/claude/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('FAIL INPUT: a rate-limited claude fails the review closed and never runs grok', async () => {
    const dir = repoWithDiff();
    spawnedCommands.length = 0;
    try {
      let claudeCalls = 0;
      const result = await invokeIterationJudge(dir, {
        runClaude: () => {
          claudeCalls += 1;
          return claudeLimited();
        }
      });
      expect(claudeCalls).toBeGreaterThan(0);
      expect(result.ok).toBe(false);
      expect(result.engine).toBe('claude');
      expect(result.summary).toMatch(/unavailable/);
      expect(spawnedCommands.filter((c) => /grok/i.test(c))).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('FAIL INPUT: an is_error envelope with a clean-looking result is not a pass', async () => {
    const dir = repoWithDiff();
    try {
      const result = await invokeIterationJudge(dir, {
        runClaude: () => ({
          status: 0,
          stderr: '',
          unavailable: false,
          stdout: JSON.stringify({
            is_error: true,
            result: JSON.stringify({ foundNothingExplicit: true, findings: [] })
          })
        })
      });
      expect(result.ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reads a review out of the claude result string', () => {
    const parsed = parseJudgeJson(claudeOk().stdout);
    expect(parsed).not.toBeNull();
    expect(parsed?.foundNothingExplicit).toBe(true);
  });
});

describe('claudeDidNotReview on an error envelope', () => {
  it('is true when claude returns is_error, even with parseable text', () => {
    const envelope = JSON.stringify({
      type: 'result',
      is_error: true,
      result: '{"findings":[],"foundNothingExplicit":true}'
    });
    expect(claudeDidNotReview({ status: 1, stdout: envelope, stderr: '' })).toBe(true);
    expect(claudeDidNotReview({ status: 0, stdout: envelope, stderr: '' })).toBe(true);
  });
});
