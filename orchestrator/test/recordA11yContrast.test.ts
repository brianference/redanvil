import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { recordA11yContrast } from '../scripts/checks/record-a11y-contrast.mjs';
import { evaluateStandardTool } from '../scripts/checks/meas-standard-tool.mjs';

const tempDirs: string[] = [];

/**
 * Create a tracked temp repo root with an app subdirectory.
 * @returns Absolute repo-root path.
 */
function makeRepoRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'redanvil-a11y-record-'));
  tempDirs.push(dir);
  mkdirSync(join(dir, 'evidence', 'axe'), { recursive: true });
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('recordA11yContrast', () => {
  it('records a run.at that satisfies meas-standard-tool against the reports it just read', () => {
    const repoRoot = makeRepoRoot();
    const appDir = join(repoRoot, 'dashboard');
    mkdirSync(join(appDir, 'evidence'), { recursive: true });
    writeFileSync(
      join(repoRoot, 'evidence/axe/dashboard-dark.json'),
      JSON.stringify({ checkedAt: '2026-08-03T19:08:30.230Z', contrastViolationNodes: 0 })
    );
    writeFileSync(
      join(repoRoot, 'evidence/axe/dashboard-light.json'),
      JSON.stringify({ checkedAt: '2026-08-03T19:08:32.639Z', contrastViolationNodes: 0 })
    );

    const result = recordA11yContrast(appDir, 'dashboard', { repoRoot });
    expect(result.ok).toBe(true);

    const meta = JSON.parse(readFileSync(join(appDir, 'evidence/measurement-meta.json'), 'utf8'));
    expect(meta['fe-a11y-contrast'].tool).toBe('axe-core');

    const failures = evaluateStandardTool(meta, ['fe-a11y-contrast'], repoRoot);
    expect(failures).toEqual([]);
  });

  it('FAILS (does not silently record) when the dark report is missing', () => {
    const repoRoot = makeRepoRoot();
    const appDir = join(repoRoot, 'dashboard');
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      join(repoRoot, 'evidence/axe/dashboard-light.json'),
      JSON.stringify({ checkedAt: '2026-08-03T19:08:32.639Z', contrastViolationNodes: 0 })
    );

    const result = recordA11yContrast(appDir, 'dashboard', { repoRoot });
    expect(result.ok).toBe(false);
  });

  it('re-recording after the reports are regenerated stays synced (the real staleness bug this fixes)', () => {
    const repoRoot = makeRepoRoot();
    const appDir = join(repoRoot, 'dashboard');
    mkdirSync(join(appDir, 'evidence'), { recursive: true });
    const dark = join(repoRoot, 'evidence/axe/dashboard-dark.json');
    const light = join(repoRoot, 'evidence/axe/dashboard-light.json');
    writeFileSync(dark, JSON.stringify({ checkedAt: '2026-08-03T18:41:56.418Z' }));
    writeFileSync(light, JSON.stringify({ checkedAt: '2026-08-03T18:41:58.760Z' }));
    recordA11yContrast(appDir, 'dashboard', { repoRoot });

    // A later reverify pass re-runs a11y_audit and regenerates the reports
    // with a newer checkedAt, exactly like the real dashboard incident.
    writeFileSync(dark, JSON.stringify({ checkedAt: '2026-08-03T19:08:30.230Z' }));
    writeFileSync(light, JSON.stringify({ checkedAt: '2026-08-03T19:08:32.639Z' }));

    // Without re-recording, the OLD entry now pre-dates the new reports.
    const staleMeta = JSON.parse(readFileSync(join(appDir, 'evidence/measurement-meta.json'), 'utf8'));
    expect(evaluateStandardTool(staleMeta, ['fe-a11y-contrast'], repoRoot).length).toBeGreaterThan(0);

    // Re-running the recorder fixes it.
    recordA11yContrast(appDir, 'dashboard', { repoRoot });
    const freshMeta = JSON.parse(readFileSync(join(appDir, 'evidence/measurement-meta.json'), 'utf8'));
    expect(evaluateStandardTool(freshMeta, ['fe-a11y-contrast'], repoRoot)).toEqual([]);
  });
});
