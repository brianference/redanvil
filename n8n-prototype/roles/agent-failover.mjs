/**
 * Grok first, Claude only when Grok never got to do the work.
 *
 * Ported from loki/overnight.mjs (`grokCannotRun`, `prepareAgentLaunch`):
 * the prompt goes to grok through `--prompt-file` and to claude on stdin,
 * and both children are spawned with `shell: false`. A hang is either the
 * overall timeout or a stretch of silence on stdout and stderr.
 *
 * Image roles stay on Grok. Grok Imagine (`image_gen`) is not a Claude tool;
 * handing that prompt to Claude produces a write-up instead of the marks.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Kill the grok child when it has produced no stdout and no stderr for this
 * long. A live run on 2026-08-22 hung past 20 minutes three times with no
 * output; 8 minutes of silence is the hang, not a slow token.
 */
export const HEARTBEAT_SILENCE_MS = 8 * 60 * 1000;

/** Model the overnight loop and the role scripts already pin. */
export const GROK_MODEL = 'grok-4.6';

/**
 * Whether grok failed before it could do the work.
 *
 * Hand off only when grok did not succeed. `status === null` is a hang, a
 * timeout, or a spawn failure. A non-zero exit hands off when the output
 * says `spending limit` or contains HTTP 403. Exit 0 is never a handoff.
 * Any other non-zero exit means grok ran and failed.
 *
 * FAIL INPUT: `{status: 0, stdout: 'fixed the spending limit check'}` → false.
 * FAIL INPUT: `{status: 1, stderr: 'HTTP 403 Forbidden'}` → true.
 * FAIL INPUT: `{status: null, error: {code: 'ETIMEDOUT'}}` → true.
 * A plain exit 1 with no 403 → false.
 *
 * @param {{status: number|null, stdout?: string, stderr?: string, error?: {code?: string|null}|null}} res
 * @returns {boolean}
 */
export function grokCannotRun(res) {
  if (res.status === null) return true;
  if (res.status === 0) return false;
  const text = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
  return GROK_ACCOUNT_BLOCKED_RE.test(text);
}

/**
 * The shapes grok prints when the ACCOUNT cannot run, not when the task failed.
 *
 * A bare `\b40[23]\b` also matched a failing test's "expected 200 to be 403" and
 * a stack frame "App.tsx:402:11", and handed a half-finished tree to Claude. Only
 * the API error envelope, the status phrases and the billing words count.
 * Measured 2026-09-23: `API error (status 402 Payment Required): Grok Build usage balance exhausted`.
 */
const GROK_ACCOUNT_BLOCKED_RE =
  /API error \(status 40[23]\b|\b403 Forbidden\b|\b402 Payment Required\b|usage balance exhausted|spending[- ]limit/i;

/** The balance-exhausted subset, for a readable receipt reason. */
const GROK_BALANCE_EXHAUSTED_RE = /\b402 Payment Required\b|usage balance exhausted/i;

/**
 * Short reason for a receipt. Not the whole stream.
 * @param {{status: number|null, stdout?: string, stderr?: string, error?: {code?: string|null, message?: string}|null}} res
 * @returns {string}
 */
export function describeGrokFailure(res) {
  if (res.error?.code === 'HEARTBEAT') return 'heartbeat: no output';
  if (res.error?.code === 'ETIMEDOUT' || res.status === null) return 'hang or timeout';
  const text = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
  if (GROK_BALANCE_EXHAUSTED_RE.test(text)) return 'usage balance exhausted (402)';
  if (/spending[- ]limit/i.test(text)) return 'spending limit';
  if (GROK_ACCOUNT_BLOCKED_RE.test(text)) return 'HTTP 403';
  return `exit ${res.status}`;
}

/**
 * Stop a child and the processes it spawned.
 * `child.kill` on Windows does not take the tree, and grok.exe starts one.
 * @param {import('node:child_process').ChildProcess} child
 */
function killChild(child) {
  if (child.pid === undefined) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
    return;
  }
  child.kill('SIGKILL');
}

/**
 * Spawn one child with a silence timer and an overall bound.
 *
 * `shell` is false. grok and claude are executables; a shell is what splits
 * a free-text argument, which is why the prompt is a file or stdin.
 *
 * The silence timer resets on every stdout or stderr chunk. When it fires
 * the child is killed and the result is a hang (`status: null`,
 * `error.code: 'HEARTBEAT'`), which `grokCannotRun` treats as a handoff.
 *
 * @param {{bin: string, args: string[], cwd?: string, input?: string|null, timeoutMs?: number, heartbeatMs?: number}} spec
 * @returns {Promise<{status: number|null, stdout: string, stderr: string, error: {code: string|null, message: string}|null}>}
 */
export function spawnTracked(spec) {
  const heartbeatMs = spec.heartbeatMs ?? 0;
  return new Promise((resolve) => {
    const child = spawn(spec.bin, spec.args, {
      cwd: spec.cwd,
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let heartbeatKilled = false;
    let timedOut = false;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let silenceTimer;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let overallTimer;

    /**
     * @param {number|null} status
     * @param {{code: string|null, message: string}|null} error
     */
    const finish = (status, error) => {
      if (settled) return;
      settled = true;
      if (silenceTimer) clearTimeout(silenceTimer);
      if (overallTimer) clearTimeout(overallTimer);
      resolve({ status, stdout, stderr, error });
    };

    const armSilence = () => {
      if (!heartbeatMs || heartbeatMs <= 0) return;
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        heartbeatKilled = true;
        killChild(child);
      }, heartbeatMs);
    };

    armSilence();
    if (spec.timeoutMs && spec.timeoutMs > 0) {
      overallTimer = setTimeout(() => {
        timedOut = true;
        killChild(child);
      }, spec.timeoutMs);
    }

    if (spec.input != null) {
      child.stdin.write(spec.input);
    }
    child.stdin.end();

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
      armSilence();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
      armSilence();
    });
    child.on('error', (err) => {
      const code = 'code' in err && typeof err.code === 'string' ? err.code : null;
      finish(null, { code, message: err.message });
    });
    child.on('close', (code) => {
      if (heartbeatKilled) {
        finish(null, {
          code: 'HEARTBEAT',
          message: `no stdout or stderr for ${heartbeatMs}ms`
        });
        return;
      }
      if (timedOut) {
        finish(null, { code: 'ETIMEDOUT', message: 'overall timeout' });
        return;
      }
      finish(code, null);
    });
  });
}

/**
 * Write the role receipt next to the app's other evidence.
 *
 * The engine field is the point: a later reader can see whether the artifact
 * was produced by grok or by the claude handoff, or by neither.
 *
 * @param {string} appDir absolute app directory
 * @param {{role: string, engine: string|null, artifact: string, handedOff: boolean, ok: boolean, reason: string|null}} receipt
 * @returns {string} path written
 */
export function writeRoleReceipt(appDir, receipt) {
  const dir = join(appDir, 'evidence', 'role-receipts');
  mkdirSync(dir, { recursive: true });
  const body = {
    schema: 'redanvil.role-receipt/1',
    role: receipt.role,
    engine: receipt.engine,
    artifact: receipt.artifact,
    handedOff: receipt.handedOff,
    ok: receipt.ok,
    reason: receipt.reason
  };
  const path = join(dir, `${receipt.role}.json`);
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`);
  return path;
}

/**
 * Run grok, and claude only if grok could not run.
 *
 * @param {{
 *   prompt: string,
 *   cwd: string,
 *   timeoutMs: number,
 *   needsImages?: boolean,
 *   heartbeatMs?: number,
 *   role?: string,
 *   artifact?: string,
 *   appDir?: string,
 *   spawnImpl?: (spec: {bin: string, args: string[], cwd?: string, input?: string|null, timeoutMs?: number, heartbeatMs?: number}) => Promise<{status: number|null, stdout?: string, stderr?: string, error?: {code?: string|null, message?: string}|null}>
 * }} opts
 * @returns {Promise<{engine: string|null, handedOff: boolean, ok: boolean, status: number|null, stdout: string, stderr: string, reason: string|null, receiptPath: string|null}>}
 */
export async function runAgentWithFailover(opts) {
  const spawnImpl = opts.spawnImpl ?? spawnTracked;
  const heartbeatMs = opts.heartbeatMs ?? HEARTBEAT_SILENCE_MS;
  const promptFile = join(
    tmpdir(),
    `redanvil-role-prompt-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.md`
  );
  writeFileSync(promptFile, opts.prompt, 'utf8');

  /** @type {{status: number|null, stdout?: string, stderr?: string, error?: {code?: string|null, message?: string}|null}} */
  let grokRes;
  try {
    grokRes = await spawnImpl({
      bin: 'grok',
      args: ['--always-approve', '--cwd', opts.cwd, '-m', GROK_MODEL, '--prompt-file', promptFile],
      cwd: opts.cwd,
      input: null,
      timeoutMs: opts.timeoutMs,
      heartbeatMs
    });
  } finally {
    if (existsSync(promptFile)) {
      try {
        unlinkSync(promptFile);
      } catch {
        // the child may already have removed it
      }
    }
  }

  const grokStdout = grokRes.stdout ?? '';
  const grokStderr = grokRes.stderr ?? '';

  /**
   * @param {{engine: string|null, handedOff: boolean, ok: boolean, status: number|null, stdout: string, stderr: string, reason: string|null}} result
   */
  const finish = (result) => {
    let receiptPath = null;
    if (opts.appDir && opts.role) {
      receiptPath = writeRoleReceipt(opts.appDir, {
        role: opts.role,
        engine: result.engine,
        artifact: opts.artifact ?? '',
        handedOff: result.handedOff,
        ok: result.ok,
        reason: result.reason
      });
    }
    return { ...result, receiptPath };
  };

  if (!grokCannotRun(grokRes)) {
    return finish({
      engine: 'grok',
      handedOff: false,
      ok: grokRes.status === 0,
      status: grokRes.status,
      stdout: grokStdout,
      stderr: grokStderr,
      reason: grokRes.status === 0 ? null : describeGrokFailure(grokRes)
    });
  }

  if (opts.needsImages) {
    const why = describeGrokFailure(grokRes);
    const reason =
      `grok cannot run (${why}); this role needs Grok Imagine image_gen ` +
      `and will not be handed to Claude`;
    return finish({
      engine: null,
      handedOff: false,
      ok: false,
      status: typeof grokRes.status === 'number' ? grokRes.status : 1,
      stdout: grokStdout,
      stderr: `${grokStderr}\n${reason}`.trim(),
      reason
    });
  }

  const claudeRes = await spawnImpl({
    bin: 'claude',
    args: ['-p', '--output-format', 'json', '--input-format', 'text'],
    cwd: opts.cwd,
    input: opts.prompt,
    timeoutMs: opts.timeoutMs,
    heartbeatMs: 0
  });
  const claudeStdout = claudeRes.stdout ?? '';
  const claudeStderr = claudeRes.stderr ?? '';
  return finish({
    engine: 'claude',
    handedOff: true,
    ok: claudeRes.status === 0,
    status: claudeRes.status,
    stdout: claudeStdout,
    stderr: claudeStderr,
    reason: claudeRes.status === 0 ? `handed off: ${describeGrokFailure(grokRes)}` : describeGrokFailure(grokRes)
  });
}
