/**
 * u-test-runners: each lane independently; green unit must not hide red/missing browser/VRT.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  detectRunners,
  runTestRunners
} from '../scripts/checks/u-test-runners.mjs';

/** Runner shape returned by detectRunners. */
type DetectedRunner = {
  name: string;
  configured: boolean;
  required?: boolean;
  command: string;
  args: string[];
  missingReason?: string;
};

/** Result shape from runOneRunner. */
type RunnerResult = {
  name: string;
  passed: boolean;
  output: string;
  exitCode: number | null;
};

describe('detectRunners', () => {
  it('detects vitest-unit from vitest.config.ts and requires browser + vrt', () => {
    const dir = mkdtempSync(join(tmpdir(), 'runners-v-'));
    try {
      writeFileSync(join(dir, 'vitest.config.ts'), 'export default {}\n');
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 't' }));
      const runners = detectRunners(dir);
      const names = runners.map((r: DetectedRunner) => r.name);
      expect(names).toContain('vitest-unit');
      expect(names).toContain('vitest-browser');
      expect(names).toContain('vitest-vrt');
      // Bare vitest.config without browser/vrt: those lanes are unconfigured required.
      expect(runners.find((r: DetectedRunner) => r.name === 'vitest-browser')?.configured).toBe(
        false
      );
      expect(runners.find((r: DetectedRunner) => r.name === 'vitest-vrt')?.configured).toBe(false);
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

  it('detects all four lanes when multi-project scaffold config is present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'runners-4-'));
    try {
      writeFileSync(
        join(dir, 'vitest.config.ts'),
        `
export default {
  test: {
    projects: [
      { test: { name: 'unit' } },
      { test: { name: 'browser', browser: { enabled: true } } },
      { test: { name: 'vrt', browser: { enabled: true } } }
    ]
  }
}
`
      );
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 't',
          scripts: {
            test: 'vitest run',
            'test:browser': 'vitest run --project browser',
            'test:vrt': 'vitest run --project vrt'
          }
        })
      );
      mkdirSync(join(dir, 'src'), { recursive: true });
      writeFileSync(
        join(dir, 'src', 'shell.vrt.test.ts'),
        'await expect(x).toHaveScreenshot("a.png");\n'
      );
      mkdirSync(join(dir, 'tests'), { recursive: true });
      writeFileSync(join(dir, 'tests', 'test_x.py'), 'def test_ok():\n  assert True\n');

      const runners = detectRunners(dir);
      const byName = Object.fromEntries(runners.map((r: DetectedRunner) => [r.name, r]));
      expect(byName['vitest-unit']?.configured).toBe(true);
      expect(byName['vitest-browser']?.configured).toBe(true);
      expect(byName['vitest-vrt']?.configured).toBe(true);
      expect(byName['pytest']?.configured).toBe(true);
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
              {
                name: 'vitest-unit',
                configured: true,
                required: true,
                command: 'x',
                args: []
              },
              {
                name: 'pytest',
                configured: true,
                required: true,
                command: 'y',
                args: []
              }
            ],
            run: (_d: string, runner: DetectedRunner): RunnerResult => ({
              name: runner.name,
              passed: runner.name === 'vitest-unit',
              output: `${runner.name} output`,
              exitCode: runner.name === 'vitest-unit' ? 0 : 1
            })
          }
        );
      } catch (err) {
        if (!(err instanceof Error) || err.message !== 'STOP') throw err;
      }
      expect(captured).toMatch(/vitest-unit/);
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
              {
                name: 'vitest-unit',
                configured: true,
                required: true,
                command: 'x',
                args: []
              },
              {
                name: 'vitest-browser',
                configured: true,
                required: true,
                command: 'x',
                args: []
              },
              {
                name: 'vitest-vrt',
                configured: true,
                required: true,
                command: 'x',
                args: []
              }
            ],
            run: (d: string, runner: DetectedRunner): RunnerResult => ({
              name: runner.name,
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
