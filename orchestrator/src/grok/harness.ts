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

const DEFAULT_MODEL = 'grok-4.5-build';
const DEFAULT_GROK_TIMEOUT_MS = 600_000;

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
  return runCommand('grok', grokArgs(cwd, prompt, opts), {
    cwd,
    timeoutMs: opts.timeoutMs ?? DEFAULT_GROK_TIMEOUT_MS,
    env: scrubbedEnv([])
  });
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
