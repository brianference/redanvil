/**
 * The per-iteration judge runs on Claude and falls back to Grok.
 *
 * Runners are injected. A rate-limit envelope must not be recorded as a
 * Claude review, and a successful Claude review must not call Grok.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { classifyClaude, claudeShouldFallBack } from '../src/loop/classifyClaude';
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
    expect(claudeShouldFallBack({ status: 1, stdout: '', stderr: '', unavailable: true })).toBe(
      true
    );
    expect(
      claudeShouldFallBack({ status: 1, stdout: 'nope', stderr: '', unavailable: false })
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
  it('records claude when claude answers, and does not call grok', async () => {
    const dir = repoWithDiff();
    try {
      let grokCalls = 0;
      const result = await invokeIterationJudge(dir, {
        runClaude: () => claudeOk(),
        runGrok: () => {
          grokCalls += 1;
          throw new Error('grok must not run when claude answered');
        }
      });
      expect(grokCalls).toBe(0);
      expect(result.ok).toBe(true);
      expect(result.engine).toBe('claude');
      expect(result.summary).toMatch(/claude/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to grok when claude is rate-limited and records grok', async () => {
    const dir = repoWithDiff();
    try {
      let grokCalls = 0;
      const result = await invokeIterationJudge(dir, {
        runClaude: () => claudeLimited(),
        runGrok: () => {
          grokCalls += 1;
          return {
            status: 0,
            stderr: '',
            unavailable: false,
            stdout: JSON.stringify({ foundNothingExplicit: true, findings: [] })
          };
        }
      });
      expect(grokCalls).toBeGreaterThan(0);
      expect(result.engine).toBe('grok');
      expect(result.ok).toBe(true);
      expect(result.summary).toMatch(/grok/);
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

describe('claudeShouldFallBack on an error envelope', () => {
  it('falls back to grok when claude returns is_error, even with parseable text', async () => {
    const { claudeShouldFallBack } = await import('../src/loop/classifyClaude');
    const envelope = JSON.stringify({
      type: 'result',
      is_error: true,
      result: '{"findings":[],"foundNothingExplicit":true}'
    });
    expect(claudeShouldFallBack({ status: 1, stdout: envelope, stderr: '' })).toBe(true);
    expect(claudeShouldFallBack({ status: 0, stdout: envelope, stderr: '' })).toBe(true);
  });
});
