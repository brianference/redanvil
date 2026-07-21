import { spawn } from 'node:child_process';

export interface RunResult {
  /** Process exit code, or null if it was killed (e.g. on timeout). */
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

export interface RunOptions {
  cwd?: string;
  /** Hard wall-clock ceiling in ms. On expiry the process is killed and `timedOut` is set. */
  timeoutMs?: number;
  /** Full environment for the child. Callers pass a scrubbed env to withhold secrets from Grok. */
  env?: NodeJS.ProcessEnv;
}

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Runs a command with a hard wall-clock timeout, killing it if it overruns.
 * Always resolves — never rejects and never hangs — so the loop's critical path
 * cannot stall on a wedged subprocess (rules/loop-gate.md: lg-grok-timeout).
 */
export function runCommand(
  command: string,
  args: string[],
  opts: RunOptions = {}
): Promise<RunResult> {
  const { cwd, timeoutMs = DEFAULT_TIMEOUT_MS, env } = opts;
  const start = Date.now();

  return new Promise<RunResult>((resolve) => {
    const child = spawn(command, args, { cwd, env, shell: false });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const finish = (code: number | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut, durationMs: Date.now() - start });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err: Error) => {
      stderr += `\n[spawn error] ${err.message}`;
      finish(null);
    });
    child.on('close', (code) => finish(code));
  });
}

/**
 * Builds a minimal environment that carries only the allowlisted variables plus PATH,
 * so a subprocess (Grok) never sees secrets that live elsewhere in process.env.
 */
export function scrubbedEnv(allow: readonly string[] = []): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  const base = ['PATH', 'Path', 'SystemRoot', 'HOME', 'USERPROFILE', 'TEMP', 'TMP'];
  for (const key of [...base, ...allow]) {
    const v = process.env[key];
    if (v !== undefined) out[key] = v;
  }
  return out;
}
