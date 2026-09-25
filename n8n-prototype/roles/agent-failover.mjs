/**
 * Run one role on the engine the owner allows for it.
 *
 * Owner rule (2026-09-24, orchestrator/scripts/lib/engine-policy.mjs): Grok
 * runs ONLY the design roles in GROK_ALLOWED_ROLES (logo, palette, layout).
 * Every other role runs on Claude and never falls back to Grok. When Claude
 * cannot run, the role fails closed.
 *
 * Design roles keep the older order: grok first, Claude only when grok never
 * got to do the work (`grokCannotRun`). The prompt goes to grok through
 * `--prompt-file` and to claude on stdin, and both children are spawned with
 * `shell: false`. A hang is either the overall timeout or a stretch of
 * silence on stdout and stderr.
 *
 * Image roles stay on Grok. Grok Imagine (`image_gen`) is not a Claude tool;
 * handing that prompt to Claude produces a write-up instead of the marks.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ENGINE_CLAUDE, ENGINE_GROK, mayUseGrok } from '../../orchestrator/scripts/lib/engine-policy.mjs';

/**
 * Argv for a headless Claude role run. The prompt is stdin, never argv
 * (Windows command-line limit, cmd.exe quoting). `--permission-mode auto` was
 * measured on 2026-09-24: a `-p` run ran a Bash command and wrote a file with
 * `permission_denials: []`. Without a mode, headless edits are denied.
 */
export const CLAUDE_ROLE_ARGS = Object.freeze([
  '-p',
  '--output-format',
  'json',
  '--input-format',
  'text',
  '--permission-mode',
  'auto'
]);

/** Anthropic API statuses that mean "wait", not "the work failed". */
const CLAUDE_RATE_LIMIT_STATUSES = new Set([429, 529]);

/**
 * Classify a `claude -p --output-format json` result.
 *
 * Exit 0 alone is not success: an envelope with `is_error: true` (a usage
 * limit or API error) is a failure whatever the exit code. No parseable
 * envelope is also a failure, because `--output-format json` prints one when
 * the run completes.
 *
 * FAIL INPUT: `{status: 0, stdout: '{"is_error":true,"api_error_status":429}'}` → ok false.
 * FAIL INPUT: `{status: 0, stdout: 'not json'}` → ok false.
 *
 * @param {{status: number|null, stdout?: string, stderr?: string, error?: {code?: string|null, message?: string}|null}} res
 * @returns {{ok: boolean, rateLimited: boolean, reason: string|null}}
 */
export function classifyClaudeRun(res) {
  if (res.status === null) {
    const code = res.error?.code ?? 'no exit status';
    return { ok: false, rateLimited: false, reason: `claude did not finish (${code})` };
  }
  /** @type {Record<string, unknown>|null} */
  let envelope = null;
  try {
    const parsed = JSON.parse(String(res.stdout ?? '').trim());
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) envelope = parsed;
  } catch {
    // Not an envelope: the process died before it could print one.
  }
  if (!envelope) {
    return {
      ok: false,
      rateLimited: false,
      reason: `claude exit ${res.status} with no json envelope`
    };
  }
  const apiStatus = envelope.api_error_status;
  const rateLimited = typeof apiStatus === 'number' && CLAUDE_RATE_LIMIT_STATUSES.has(apiStatus);
  if (envelope.is_error === true || res.status !== 0) {
    return {
      ok: false,
      rateLimited,
      reason: `claude error: subtype=${String(envelope.subtype)} api_error_status=${String(apiStatus ?? 'none')} exit=${res.status}`
    };
  }
  return { ok: true, rateLimited: false, reason: null };
}

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
 * @typedef {{bin: string, args: string[], cwd?: string, input?: string|null, timeoutMs?: number, heartbeatMs?: number}} SpawnSpec
 * @typedef {{status: number|null, stdout?: string, stderr?: string, error?: {code?: string|null, message?: string}|null}} SpawnResult
 * @typedef {{engine: string|null, handedOff: boolean, ok: boolean, status: number|null, stdout: string, stderr: string, reason: string|null}} RoleOutcome
 */

/**
 * Spawn Claude for a role, prompt on stdin.
 *
 * No heartbeat: `--output-format json` prints nothing until the run ends, so
 * a silence timer would kill every healthy run. The overall bound applies.
 *
 * @param {(spec: SpawnSpec) => Promise<SpawnResult>} spawnImpl
 * @param {{prompt: string, cwd: string, timeoutMs: number}} opts
 * @returns {Promise<SpawnResult>}
 */
function spawnClaude(spawnImpl, opts) {
  return spawnImpl({
    bin: 'claude',
    args: [...CLAUDE_ROLE_ARGS],
    cwd: opts.cwd,
    input: opts.prompt,
    timeoutMs: opts.timeoutMs,
    heartbeatMs: 0
  });
}

/**
 * Turn a Claude spawn into a role outcome. `handedOff` records whether a
 * design role got here because grok could not run.
 *
 * @param {SpawnResult} claudeRes
 * @param {{handedOff: boolean, handoffWhy?: string}} ctx
 * @returns {RoleOutcome}
 */
function claudeOutcome(claudeRes, ctx) {
  const verdict = classifyClaudeRun(claudeRes);
  const prefix = ctx.handedOff && ctx.handoffWhy ? `handed off: ${ctx.handoffWhy}` : null;
  const reason = verdict.ok ? prefix : [prefix, verdict.reason].filter(Boolean).join('; ');
  // A zero exit with an is_error envelope is still a failed role.
  const failedStatus = typeof claudeRes.status === 'number' && claudeRes.status !== 0 ? claudeRes.status : 1;
  return {
    engine: ENGINE_CLAUDE,
    handedOff: ctx.handedOff,
    ok: verdict.ok,
    status: verdict.ok ? 0 : failedStatus,
    stdout: claudeRes.stdout ?? '',
    stderr: claudeRes.stderr ?? '',
    reason
  };
}

/**
 * Run one role on its allowed engine.
 *
 * - Role not in GROK_ALLOWED_ROLES (or no role): Claude only. Grok is never
 *   spawned, even when Claude fails; the outcome is `ok: false` instead.
 * - Design role: grok first, and Claude only when grok could not run and the
 *   role does not need Grok Imagine.
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
 *   spawnImpl?: (spec: SpawnSpec) => Promise<SpawnResult>
 * }} opts
 * @returns {Promise<RoleOutcome & {receiptPath: string|null}>}
 */
export async function runAgentWithFailover(opts) {
  const spawnImpl = opts.spawnImpl ?? spawnTracked;

  /**
   * @param {RoleOutcome} result
   * @returns {RoleOutcome & {receiptPath: string|null}}
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

  if (!mayUseGrok(opts.role)) {
    const claudeRes = await spawnClaude(spawnImpl, opts);
    return finish(claudeOutcome(claudeRes, { handedOff: false }));
  }

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

  if (!grokCannotRun(grokRes)) {
    return finish({
      engine: ENGINE_GROK,
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

  const claudeRes = await spawnClaude(spawnImpl, opts);
  return finish(claudeOutcome(claudeRes, { handedOff: true, handoffWhy: describeGrokFailure(grokRes) }));
}
