/**
 * u-test-runners: failing pytest + passing vitest must FAIL with both named.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  detectRunners,
  runTestRunners,
  type DetectedRunner,
  type RunnerResult
} from '../scripts/checks/u-test-runners.mjs';

describe('detectRunners', () => {
  it('detects vitest from vitest.config.ts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'runners-v-'));
    try {
      writeFileSync(join(dir, 'vitest.config.ts'), 'export default {}\n');
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 't' }));
      const runners = detectRunners(dir);
      expect(runners.map((r: DetectedRunner) => r.name)).toContain('vitest');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects pytest from python tests/', () => {
    const dir = mkdtempSync(join(tmpdir(), 'runners-p-'));
    try {
      mkdirSync(join(dir, 'tests'), { recursive: true });
      writeFileSync(join(dir, 'tests', 'test_x.py'), 'def test_ok():\n  assert True\n');
      const runners = detectRunners(dir);
      expect(runners.map((r: DetectedRunner) => r.name)).toContain('pytest');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('runTestRunners', () => {
  it('reports both runners when mixed results (proof)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'runners-proof-'));
    let captured = '';
    try {
      try {
        runTestRunners(
          dir,
          {
            pass: () => {
              throw new Error('unexpected pass');
            },
            fail: (m?: string) => {
              captured = m ?? '';
              throw new Error('STOP');
            },
            notApplicable: () => {
              throw new Error('unexpected n/a');
            }
          },
          {
            detect: (): DetectedRunner[] => [
              { name: 'vitest', configured: true, command: 'x', args: [] },
              { name: 'pytest', configured: true, command: 'y', args: [] }
            ],
            run: (_d: string, runner: DetectedRunner): RunnerResult => ({
              name: runner.name,
              passed: runner.name === 'vitest',
              output: `${runner.name} output`,
              exitCode: runner.name === 'vitest' ? 0 : 1
            })
          }
        );
      } catch (err) {
        if (!(err instanceof Error) || err.message !== 'STOP') throw err;
      }
      expect(captured).toMatch(/vitest/);
      expect(captured).toMatch(/pytest/);
      expect(captured).toMatch(/FAIL/);
      expect(captured).toMatch(/PASS/);
      console.log('u-test-runners mixed output:\n', captured);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes when every detected runner passes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'runners-ok-'));
    let passed = false;
    try {
      try {
        runTestRunners(
          dir,
          {
            pass: () => {
              passed = true;
              throw new Error('STOP');
            },
            fail: (m?: string) => {
              throw new Error(`unexpected fail: ${m}`);
            },
            notApplicable: () => {
              throw new Error('n/a');
            }
          },
          {
            detect: (): DetectedRunner[] => [
              { name: 'vitest', configured: true, command: 'x', args: [] }
            ],
            run: (): RunnerResult => ({
              name: 'vitest',
              passed: true,
              output: 'ok',
              exitCode: 0
            })
          }
        );
      } catch (err) {
        if (!(err instanceof Error) || err.message !== 'STOP') throw err;
      }
      expect(passed).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
