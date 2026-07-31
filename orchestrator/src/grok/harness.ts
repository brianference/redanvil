import { runCommand, scrubbedEnv, type RunResult } from '../process/run';

export interface GrokOptions {
  sessionId: string;
  model?: string;
  timeoutMs?: number;
}

export interface GrokReply {
  text: string;
  stopReason?: string;
  usage?: Record<string, number>;
}

const DEFAULT_MODEL = 'grok-4.5';
const DEFAULT_GROK_TIMEOUT_MS = 600_000;

/** Grok requires --session-id to be a valid UUID (confirmed live 2026-07-21). */
export function newSessionId(): string {
  return crypto.randomUUID();
}

/** Builds the headless grok argv for a bounded, isolated build invocation. */
export function grokArgs(cwd: string, prompt: string, opts: GrokOptions): string[] {
  return [
    '--no-auto-update',
    '--always-approve',
    '--no-alt-screen',
    '--cwd',
    cwd,
    '--session-id',
    opts.sessionId,
    '-m',
    opts.model ?? DEFAULT_MODEL,
    '--output-format',
    'json',
    '-p',
    prompt
  ];
}

/**
 * Invokes Grok headless in `cwd`, bounded and killable via the runner, with a
 * scrubbed environment so no secrets are exposed to Grok (lg-grok-no-secrets).
 */
export async function runGrok(cwd: string, prompt: string, opts: GrokOptions): Promise<RunResult> {
  const result = await runCommand('grok', grokArgs(cwd, prompt, opts), {
    cwd,
    timeoutMs: opts.timeoutMs ?? DEFAULT_GROK_TIMEOUT_MS,
    env: scrubbedEnv([])
  });

  /*
    Silence is a failure, not a result.

    A delegated run that produces no output at all is indistinguishable, to
    every caller here, from one that ran and had nothing to say. That happened:
    a launch died immediately and was reported as running, because exit 0 with
    empty stdout reads exactly like a clean no-op. The loop would have folded
    that into an iteration and scored the tree unchanged, which looks like a
    coder that declined to help rather than a coder that never started.

    An exit code of 0 with nothing on either stream is therefore converted into
    an explicit failure. A real grok invocation always emits its JSON envelope.
  */
  if (result.code === 0 && result.stdout.trim() === '' && result.stderr.trim() === '') {
    return {
      ...result,
      code: null,
      stderr:
        'grok exited 0 without writing anything to stdout or stderr. A delegated ' +
        'run that produced no output did not run; treating it as a failure rather ' +
        'than as a coder with nothing to say.'
    };
  }
  return result;
}

/** Parses grok's `--output-format json` stdout into text plus usage. Returns null on malformed output. */
export function parseGrokJson(stdout: string): GrokReply | null {
  try {
    const o = JSON.parse(stdout) as {
      text?: unknown;
      stopReason?: unknown;
      usage?: Record<string, number>;
    };
    if (typeof o.text !== 'string') return null;
    return {
      text: o.text,
      stopReason: typeof o.stopReason === 'string' ? o.stopReason : undefined,
      usage: o.usage
    };
  } catch {
    return null;
  }
}
