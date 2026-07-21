import { describe, it, expect } from 'vitest';
import { runCommand, scrubbedEnv } from '../src/process/run';

describe('runCommand', () => {
  it('captures stdout and a zero exit code on success', async () => {
    const r = await runCommand(process.execPath, ['-e', "process.stdout.write('hi')"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('hi');
    expect(r.timedOut).toBe(false);
  });

  it('reports a non-zero exit code on failure', async () => {
    const r = await runCommand(process.execPath, ['-e', 'process.exit(3)']);
    expect(r.code).toBe(3);
    expect(r.timedOut).toBe(false);
  });

  it('kills and flags a process that exceeds the timeout, without hanging', async () => {
    const r = await runCommand(
      process.execPath,
      ['-e', 'setTimeout(() => {}, 10000)'],
      { timeoutMs: 200 }
    );
    expect(r.timedOut).toBe(true);
    expect(r.code).toBeNull();
    expect(r.durationMs).toBeLessThan(5000);
  });

  it('resolves (not rejects) when the command does not exist', async () => {
    const r = await runCommand('definitely-not-a-real-binary-xyz', []);
    expect(r.code).toBeNull();
    expect(r.stderr).toContain('spawn error');
  });
});

describe('scrubbedEnv', () => {
  it('withholds non-allowlisted secrets but keeps PATH', () => {
    process.env.REDANVIL_TEST_SECRET = 'shhh';
    const env = scrubbedEnv([]);
    expect(env.REDANVIL_TEST_SECRET).toBeUndefined();
    expect(env.PATH ?? env.Path).toBeTruthy();
    delete process.env.REDANVIL_TEST_SECRET;
  });

  it('passes through explicitly allowlisted variables', () => {
    process.env.REDANVIL_ALLOWED = 'ok';
    const env = scrubbedEnv(['REDANVIL_ALLOWED']);
    expect(env.REDANVIL_ALLOWED).toBe('ok');
    delete process.env.REDANVIL_ALLOWED;
  });
});
