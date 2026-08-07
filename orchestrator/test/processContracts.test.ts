import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain JS module, no types published
import { checkContract } from '../../n8n-prototype/contract-check.mjs';
// @ts-expect-error -- plain JS module, no types published
import { PROCESS, orderedSteps } from '../../n8n-prototype/process-map.mjs';

/**
 * The process-map contracts, under the project's own test runner.
 *
 * These began life as a bespoke harness (`verify-contracts.mjs`) that printed
 * its own PASS/BROKEN lines. That was a mistake twice over: it ignored the
 * vitest lane that already existed, and nothing in CI ran it — so the layer
 * proving every other check could quietly stop being executed and no one would
 * see it. A proof layer outside the test lane is the vacuous-proof-layer failure
 * wearing a different hat.
 *
 * Each case builds the input that SHOULD break a contract and asserts it breaks.
 * A check that cannot fail is not a check.
 */

const SCRATCH = join(tmpdir(), 'redanvil-process-contracts');
/** Provenance cases need a working `git rev-parse HEAD`, so they run in-repo. */
const REPO_SCRATCH = join(dirname(fileURLToPath(import.meta.url)), '.contract-scratch');

beforeAll(() => {
  for (const d of [SCRATCH, REPO_SCRATCH]) {
    rmSync(d, { recursive: true, force: true });
    mkdirSync(d, { recursive: true });
  }
});

afterAll(() => {
  for (const d of [SCRATCH, REPO_SCRATCH]) rmSync(d, { recursive: true, force: true });
});

/**
 * Write a file, creating parents.
 * @param root base directory
 * @param rel relative path
 * @param body file contents
 */
function put(root: string, rel: string, body: string): void {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body);
}

describe('artifact contracts fail on bad input', () => {
  it('a missing artifact fails', () => {
    const r = checkContract(SCRATCH, { path: 'nope/BRIEF.md', kind: 'file', minBytes: 10, why: 'x' });
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toContain('missing');
  });

  it('an artifact below the substance floor fails', () => {
    put(SCRATCH, 'thin/BRIEF.md', 'ok');
    const r = checkContract(SCRATCH, { path: 'thin/BRIEF.md', kind: 'file', minBytes: 500, why: 'x' });
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/needs 500B/);
  });

  it('a directory with too few artifacts fails', () => {
    put(SCRATCH, 'logos/mark-01.png', 'x'.repeat(50));
    const r = checkContract(SCRATCH, {
      path: 'logos',
      kind: 'dir',
      glob: '.png',
      minCount: 5,
      why: 'x'
    });
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/needs 5/);
  });

  it('an unfilled marker fails', () => {
    put(SCRATCH, 'blank/DECISION.md', 'Choice: TBD\n'.repeat(60));
    const r = checkContract(SCRATCH, {
      path: 'blank/DECISION.md',
      kind: 'file',
      mustNotContain: ['TBD'],
      why: 'x'
    });
    expect(r.ok).toBe(false);
  });

  it('a missing required statement fails', () => {
    put(SCRATCH, 'noforbid/DECISION.md', 'We picked option A.\n'.repeat(40));
    const r = checkContract(SCRATCH, {
      path: 'noforbid/DECISION.md',
      kind: 'file',
      mustContain: ['Forbidden'],
      why: 'x'
    });
    expect(r.ok).toBe(false);
  });
});

describe('evidence manifests must prove work, not list names', () => {
  it('a manifest of filenames only fails', () => {
    const names = Array.from({ length: 12 }, (_, i) => `app_view_${i}.png`);
    put(SCRATCH, 'names/MANIFEST.json', JSON.stringify({ appViews: names }));
    const r = checkContract(SCRATCH, {
      path: 'names/MANIFEST.json',
      kind: 'file',
      jsonDistinctHashes: 12,
      why: 'x'
    });
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/0 distinct content hash/);
  });

  it('one hash repeated twelve times fails', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ file: `r${i}.png`, sha256: 'a'.repeat(64) }));
    put(SCRATCH, 'dupe/MANIFEST.json', JSON.stringify({ renders: rows }));
    const r = checkContract(SCRATCH, {
      path: 'dupe/MANIFEST.json',
      kind: 'file',
      jsonDistinctHashes: 12,
      why: 'x'
    });
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/1 distinct content hash/);
  });

  it('twelve distinct hashes passes', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      file: `r${i}.png`,
      sha256: i.toString(16).padStart(64, '0')
    }));
    put(SCRATCH, 'hashed/MANIFEST.json', JSON.stringify({ renders: rows }));
    const r = checkContract(SCRATCH, {
      path: 'hashed/MANIFEST.json',
      kind: 'file',
      jsonDistinctHashes: 12,
      why: 'x'
    });
    expect(r.ok).toBe(true);
  });
});

describe('evidence freshness', () => {
  it('provenance recorded at another commit fails, and for that reason', () => {
    put(
      REPO_SCRATCH,
      'results/app.json',
      JSON.stringify({ provenance: { commit: 'f'.repeat(40), dirty: false }, pad: 'x'.repeat(300) })
    );
    const r = checkContract(REPO_SCRATCH, {
      path: 'results/app.json',
      kind: 'file',
      provenanceMatchesHead: true,
      why: 'x'
    });
    expect(r.ok).toBe(false);
    // Pinned to the cause. An earlier version of this case ran outside a git
    // repo, so it passed on "cannot resolve HEAD" and would have passed with the
    // commit comparison deleted entirely.
    expect(r.reasons.some((x: string) => /provenance is commit f{12} but HEAD is/.test(x))).toBe(true);
  });

  it('provenance measured on a dirty tree fails', () => {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: REPO_SCRATCH,
      encoding: 'utf8'
    }).trim();
    put(
      REPO_SCRATCH,
      'dirty/app.json',
      JSON.stringify({ provenance: { commit: head, dirty: true }, pad: 'x'.repeat(300) })
    );
    const r = checkContract(REPO_SCRATCH, {
      path: 'dirty/app.json',
      kind: 'file',
      provenanceMatchesHead: true,
      why: 'x'
    });
    expect(r.ok).toBe(false);
    expect(r.reasons.some((x: string) => /DIRTY tree/.test(x))).toBe(true);
  });

  it('provenance with no commit fails', () => {
    put(REPO_SCRATCH, 'nocommit/app.json', JSON.stringify({ finalScore: 100, pad: 'x'.repeat(300) }));
    const r = checkContract(REPO_SCRATCH, {
      path: 'nocommit/app.json',
      kind: 'file',
      provenanceMatchesHead: true,
      why: 'x'
    });
    expect(r.ok).toBe(false);
  });
});

describe('contracts do not fire on honest artifacts', () => {
  // Both are regressions this checker really produced.
  it('a document FORBIDDING placeholders is not failed for the word', () => {
    put(SCRATCH, 'good/BRIEF.md', 'Real brand mark, not emoji or letter placeholders.\n'.repeat(40));
    const r = checkContract(SCRATCH, {
      path: 'good/BRIEF.md',
      kind: 'file',
      minBytes: 100,
      mustNotContain: ['TBD', 'Lorem ipsum'],
      why: 'x'
    });
    expect(r.ok).toBe(true);
  });

  it('mustContain is case-insensitive, matching mustNotContain', () => {
    put(SCRATCH, 'case/DECISION.md', 'Specifically forbidden, and DECIDED.\n'.repeat(30));
    const r = checkContract(SCRATCH, {
      path: 'case/DECISION.md',
      kind: 'file',
      minBytes: 100,
      mustContain: ['Forbidden', 'decided'],
      why: 'x'
    });
    expect(r.ok).toBe(true);
  });
});

describe('the process map itself', () => {
  it('orders every step without a cycle and starts at the PRD', () => {
    const ids = orderedSteps().map((s: { id: string }) => s.id);
    expect(ids.length).toBe(PROCESS.length);
    expect(ids[0]).toBe('prd');
    expect(ids.at(-1)).toBe('ship');
  });

  it('no step is skippable, and every step declares at least one contract', () => {
    for (const step of PROCESS as Array<{ id: string; skippable: boolean; requires: unknown[] }>) {
      expect(step.skippable, `${step.id} must not be skippable`).toBe(false);
      expect(step.requires.length, `${step.id} must declare a contract`).toBeGreaterThan(0);
    }
  });

  it('a dependency is always ordered before the step that needs it', () => {
    const order = orderedSteps().map((s: { id: string }) => s.id);
    for (const step of PROCESS as Array<{ id: string; dependsOn: string[] }>) {
      for (const dep of step.dependsOn) {
        expect(order.indexOf(dep), `${dep} must precede ${step.id}`).toBeLessThan(
          order.indexOf(step.id)
        );
      }
    }
  });
});
