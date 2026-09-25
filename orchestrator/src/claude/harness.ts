/**
 * Headless Claude for the coder and the API judge.
 *
 * Owner rule (orchestrator/scripts/lib/engine-policy.mjs): coding and judging
 * run on Claude, never Grok, and there is no fallback between the two. When
 * Claude cannot run, the result is a failure the caller records -- never a
 * silent switch to another engine.
 *
 * The prompt goes on stdin, never argv: a prompt is prose, and argv on Windows
 * is both length-capped (~32KB) and re-split by cmd.exe.
 */
import { runCommand, scrubbedEnv, type RunResult } from '../process/run';
import { isErrorEnvelope } from '../loop/classifyClaude';

/** Options for one headless Claude call. */
export interface ClaudeOptions {
  /**
   * Continue this Claude session (`--resume`). Omit for a fresh context. Only
   * pass an id a previous call's envelope actually returned.
   */
  resumeSessionId?: string;
  /** Wall-clock ceiling. Defaults to {@link DEFAULT_CLAUDE_TIMEOUT_MS}. */
  timeoutMs?: number;
  /**
   * `--permission-mode`. The coder edits files and runs tests, so it needs
   * {@link CODER_PERMISSION_MODE}. A read-only call omits it and gets the
   * headless default, which denies edits.
   */
  permissionMode?: ClaudePermissionMode;
}

/** Permission modes `claude --help` lists for `--permission-mode`. */
export type ClaudePermissionMode =
  | 'acceptEdits'
  | 'auto'
  | 'bypassPermissions'
  | 'manual'
  | 'dontAsk'
  | 'plan';

/** The model's reply out of Claude's `--output-format json` envelope. */
export interface ClaudeReply {
  /** The `result` string: the model's final text. */
  text: string;
  /** Session id to pass as `resumeSessionId` on the next call. */
  sessionId?: string;
  /** `total_cost_usd` from the envelope, when present. */
  costUsd?: number;
}

/** Same ceiling the Grok harness used, so lg-grok-timeout semantics hold. */
export const DEFAULT_CLAUDE_TIMEOUT_MS = 600_000;

/**
 * The coder's permission mode.
 *
 * `auto` was measured on 2026-09-24: a `claude -p` run with it ran a Bash
 * command and wrote a file with `permission_denials: []`. `acceptEdits`
 * would deny the Bash test runs the coder prompt asks for, and
 * `bypassPermissions` skips every check, which the run does not need. The
 * blast radius is still the disposable worktree (lg-worktree-isolation).
 */
export const CODER_PERMISSION_MODE: ClaudePermissionMode = 'auto';

/**
 * Argv for headless Claude. Fixed flags only: the prompt is stdin.
 *
 * @param opts - Resume id and permission mode.
 * @returns Arguments for `runCommand('claude', ...)`.
 */
export function claudeArgs(opts: ClaudeOptions = {}): string[] {
  const args = ['-p', '--output-format', 'json', '--input-format', 'text'];
  if (opts.permissionMode) args.push('--permission-mode', opts.permissionMode);
  if (opts.resumeSessionId) args.push('--resume', opts.resumeSessionId);
  return args;
}

/**
 * Run Claude headless in `cwd`, bounded and killable via the runner, with a
 * scrubbed environment so no secrets reach the coder (lg-grok-no-secrets --
 * the rule id predates the switch; it scores whichever coder ran).
 *
 * Exit 0 is not enough. Claude exits 0 with an `is_error: true` envelope on a
 * usage limit or API error, and an empty stdout means it never ran; both come
 * back as `code: null` with the reason in stderr.
 *
 * @param cwd - Directory Claude works in.
 * @param prompt - Prompt text. Sent on stdin.
 * @param opts - Timeout, resume id, permission mode.
 * @returns The run result, with `code` null when Claude did not do the work.
 */
export async function runClaude(
  cwd: string,
  prompt: string,
  opts: ClaudeOptions = {}
): Promise<RunResult> {
  const result = await runCommand('claude', claudeArgs(opts), {
    cwd,
    input: prompt,
    timeoutMs: opts.timeoutMs ?? DEFAULT_CLAUDE_TIMEOUT_MS,
    env: scrubbedEnv([])
  });

  // Silence is a failure, not a result: a launch that died immediately with
  // exit 0 reads exactly like a coder with nothing to say.
  if (result.code === 0 && result.stdout.trim() === '' && result.stderr.trim() === '') {
    return {
      ...result,
      code: null,
      stderr:
        'claude exited 0 without writing anything to stdout or stderr. A delegated ' +
        'run that produced no output did not run; treating it as a failure.'
    };
  }
  if (isErrorEnvelope(result.stdout)) {
    return {
      ...result,
      code: null,
      stderr: `${result.stderr}\nclaude returned an is_error envelope; the work was not done.`.trim()
    };
  }
  return result;
}

/**
 * Parse Claude's `--output-format json` stdout into the reply text.
 *
 * @param stdout - Raw stdout.
 * @returns The reply, or null when stdout is not an envelope, carries
 *   `is_error: true`, or has no `result` string.
 */
export function parseClaudeJson(stdout: string): ClaudeReply | null {
  try {
    const envelope = JSON.parse(stdout.trim()) as {
      is_error?: unknown;
      result?: unknown;
      session_id?: unknown;
      total_cost_usd?: unknown;
    };
    if (envelope === null || typeof envelope !== 'object') return null;
    if (envelope.is_error === true) return null;
    if (typeof envelope.result !== 'string') return null;
    return {
      text: envelope.result,
      sessionId: typeof envelope.session_id === 'string' ? envelope.session_id : undefined,
      costUsd: typeof envelope.total_cost_usd === 'number' ? envelope.total_cost_usd : undefined
    };
  } catch {
    return null;
  }
}
