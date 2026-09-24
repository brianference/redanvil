/**
 * Grok stays first. Claude runs only when grok never got to do the work.
 *
 * FAIL INPUT: exit 0 whose stdout says "spending limit" must not hand off.
 * FAIL INPUT: a logo run (needsImages) must not hand off on a 403.
 * FAIL INPUT: a silent child must be killed by the heartbeat, not left running.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import {
  describeGrokFailure,
  grokCannotRun,
  HEARTBEAT_SILENCE_MS,
  runAgentWithFailover,
  spawnTracked
} from '../roles/agent-failover.mjs';
import { runDesignRole, designRoleNeedsImages } from '../roles/design-role.mjs';
import { runGrokRole } from '../roles/grok-role.mjs';

/** @type {string[]} */
const scratchDirs = [];

after(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * @returns {string}
 */
function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'redanvil-failover-'));
  scratchDirs.push(dir);
  return dir;
}

describe('grokCannotRun', () => {
  test('exit 0 is not a handoff even when the output says spending limit', () => {
    assert.equal(
      grokCannotRun({ status: 0, stdout: 'fixed the spending limit check', stderr: '' }),
      false
    );
    assert.equal(
      grokCannotRun({ status: 0, stdout: '', stderr: 'HTTP 403 Forbidden' }),
      false
    );
  });

  test('a non-zero 403 or spending limit is a handoff, and a plain exit 1 is not', () => {
    assert.equal(
      grokCannotRun({ status: 1, stdout: '', stderr: 'HTTP 403 Forbidden' }),
      true
    );
    assert.equal(
      grokCannotRun({ status: 1, stdout: 'usage', stderr: 'spending limit reached' }),
      true
    );
    assert.equal(grokCannotRun({ status: 1, stdout: '', stderr: 'edit failed' }), false);
    assert.equal(
      grokCannotRun({ status: null, stdout: '', stderr: '', error: { code: 'ETIMEDOUT' } }),
      true
    );
    assert.equal(
      grokCannotRun({ status: null, stdout: '', stderr: '', error: { code: 'HEARTBEAT' } }),
      true
    );
  });
});

describe('runAgentWithFailover', () => {
  test('FAIL INPUT: exit 0 with spending-limit text does not call claude', async () => {
    /** @type {string[]} */
    const bins = [];
    const result = await runAgentWithFailover({
      prompt: 'fix the spending limit check\n"quotes" & more',
      cwd: scratch(),
      timeoutMs: 1000,
      heartbeatMs: 0,
      spawnImpl: async (spec) => {
        bins.push(spec.bin);
        assert.equal(spec.args.includes(spec.input ?? 'nope'), false);
        assert.equal(spec.args.includes('-p'), false);
        const fileFlag = spec.args.indexOf('--prompt-file');
        assert.ok(fileFlag > 0);
        assert.equal(readFileSync(spec.args[fileFlag + 1], 'utf8'), 'fix the spending limit check\n"quotes" & more');
        return { status: 0, stdout: 'fixed the spending limit check', stderr: '' };
      }
    });
    assert.deepEqual(bins, ['grok']);
    assert.equal(result.handedOff, false);
    assert.equal(result.engine, 'grok');
    assert.equal(result.ok, true);
  });

  test('a 403 hands off via claude -p on stdin, and the prompt is not an argv entry', async () => {
    const prompt = 'In the app, fix the gate.\nsecond line & "quoted"';
    /** @type {{bin: string, args: string[], input: string|null|undefined}[]} */
    const calls = [];
    const result = await runAgentWithFailover({
      prompt,
      cwd: scratch(),
      timeoutMs: 1000,
      heartbeatMs: 0,
      role: 'brainstorm',
      artifact: 'docs/FEATURES.md',
      appDir: scratch(),
      spawnImpl: async (spec) => {
        calls.push({ bin: spec.bin, args: spec.args, input: spec.input });
        if (spec.bin === 'grok') return { status: 1, stdout: '', stderr: '403 spending limit reached' };
        return { status: 0, stdout: 'claude done', stderr: '' };
      }
    });
    assert.deepEqual(calls.map((call) => call.bin), ['grok', 'claude']);
    assert.equal(calls[1].args[0], '-p');
    assert.equal(calls[1].input, prompt);
    assert.equal(calls[1].args.includes(prompt), false);
    assert.equal(result.handedOff, true);
    assert.equal(result.engine, 'claude');
    const receipt = JSON.parse(readFileSync(result.receiptPath, 'utf8'));
    assert.equal(receipt.engine, 'claude');
    assert.equal(receipt.artifact, 'docs/FEATURES.md');
    assert.equal(receipt.handedOff, true);
  });

  test('a plain non-zero exit is grok failing, not a handoff', async () => {
    /** @type {string[]} */
    const bins = [];
    const result = await runAgentWithFailover({
      prompt: 'do the thing',
      cwd: scratch(),
      timeoutMs: 1000,
      heartbeatMs: 0,
      spawnImpl: async (spec) => {
        bins.push(spec.bin);
        return { status: 1, stdout: '', stderr: 'edit failed' };
      }
    });
    assert.deepEqual(bins, ['grok']);
    assert.equal(result.handedOff, false);
    assert.equal(result.engine, 'grok');
    assert.equal(result.ok, false);
    assert.equal(describeGrokFailure({ status: 1, stderr: 'edit failed' }), 'exit 1');
  });

  test('FAIL INPUT: an image role does not hand a 403 to claude', async () => {
    /** @type {string[]} */
    const bins = [];
    const appDir = scratch();
    const result = await runAgentWithFailover({
      prompt: 'generate five marks with image_gen',
      cwd: appDir,
      timeoutMs: 1000,
      heartbeatMs: 0,
      needsImages: true,
      role: 'logo',
      artifact: 'design-refs/logos/DECISION.md',
      appDir,
      spawnImpl: async (spec) => {
        bins.push(spec.bin);
        return { status: 1, stdout: '', stderr: 'HTTP 403 Forbidden' };
      }
    });
    assert.deepEqual(bins, ['grok']);
    assert.equal(result.handedOff, false);
    assert.equal(result.engine, null);
    assert.equal(result.ok, false);
    assert.match(result.reason, /image_gen/);
    assert.match(result.reason, /Claude/);
    const receipt = JSON.parse(readFileSync(result.receiptPath, 'utf8'));
    assert.equal(receipt.engine, null);
    assert.equal(receipt.handedOff, false);
  });

  test('logo passes needsImages and a judgement role does not', async () => {
    assert.equal(designRoleNeedsImages('logo'), true);
    assert.equal(designRoleNeedsImages('palette'), false);
    assert.equal(designRoleNeedsImages('build'), false);
    /** @type {{needsImages?: boolean, role?: string}[]} */
    const calls = [];
    const runAgent = async (spec) => {
      calls.push({ needsImages: spec.needsImages, role: spec.role });
      return {
        engine: 'grok',
        handedOff: false,
        ok: true,
        status: 0,
        stdout: 'ok',
        stderr: '',
        reason: null,
        receiptPath: null
      };
    };
    const repoRoot = scratch();
    await runDesignRole({ role: 'logo', slug: 'demo-app', repoRoot, runAgent });
    await runDesignRole({ role: 'palette', slug: 'demo-app', repoRoot, runAgent });
    await runGrokRole({ role: 'brainstorm', slug: 'demo-app', repoRoot, runAgent });
    assert.equal(calls[0].needsImages, true);
    assert.equal(calls[0].role, 'logo');
    assert.equal(calls[1].needsImages, false);
    assert.equal(calls[2].needsImages, false);
    assert.equal(calls[2].role, 'brainstorm');
  });
});

describe('heartbeat', () => {
  test('the default silence bound is 8 minutes', () => {
    assert.equal(HEARTBEAT_SILENCE_MS, 8 * 60 * 1000);
  });

  test('FAIL INPUT: a silent child is killed and counted as a hang', async () => {
    const result = await spawnTracked({
      bin: process.execPath,
      args: ['-e', 'setInterval(() => {}, 1000)'],
      heartbeatMs: 400,
      timeoutMs: 5000
    });
    assert.equal(result.status, null);
    assert.equal(result.error && result.error.code, 'HEARTBEAT');
  });

  test('a child that prints and exits is not treated as a hang', async () => {
    const result = await spawnTracked({
      bin: process.execPath,
      args: ['-e', 'process.stdout.write(process.argv[1])', 'hello world & "x"'],
      heartbeatMs: 2000,
      timeoutMs: 5000
    });
    assert.equal(result.status, 0);
    assert.equal(result.error, null);
    assert.equal(result.stdout, 'hello world & "x"');
  });
});

test('an exhausted Grok balance (402) hands off, with a readable reason', () => {
  // The real stderr of an exhausted Grok Build account, captured 2026-09-23.
  const res = {
    status: 1,
    stdout: '',
    stderr:
      'Error: Internal error: { "message": "API error (status 402 Payment Required): Grok Build usage balance exhausted", "http_status": 402 }'
  };
  assert.equal(grokCannotRun(res), true);
  assert.equal(describeGrokFailure(res), 'usage balance exhausted (402)');
});

test('task failures that merely contain 402 or 403 do not hand off', () => {
  for (const stderr of [
    'AssertionError: expected 200 to be 403',
    '    at render (src/App.tsx:402:11)',
    'wrote 402 bytes to dist/index.html',
    'status 403 returned by /api/admin in the acceptance test'
  ]) {
    assert.equal(grokCannotRun({ status: 1, stdout: '', stderr }), false, stderr);
  }
  assert.equal(grokCannotRun({ status: 1, stdout: '', stderr: 'HTTP 403 Forbidden' }), true);
});
