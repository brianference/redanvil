/**
 * Known-answer fixtures for fe-light-dark paint measurement.
 *
 * A page whose hero is hardcoded dark MUST fail in light mode.
 * A fully tokenised page MUST pass.
 * Attribute-only checks cannot see either case correctly.
 */
import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRubric } from '../src/rubric/index';
import { APP_CHECKS } from '../src/commands/gate';
import {
  effectivelySamePaint,
  paintDiffFailures,
  relativeLuminance
} from '../scripts/checks/fe-light-dark.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, '..', 'scripts', 'checks', 'fe-light-dark.mjs');
const FIXTURES = join(here, 'fixtures', 'theme-paint');

/**
 * Run the real CLI against a fixture HTML file.
 *
 * @param fixtureFile - Basename under fixtures/theme-paint.
 * @returns Exit code and combined output.
 */
function runFixture(fixtureFile: string): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      SCRIPT,
      '--fixture',
      join(FIXTURES, fixtureFile)
    ]);
    let out = '';
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      out += d.toString();
    });
    child.on('close', (code) => resolve({ code: code ?? 1, out }));
  });
}

describe('fe-light-dark registration', () => {
  it('is a det blocker wired into APP_CHECKS', () => {
    const rule = loadRubric().find((r) => r.id === 'fe-light-dark');
    expect(rule?.method).toBe('det');
    expect(rule?.severity).toBe('blocker');
    expect(APP_CHECKS.map((c) => c.ruleId)).toContain('fe-light-dark');
  });
});

describe('fe-light-dark pure paint helpers', () => {
  it('treats near-black hero tokens as the same paint', () => {
    // #0e1419 vs #06090c — the az-planting-calendar light/dark hero pair.
    const light = { r: 14, g: 20, b: 25 };
    const dark = { r: 6, g: 9, b: 12 };
    expect(effectivelySamePaint(light, dark)).toBe(true);
    expect(Math.abs(relativeLuminance(14, 20, 25) - relativeLuminance(6, 9, 12))).toBeLessThan(
      0.04
    );
  });

  it('treats a real light/dark surface pair as different paint', () => {
    const light = { r: 255, g: 255, b: 255 };
    const dark = { r: 20, g: 26, b: 33 };
    expect(effectivelySamePaint(light, dark)).toBe(false);
  });

  it('flags a region that did not change between themes', () => {
    const light = [{ name: 'region-0:section.hero', css: 'rgb(14,20,25)', r: 14, g: 20, b: 25, a: 255 }];
    const dark = [{ name: 'region-0:section.hero', css: 'rgb(6,9,12)', r: 6, g: 9, b: 12, a: 255 }];
    const fails = paintDiffFailures(light, dark);
    expect(fails.length).toBeGreaterThan(0);
    expect(fails[0]).toMatch(/hero|unchanged/i);
  });
});

describe('fe-light-dark known-answer fixtures', () => {
  it('FAILS a page whose hero is hardcoded dark in both themes', async () => {
    const { code, out } = await runFixture('hardcoded-hero.html');
    expect(out, out).toMatch(/FAIL|unchanged/i);
    expect(code, out).toBe(1);
  }, 120_000);

  it('PASSES a fully tokenised page whose landmarks flip paint', async () => {
    const { code, out } = await runFixture('tokenised.html');
    expect(out, out).toMatch(/PASS/);
    expect(code, out).toBe(0);
  }, 120_000);
});
