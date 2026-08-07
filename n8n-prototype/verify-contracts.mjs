#!/usr/bin/env node
/**
 * Prove every contract kind can FAIL, and that the honest case PASSES.
 *
 * A check that cannot fail is not a check. Each case below builds the input that
 * should break the contract and asserts it actually breaks. The two cases marked
 * REGRESSION are false failures this checker really produced before being fixed:
 * a document was rejected for the word "placeholders" while forbidding them, and
 * a heading reading "Specifically forbidden" failed a contract looking for
 * "Forbidden".
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { checkContract } from './contract-check.mjs';

/**
 * A scratch directory INSIDE the git repo. Provenance cases need a working
 * `git rev-parse HEAD`; run them from a temp dir and they pass on "cannot
 * resolve HEAD" without ever comparing a commit.
 */
const REPO_SCRATCH = join(dirname(fileURLToPath(import.meta.url)), '.verify-scratch');

const ROOT = join(tmpdir(), 'redanvil-contract-verify');
rmSync(ROOT, { recursive: true, force: true });
rmSync(REPO_SCRATCH, { recursive: true, force: true });
mkdirSync(ROOT, { recursive: true });
rmSync(REPO_SCRATCH, { recursive: true, force: true });
mkdirSync(REPO_SCRATCH, { recursive: true });

/** @type {{name: string, expectFail: boolean, setup: () => import('./process-map.mjs').ArtifactContract}[]} */
const CASES = [
  {
    name: 'missing-file',
    expectFail: true,
    setup: () => ({ path: 'nope/BRIEF.md', kind: 'file', minBytes: 10, why: 'x' })
  },
  {
    name: 'file-below-substance-floor',
    expectFail: true,
    setup: () => {
      mkdirSync(join(ROOT, 'thin'), { recursive: true });
      writeFileSync(join(ROOT, 'thin/BRIEF.md'), 'ok');
      return { path: 'thin/BRIEF.md', kind: 'file', minBytes: 500, why: 'x' };
    }
  },
  {
    name: 'dir-too-few-artifacts',
    expectFail: true,
    setup: () => {
      mkdirSync(join(ROOT, 'logos'), { recursive: true });
      writeFileSync(join(ROOT, 'logos/mark-01.png'), 'x'.repeat(50));
      return { path: 'logos', kind: 'dir', glob: '.png', minCount: 5, why: 'x' };
    }
  },
  {
    name: 'unfilled-marker-present',
    expectFail: true,
    setup: () => {
      mkdirSync(join(ROOT, 'blank'), { recursive: true });
      writeFileSync(join(ROOT, 'blank/DECISION.md'), 'Choice: TBD\n'.repeat(60));
      return { path: 'blank/DECISION.md', kind: 'file', minBytes: 10, mustNotContain: ['TBD'], why: 'x' };
    }
  },
  {
    name: 'required-statement-absent',
    expectFail: true,
    setup: () => {
      mkdirSync(join(ROOT, 'noforbid'), { recursive: true });
      writeFileSync(join(ROOT, 'noforbid/DECISION.md'), 'We picked option A.\n'.repeat(40));
      return { path: 'noforbid/DECISION.md', kind: 'file', minBytes: 10, mustContain: ['Forbidden'], why: 'x' };
    }
  },
  {
    name: 'REGRESSION-doc-forbidding-placeholders-must-pass',
    expectFail: false,
    setup: () => {
      mkdirSync(join(ROOT, 'good'), { recursive: true });
      writeFileSync(
        join(ROOT, 'good/BRIEF.md'),
        'Real brand mark, not emoji or letter placeholders.\n'.repeat(40)
      );
      return {
        path: 'good/BRIEF.md',
        kind: 'file',
        minBytes: 100,
        mustNotContain: ['TBD', 'Lorem ipsum'],
        why: 'x'
      };
    }
  },
  {
    name: 'REGRESSION-lowercase-heading-must-satisfy-mustContain',
    expectFail: false,
    setup: () => {
      mkdirSync(join(ROOT, 'case'), { recursive: true });
      writeFileSync(join(ROOT, 'case/DECISION.md'), 'Specifically forbidden, and DECIDED.\n'.repeat(30));
      return {
        path: 'case/DECISION.md',
        kind: 'file',
        minBytes: 100,
        mustContain: ['Forbidden', 'decided'],
        why: 'x'
      };
    }
  },
  {
    name: 'manifest-of-names-only-must-fail',
    expectFail: true,
    setup: () => {
      mkdirSync(join(ROOT, 'names'), { recursive: true });
      const names = Array.from({ length: 12 }, (_, i) => `app_view_${i}.png`);
      writeFileSync(join(ROOT, 'names/MANIFEST.json'), JSON.stringify({ appViews: names }, null, 1));
      return { path: 'names/MANIFEST.json', kind: 'file', jsonDistinctHashes: 12, why: 'x' };
    }
  },
  {
    name: 'manifest-with-one-hash-repeated-must-fail',
    expectFail: true,
    setup: () => {
      mkdirSync(join(ROOT, 'dupe'), { recursive: true });
      const same = 'a'.repeat(64);
      const rows = Array.from({ length: 12 }, (_, i) => ({ file: `r${i}.png`, sha256: same }));
      writeFileSync(join(ROOT, 'dupe/MANIFEST.json'), JSON.stringify({ renders: rows }, null, 1));
      return { path: 'dupe/MANIFEST.json', kind: 'file', jsonDistinctHashes: 12, why: 'x' };
    }
  },
  {
    name: 'manifest-with-12-distinct-hashes-passes',
    expectFail: false,
    setup: () => {
      mkdirSync(join(ROOT, 'hashed'), { recursive: true });
      const rows = Array.from({ length: 12 }, (_, i) => ({
        file: `r${i}.png`,
        sha256: i.toString(16).padStart(64, '0')
      }));
      writeFileSync(join(ROOT, 'hashed/MANIFEST.json'), JSON.stringify({ renders: rows }, null, 1));
      return { path: 'hashed/MANIFEST.json', kind: 'file', jsonDistinctHashes: 12, why: 'x' };
    }
  },
  {
    // Runs inside the real repo on purpose. An earlier version of this case put
    // the file in a temp dir, so `git rev-parse HEAD` failed and the case passed
    // on "cannot resolve HEAD" -- it would have passed even with the commit
    // comparison deleted. `expectReason` pins the failure to the right cause.
    name: 'provenance-at-another-commit-must-fail',
    expectFail: true,
    expectReason: /provenance is commit f{12} but HEAD is/,
    inRepo: true,
    setup: () => {
      mkdirSync(join(REPO_SCRATCH, 'results'), { recursive: true });
      writeFileSync(
        join(REPO_SCRATCH, 'results/pet-sitter.json'),
        JSON.stringify({ provenance: { commit: 'f'.repeat(40), dirty: false }, pad: 'x'.repeat(300) })
      );
      return { path: 'results/pet-sitter.json', kind: 'file', provenanceMatchesHead: true, why: 'x' };
    }
  },
  {
    name: 'provenance-measured-on-a-dirty-tree-must-fail',
    expectFail: true,
    expectReason: /measured against a DIRTY tree/,
    inRepo: true,
    setup: () => {
      mkdirSync(join(REPO_SCRATCH, 'dirtyresults'), { recursive: true });
      const head = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: REPO_SCRATCH,
        encoding: 'utf8'
      }).trim();
      writeFileSync(
        join(REPO_SCRATCH, 'dirtyresults/pet-sitter.json'),
        JSON.stringify({ provenance: { commit: head, dirty: true }, pad: 'x'.repeat(300) })
      );
      return { path: 'dirtyresults/pet-sitter.json', kind: 'file', provenanceMatchesHead: true, why: 'x' };
    }
  },
  {
    name: 'provenance-with-no-commit-must-fail',
    expectFail: true,
    setup: () => {
      mkdirSync(join(ROOT, 'nocommit/results'), { recursive: true });
      writeFileSync(
        join(ROOT, 'nocommit/results/pet-sitter.json'),
        JSON.stringify({ finalScore: 100, passed: true, pad: 'x'.repeat(300) })
      );
      return { path: 'nocommit/results/pet-sitter.json', kind: 'file', provenanceMatchesHead: true, why: 'x' };
    }
  },
  {
    name: 'honest-artifact-passes',
    expectFail: false,
    setup: () => {
      mkdirSync(join(ROOT, 'real'), { recursive: true });
      writeFileSync(join(ROOT, 'real/DECISION.md'), 'DECIDED: option A. Forbidden: one shared hero.\n'.repeat(30));
      return {
        path: 'real/DECISION.md',
        kind: 'file',
        minBytes: 300,
        mustContain: ['DECIDED', 'Forbidden'],
        mustNotContain: ['TBD'],
        why: 'x'
      };
    }
  }
];

let failures = 0;
for (const c of CASES) {
  const contract = c.setup();
  const base = c.inRepo ? REPO_SCRATCH : ROOT;
  const result = checkContract(base, contract);
  let behavedCorrectly = c.expectFail ? !result.ok : result.ok;

  // Failing is not enough when a reason is pinned: a case can fail for an
  // unrelated cause and hide that the rule it targets is broken.
  let note = '';
  if (behavedCorrectly && c.expectReason) {
    const matched = result.reasons.some((r) => c.expectReason.test(r));
    if (!matched) {
      behavedCorrectly = false;
      note = ' [failed for the WRONG reason]';
    }
  }
  if (!behavedCorrectly) failures += 1;
  console.log(
    `${behavedCorrectly ? 'PASS' : 'BROKEN'} ${c.name} -- expected ${c.expectFail ? 'FAIL' : 'OK'}, got ${result.ok ? 'OK' : 'FAIL'}${note}${result.reasons.length ? ` (${result.reasons[0].slice(0, 60)})` : ''}`
  );
}

rmSync(ROOT, { recursive: true, force: true });
rmSync(REPO_SCRATCH, { recursive: true, force: true });
console.log(failures ? `\n${failures} contract behaviour(s) wrong` : '\nevery contract fails on bad input and passes on good');
process.exit(failures ? 1 : 0);
