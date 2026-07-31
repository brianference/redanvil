import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadRubric } from '../src/rubric/index';
import { APP_CHECKS } from '../src/commands/gate';

/**
 * u-claims-covered: an unimplemented promise fails loudly.
 *
 * The two existing inversions cannot see a feature that was never built. The
 * control audit inventories the RUNNING page, so a feature with no UI renders
 * no control; the API check inventories `functions/api/**`, so a feature with
 * no endpoint serves no route. In both cases the app is simply smaller than its
 * specification and every check agrees it is fine.
 *
 * These cases use a real app shape rather than a mock, because the check reads
 * test files off disk and a fixture that is not on disk is not what it reads.
 */

const here = dirname(fileURLToPath(import.meta.url));
const CHECK = join(here, '..', 'scripts', 'checks', 'u-claims-covered.mjs');

/**
 * Run the real check against a directory.
 *
 * @param dir App directory.
 * @returns Exit status and combined output.
 */
function run(dir: string): { status: number; output: string } {
  const r = spawnSync('node', [CHECK, dir], { encoding: 'utf8' });
  return { status: r.status ?? -1, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/**
 * Build an app directory with the given claims and test titles.
 *
 * @param features Claimed features.
 * @param testTitles Titles written into a spec file.
 * @returns Path to the app.
 */
async function appWith(
  features: { id: string; name: string }[],
  testTitles: string[]
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'redanvil-claims-'));
  await mkdir(join(dir, '.redanvil'), { recursive: true });
  await mkdir(join(dir, 'tests'), { recursive: true });
  await writeFile(
    join(dir, '.redanvil', 'claims.json'),
    JSON.stringify({
      kind: 'claims',
      slug: 'demo',
      features: features.map((f) => ({ ...f, behavior: 'b', acceptance: ['a'], mvp: true }))
    })
  );
  if (testTitles.length > 0) {
    await writeFile(
      join(dir, 'tests', 'app.spec.ts'),
      testTitles.map((t) => `test('${t}', async () => {});`).join('\n')
    );
  }
  return dir;
}

describe('u-claims-covered', () => {
  it('FAILS a feature the PRD promised and no test names', async () => {
    const dir = await appWith(
      [
        { id: 'F1', name: 'Browse and search flights' },
        { id: 'F2', name: 'Hotel booking' }
      ],
      ['browse and search flights returns rows']
    );
    const { status, output } = run(dir);
    expect(status, output).toBe(1);
    expect(output).toContain('Hotel booking');
    // The covered one must NOT be reported; a check that lists everything is
    // as uninformative as one that lists nothing.
    expect(output).not.toContain('F1');
    await rm(dir, { recursive: true, force: true });
  });

  it('PASSES when every claim is named', async () => {
    const dir = await appWith(
      [{ id: 'F1', name: 'Round trip pairing' }],
      ['a real round trip returns pairs whose total is out plus in']
    );
    const { status, output } = run(dir);
    expect(status, output).toBe(0);
    await rm(dir, { recursive: true, force: true });
  });

  it('requires EVERY significant word, not just one', async () => {
    // "Browse & search Flights" must not be satisfied by any test containing
    // "search". Matching on a single word would pass almost any suite.
    const dir = await appWith(
      [{ id: 'F1', name: 'Browse and search flights' }],
      ['search the airport typeahead']
    );
    const { status, output } = run(dir);
    expect(status, output).toBe(1);
    await rm(dir, { recursive: true, force: true });
  });

  it('FAILS an app with claims and no tests at all', async () => {
    const dir = await appWith([{ id: 'F1', name: 'Round trip pairing' }], []);
    const { status, output } = run(dir);
    expect(status, output).toBe(1);
    expect(output).toMatch(/not one test file/);
    await rm(dir, { recursive: true, force: true });
  });

  it('is NOT APPLICABLE for an app that declares no claims', async () => {
    // Apps scaffolded before claims existed have nothing to check against.
    // n/a removes the rule from the denominator rather than inventing a pass.
    const dir = await mkdtemp(join(tmpdir(), 'redanvil-claims-none-'));
    const { status, output } = run(dir);
    expect(status, output).toBe(3);
    await rm(dir, { recursive: true, force: true });
  });

  it('is bound to the rubric and run by the gate', () => {
    const rule = loadRubric().find((r) => r.id === 'u-claims-covered');
    expect(rule?.severity).toBe('blocker');
    expect(rule?.method).toBe('det');
    expect(APP_CHECKS.map((c) => c.ruleId)).toContain('u-claims-covered');
  });
});
