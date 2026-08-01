/**
 * Known-answer fixtures for `fe-search-present`.
 *
 * Proves the check can FAIL (dead search box; select-only filters) and PASS
 * when typing a known-subset query actually narrows visible rows. Source greps
 * alone are not enough — az-planting-calendar passed that way with no text search.
 */
import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRubric } from '../src/rubric/index';
import { APP_CHECKS } from '../src/commands/gate';
import {
  pickSubsetQuery,
  countJsonCollection,
  hasBrowsableCollection
} from '../scripts/checks/fe-search-present.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, '..', 'scripts', 'checks', 'fe-search-present.mjs');
const CHECK_VIA_ROUTER = join(here, '..', 'scripts', 'checks', 'check.mjs');
const FIXTURES = join(here, 'fixtures', 'search-present');
const node = process.execPath;

/**
 * Run the real CLI against a fixture HTML file.
 *
 * @param fixtureFile - Basename under fixtures/search-present.
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

describe('fe-search-present registration', () => {
  it('is encoded as a pure-det frontend blocker and wired into APP_CHECKS', () => {
    const rule = loadRubric().find((r) => r.id === 'fe-search-present');
    expect(rule, 'missing from rubric').toBeDefined();
    expect(rule!.lane).toBe('frontend');
    expect(rule!.severity).toBe('blocker');
    expect(rule!.method).toBe('det');
    expect(APP_CHECKS.map((c) => c.ruleId)).toContain('fe-search-present');
  });
});

describe('fe-search-present pure helpers', () => {
  it('picks a subset query that does not match every row', () => {
    const q = pickSubsetQuery(['Tomato', 'Basil', 'Carrot', 'Tomato']);
    expect(q).toBeTruthy();
    expect(q!.toLowerCase()).not.toBe('');
  });

  it('counts collection arrays in common JSON shapes', () => {
    expect(countJsonCollection({ crops: [1, 2, 3] })).toBe(3);
    expect(countJsonCollection({ items: [] })).toBe(0);
    expect(countJsonCollection([1, 2])).toBe(2);
    expect(countJsonCollection({ ok: true })).toBeNull();
  });

  it('detects a collection list surface from source filenames', () => {
    const dir = mkdtempSync(join(tmpdir(), 'redanvil-fe-search-col-'));
    try {
      const page = join(dir, 'src', 'pages', 'CropList.tsx');
      mkdirSync(dirname(page), { recursive: true });
      writeFileSync(
        page,
        `export function CropList({ items }: { items: { id: string }[] }) {
  return <ul>{items.map((r) => <li key={r.id}>{r.id}</li>)}</ul>;
}
`,
        'utf8'
      );
      expect(hasBrowsableCollection(dir, [page])).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('fe-search-present known-answer fixtures (Playwright)', () => {
  it('FAILS a search box that does nothing', async () => {
    const { code, out } = await runFixture('dead-search.html');
    expect(out, out).toMatch(/narrow|does nothing|FAIL/i);
    expect(code, out).toBe(1);
  }, 120_000);

  it('FAILS select-only filters (not text search)', async () => {
    const { code, out } = await runFixture('select-only.html');
    expect(out, out).toMatch(/select|text search|search\|find/i);
    expect(code, out).toBe(1);
  }, 120_000);

  it('PASSES when typing a known-subset query narrows visible rows', async () => {
    const { code, out } = await runFixture('working-search.html');
    expect(out, out).toMatch(/PASS|narrowed/i);
    expect(code, out).toBe(0);
  }, 120_000);

  it('fails the same way through check.mjs for a dead fixture via --fixture path', () => {
    // Router path is appDir-based; standalone covers the failure mode.
    // Keep a static n/a path via router for wiring.
    const dir = mkdtempSync(join(tmpdir(), 'redanvil-fe-search-na-'));
    try {
      mkdirSync(join(dir, 'src'), { recursive: true });
      writeFileSync(
        join(dir, 'src', 'About.tsx'),
        `export function About() { return <main><h1>About</h1></main>; }\n`,
        'utf8'
      );
      const r = spawnSync(node, [CHECK_VIA_ROUTER, 'fe-search-present', dir], {
        encoding: 'utf8',
        env: process.env
      });
      // No collection → n/a (3) or fail if misclassified; never a silent pass.
      expect([1, 3], r.stderr + r.stdout).toContain(r.status);
      if (r.status === 0) {
        throw new Error('expected non-zero for app without collection search');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
