import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { parseChecklistRows, loadChecklistRows } from '../src/done/checklist.mjs';
import type { RowStatus } from '../src/done/coverage.d.mts';
import {
  CHECKLIST_RULE_MAP,
  checklistCoverage,
  checklistReasons,
  unimplementedRows
} from '../src/done/coverage.mjs';
import { RULES } from '../src/rubric/rules';
import { APP_CHECKS } from '../src/commands/gate';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CHECKLIST_PATH = join(REPO_ROOT, 'docs/DONE-CHECKLIST.md');

/**
 * Rows that have no measurement behind them today.
 *
 * This snapshot is the whole point of the test. Without it, "bind the checklist
 * to the gate" degrades into the failure it was written to stop: someone adds a
 * requirement, maps it to nothing, and the suite stays green because an
 * unimplemented row is *allowed* to be unimplemented. Pinning the exact set
 * means adding a new unmeasured row FAILS here, and implementing one also fails
 * here until the list is updated — both directions are deliberate.
 *
 * Shrinking this list is the work. It must never grow.
 */
/** Shrunk to zero when every DONE-CHECKLIST row has a real measurement. */
const KNOWN_UNIMPLEMENTED: string[] = [];

describe('DONE-CHECKLIST parsing', () => {
  it('parses every row of the real document', () => {
    const rows = loadChecklistRows(CHECKLIST_PATH);
    expect(rows.length).toBeGreaterThan(30);
    // Sections A-G must all be represented, or a whole section was dropped by a
    // format change and every one of its requirements silently stopped existing.
    const sections = new Set(rows.map((r) => r.section));
    expect([...sections].sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    for (const row of rows) {
      expect(row.mustBeTrue, `${row.id} has empty requirement text`).not.toBe('');
    }
  });

  it('refuses a document it cannot read rather than reporting zero rows', () => {
    // An empty parse would make every row vacuously satisfied.
    expect(() => parseChecklistRows('# not a checklist\n\nnothing here')).toThrow(/zero checklist rows/);
  });

  it('refuses a row whose id disagrees with its section', () => {
    const bad = '## A. The build itself\n\n| B1 | thing | artifact | how |\n';
    expect(() => parseChecklistRows(bad)).toThrow(/id and section disagree/);
  });

  it('refuses duplicate row ids', () => {
    const bad = '## A. x\n\n| A1 | one | a | b |\n| A1 | two | a | b |\n';
    expect(() => parseChecklistRows(bad)).toThrow(/duplicate checklist row id/);
  });
});

describe('checklist is bound to real measurements', () => {
  const rows = loadChecklistRows(CHECKLIST_PATH);

  it('every row in the document has a binding', () => {
    const missing = rows.filter((r) => CHECKLIST_RULE_MAP[r.id] === undefined).map((r) => r.id);
    expect(missing, 'rows in DONE-CHECKLIST.md with no entry in CHECKLIST_RULE_MAP').toEqual([]);
  });

  it('every binding refers to a row that exists', () => {
    const ids = new Set(rows.map((r) => r.id));
    const orphans = Object.keys(CHECKLIST_RULE_MAP).filter((id) => !ids.has(id));
    expect(orphans, 'CHECKLIST_RULE_MAP entries with no row in the document').toEqual([]);
  });

  it('every referenced rule id exists in the rubric', () => {
    const known = new Set(RULES.map((r) => r.id));
    const unknown: string[] = [];
    for (const [rowId, binding] of Object.entries(CHECKLIST_RULE_MAP)) {
      for (const ruleId of binding.rules ?? []) {
        if (!known.has(ruleId)) unknown.push(`${rowId} -> ${ruleId}`);
      }
    }
    expect(unknown, 'checklist rows pointing at rule ids the rubric does not define').toEqual([]);
  });

  it('every referenced rule is actually decidable — wired as a check or fail-closed on a verdict', () => {
    // A rule id in the rubric proves nothing on its own: `proc-full-local-suite`
    // was a real rubric entry with no implementation anywhere. A det-method rule
    // only runs if it is ALSO listed in APP_CHECKS.
    const wired = new Set(APP_CHECKS.map((c) => c.ruleId));
    const byId = new Map(RULES.map((r) => [r.id, r]));
    const undecidable: string[] = [];
    for (const [rowId, binding] of Object.entries(CHECKLIST_RULE_MAP)) {
      for (const ruleId of binding.rules ?? []) {
        const rule = byId.get(ruleId);
        if (rule === undefined) continue; // covered by the previous test
        const needsVerdict = rule.method === 'visual' || rule.method === 'judge';
        if (!wired.has(ruleId) && !needsVerdict) {
          undecidable.push(`${rowId} -> ${ruleId} (${rule.method}, not in APP_CHECKS)`);
        }
      }
    }
    expect(undecidable, 'checklist rows bound to rules nothing runs').toEqual([]);
  });

  it('the set of unmeasured rows is exactly the recorded gap — it must never grow', () => {
    expect(unimplementedRows()).toEqual(KNOWN_UNIMPLEMENTED);
  });
});

/**
 * The single status from a one-row evaluation.
 *
 * `noUncheckedIndexedAccess` makes `statuses[0]` possibly undefined, and an
 * assertion operator would hide a genuinely empty result — which is exactly the
 * failure mode these tests exist to catch.
 *
 * @param statuses - Result of a one-row `checklistCoverage` call.
 * @returns The only status.
 */
function only(statuses: RowStatus[]): RowStatus {
  const first = statuses[0];
  if (first === undefined) throw new Error('expected exactly one status, got none');
  return first;
}

describe('coverage evaluation is fail-closed', () => {
  const rows = loadChecklistRows(CHECKLIST_PATH);

  it('an unimplemented row never passes, however green the run', () => {
    // Every rule passing, every option supplied, score met: the rows with no
    // measurement behind them must STILL fail.
    const ruleOutcomes = RULES.map((r) => ({ ruleId: r.id, passed: true }));
    const statuses = checklistCoverage({
      rows,
      ruleOutcomes,
      optValues: {
        unitTestsPass: true,
        acceptanceTestsPass: true,
        coveragePct: 100,
        screenshotsPresent: true,
        evidenceStale: false,
        independentReviewOk: true,
        qaVisualOk: true,
        userRefuseOk: true
      },
      scoreMet: true,
      noFailedRules: true
    });
    const notPassed = statuses.filter((s) => s.status !== 'pass').map((s) => s.id);
    expect(notPassed).toEqual(KNOWN_UNIMPLEMENTED);
  });

  it('a row whose rule was never recorded is unmeasured, not passed', () => {
    const statuses = checklistCoverage({
      rows: [{ id: 'A1', section: 'A', mustBeTrue: 'tsc exits 0' }],
      ruleOutcomes: []
    });
    expect(only(statuses).status).toBe('unmeasured');
    expect(only(statuses).detail).toMatch(/u-typing-strict was never recorded/);
  });

  it('a row is failed when any of its rules failed', () => {
    const statuses = checklistCoverage({
      rows: [{ id: 'A2', section: 'A', mustBeTrue: 'eslint exits 0' }],
      ruleOutcomes: [
        { ruleId: 'u-typing-no-any', passed: true },
        { ruleId: 'u-conc-dead-code', passed: false }
      ]
    });
    expect(only(statuses).status).toBe('fail');
    expect(only(statuses).detail).toMatch(/u-conc-dead-code failed/);
  });

  it('duplicate outcomes for one rule resolve fail-closed', () => {
    const statuses = checklistCoverage({
      rows: [{ id: 'A1', section: 'A', mustBeTrue: 'tsc exits 0' }],
      ruleOutcomes: [
        { ruleId: 'u-typing-strict', passed: true },
        { ruleId: 'u-typing-strict', passed: false }
      ]
    });
    expect(only(statuses).status).toBe('fail');
  });

  it('evidenceStale is inverted — true means the row fails', () => {
    const statuses = checklistCoverage({
      rows: [{ id: 'F3', section: 'F', mustBeTrue: 'evidence post-dates its commit' }],
      ruleOutcomes: [],
      optValues: { evidenceStale: true }
    });
    expect(only(statuses).status).toBe('fail');
  });

  it('a row in the document with no binding at all fails as unimplemented', () => {
    const statuses = checklistCoverage({
      rows: [{ id: 'Z9', section: 'Z', mustBeTrue: 'invented later' }],
      ruleOutcomes: []
    });
    expect(only(statuses).status).toBe('unimplemented');
    expect(only(statuses).detail).toMatch(/no binding in CHECKLIST_RULE_MAP/);
  });

  it('reasons name the row, its status and the requirement', () => {
    const reasons = checklistReasons([
      { id: 'A5', section: 'A', mustBeTrue: '`npm run build` exits 0', status: 'unimplemented', detail: 'nothing runs it' }
    ]);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('A5');
    expect(reasons[0]).toContain('unimplemented');
    expect(reasons[0]).toContain('npm run build');
  });
});

describe('the skipChecklist escape hatch stays confined to tests', () => {
  it('no production source file passes skipChecklist', () => {
    // `proc-full-local-suite` failed on paper and was waived by `--na process`
    // on every real invocation, so it inflated the rubric count and enforced
    // nothing. An escape hatch is only safe while something watches the doors.
    const srcDir = join(REPO_ROOT, 'orchestrator/src');
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|mts|mjs|js)$/.test(entry.name)) continue;
        const text = readFileSync(full, 'utf8');
        // The definition in done.mjs/done.ts reads the flag; a CALLER sets it.
        if (/skipChecklist\s*:\s*true/.test(text)) {
          offenders.push(relative(REPO_ROOT, full));
        }
      }
    };
    walk(srcDir);
    expect(offenders, 'production code setting skipChecklist: true').toEqual([]);
  });

  it('scripts and CI do not pass skipChecklist either', () => {
    const offenders: string[] = [];
    for (const dir of ['.github/scripts', 'orchestrator/scripts', 'scripts']) {
      const full = join(REPO_ROOT, dir);
      if (!existsSync(full)) continue;
      const walk = (d: string): void => {
        for (const entry of readdirSync(d, { withFileTypes: true })) {
          const p = join(d, entry.name);
          if (entry.isDirectory()) {
            walk(p);
            continue;
          }
          if (!/\.(ts|mts|mjs|js)$/.test(entry.name)) continue;
          if (/skipChecklist\s*:\s*true/.test(readFileSync(p, 'utf8'))) {
            offenders.push(relative(REPO_ROOT, p));
          }
        }
      };
      walk(full);
    }
    expect(offenders, 'scripts setting skipChecklist: true').toEqual([]);
  });
});

describe('fe-favicon-legible measures every declared icon', () => {
  it('collects all rel=icon hrefs, not just the first', async () => {
    // Regression. The resolver returned the FIRST match, so a page declaring
    // favicon.svg before favicon-32.png had only the SVG measured -- a blank
    // favicon-32.png passed the check. Verified against the real app before the
    // fix: exit 0 with an empty 32px PNG on disk.
    const { findFaviconPaths } = await import('../scripts/checks/fe-favicon-legible.mjs');
    const dir = mkdtempSync(join(tmpdir(), 'favicons-'));
    mkdirSync(join(dir, 'public'), { recursive: true });
    for (const f of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']) {
      writeFileSync(join(dir, 'public', f), 'x');
    }
    writeFileSync(
      join(dir, 'index.html'),
      `<link rel="icon" href="/favicon.svg">
       <link rel="icon" href="/favicon-32.png">
       <link rel="apple-touch-icon" href="/apple-touch-icon.png">`
    );
    const paths: string[] = findFaviconPaths(dir);
    expect(paths).toHaveLength(3);
    expect(paths.some((p) => p.endsWith('favicon-32.png'))).toBe(true);
    expect(paths.some((p) => p.endsWith('apple-touch-icon.png'))).toBe(true);
  });
});

describe('the checklist document itself', () => {
  it('states that a spec is never evidence', () => {
    // The document's own thesis. If this sentence is edited away, the rows lose
    // the thing that makes them mean anything.
    // Whitespace-normalised: the sentence wraps across lines in the document,
    // and a regex that breaks on a re-wrap would fail for no real reason.
    const text = readFileSync(CHECKLIST_PATH, 'utf8').replace(/\s+/g, ' ');
    expect(text).toContain('A spec, a prompt, a plan, or a rule file is never evidence');
  });
});
