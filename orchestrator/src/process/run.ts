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
 * Largest argv this will hand to a shell, in bytes.
 *
 * Well under the ~32KB Windows command-line limit, because the shell adds
 * quoting on top of what we measure. Anything approaching this size is a
 * payload, and a payload belongs in a file.
 */
const MAX_ARGV_BYTES = 8192;

/**
 * Quote one argument for the Windows `shell: true` path.
 *
 * Node escapes arguments itself only when spawning WITHOUT a shell. With
 * `shell: true` on Windows it joins argv with spaces and hands the string to
 * `cmd.exe`, so any argument containing a space arrives as several arguments.
 *
 * That silently broke every multi-word argument this repo passes to a bare
 * command — which is to say every Grok invocation, since a prompt is prose.
 * `runGrok(dir, 'Reply with only {"ok":true}')` reached grok as the arguments
 * `Reply`, `with`, `only`, ... and grok exited 2 with "unexpected argument
 * 'only'". The loop command has always sent its coder prompt this way, so on
 * Windows it could not have been delivering the prompt it composed. Nothing
 * caught it because the failure looks like the model declining to answer rather
 * than like a spawn bug.
 *
 * Inside double quotes cmd treats `&`, `|`, `<`, `>` and `^` literally, so the
 * quoting only has to handle embedded double quotes and trailing backslashes
 * (a `\` immediately before the closing quote would escape it).
 *
 * @param arg - One argument.
 * @returns The argument, safe to concatenate into a cmd.exe command line.
 */
export function quoteForCmd(arg: string): string {
  if (arg === '') return '""';
  if (!/[\s"^&|<>()]/.test(arg)) return arg;
  const escaped = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1');
  return `"${escaped}"`;
}

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

  // Refuse an argv the platform cannot carry, rather than letting the OS decide.
  //
  // Windows caps a command line near 32KB. Inlining a 60KB evidence file into a
  // Grok prompt hit that ceiling and the spawn died with ENAMETOOLONG -- before
  // the model saw anything, and with an error naming neither the argument nor
  // the caller. The fix is always the same (write the payload to a file and
  // pass the path), so the failure should say so instead of surfacing an errno.
  const argvBytes = args.reduce((n, a) => n + Buffer.byteLength(a, 'utf8') + 1, 0);
  if (argvBytes > MAX_ARGV_BYTES) {
    return Promise.resolve({
      code: null,
      stdout: '',
      stderr:
        `refusing to spawn ${command}: arguments total ${argvBytes} bytes, over the ` +
        `${MAX_ARGV_BYTES}-byte ceiling. Write the payload to a file and pass its path; ` +
        'a large argv fails as ENAMETOOLONG on Windows with no indication of which ' +
        'argument was too big.',
      timedOut: false,
      durationMs: 0
    });
  }

  // On Windows, bare command names like `npx`/`npm`/`grok` resolve to `.cmd`
  // shims that cannot be spawned without a shell; absolute paths (node.exe) can.
  const useShell =
    process.platform === 'win32' && !command.includes('\\') && !command.includes('/');

  return new Promise<RunResult>((resolve) => {
    const child = spawn(command, useShell ? args.map(quoteForCmd) : args, {
      cwd,
      env,
      shell: useShell
    });
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
