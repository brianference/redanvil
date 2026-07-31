import { describe, it, expect } from 'vitest';
import { runCommand } from '../src/process/run';
import { pipedVerifiers } from '../scripts/checks/ci-exit-code-integrity.mjs';

/**
 * Delegation and process failures that each cost real time.
 *
 * None of these are about the code a build produces. They are about the harness
 * that produces it, which had no tests at all — so a broken harness looked
 * exactly like a model that declined to help.
 */

describe('runCommand refuses an argv the platform cannot carry', () => {
  it('refuses an oversized argv instead of letting the OS raise ENAMETOOLONG', async () => {
    // Inlining a 60KB evidence file into a Grok prompt hit the Windows ~32KB
    // command-line ceiling. The spawn died with an errno naming neither the
    // argument nor the caller, before the model saw anything.
    const huge = 'x'.repeat(20_000);
    const result = await runCommand('node', ['-e', huge]);
    expect(result.code).toBeNull();
    expect(result.stderr).toMatch(/over the \d+-byte ceiling/);
    expect(result.stderr).toMatch(/pass its path/);
  });

  it('still runs a normal argv', async () => {
    // The positive control: a ceiling that rejected everything would pass the
    // test above and be useless.
    const result = await runCommand('node', ['-e', 'process.stdout.write("ok")']);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('ok');
  });
});

describe('ci-exit-code-integrity', () => {
  it('flags a verification command whose exit code a filter replaces', () => {
    const yaml = ['jobs:', '  t:', '    steps:', '      - run: npx vitest run | tail -5'].join(
      '\n'
    );
    const hits = pipedVerifiers(yaml);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.text).toMatch(/vitest/);
  });

  it('allows a pipe used to FIND something rather than to verify', () => {
    // grep for a string is a search, not a verification whose code gates CI.
    const yaml = ['jobs:', '  t:', '    steps:', '      - run: cat README.md | grep -c anvil'].join(
      '\n'
    );
    expect(pipedVerifiers(yaml)).toHaveLength(0);
  });

  it('exempts a workflow that sets pipefail, because that is the fix', () => {
    const yaml = [
      'jobs:',
      '  t:',
      '    steps:',
      '      - run: |',
      '          set -o pipefail',
      '          npx vitest run | tail -5'
    ].join('\n');
    expect(pipedVerifiers(yaml)).toHaveLength(0);
  });

  it('ignores commented-out lines', () => {
    const yaml = ['jobs:', '  t:', '    steps:', '      # - run: npx vitest run | tail -5'].join(
      '\n'
    );
    expect(pipedVerifiers(yaml)).toHaveLength(0);
  });
});
