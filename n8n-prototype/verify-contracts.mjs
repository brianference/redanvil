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
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkContract } from './contract-check.mjs';

const ROOT = join(tmpdir(), 'redanvil-contract-verify');
rmSync(ROOT, { recursive: true, force: true });
mkdirSync(ROOT, { recursive: true });

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
  const result = checkContract(ROOT, contract);
  const behavedCorrectly = c.expectFail ? !result.ok : result.ok;
  if (!behavedCorrectly) failures += 1;
  console.log(
    `${behavedCorrectly ? 'PASS' : 'BROKEN'} ${c.name} -- expected ${c.expectFail ? 'FAIL' : 'OK'}, got ${result.ok ? 'OK' : 'FAIL'}${result.reasons.length ? ` (${result.reasons[0].slice(0, 70)})` : ''}`
  );
}

rmSync(ROOT, { recursive: true, force: true });
console.log(failures ? `\n${failures} contract behaviour(s) wrong` : '\nevery contract fails on bad input and passes on good');
process.exit(failures ? 1 : 0);
