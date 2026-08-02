import { describe, it, expect } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChecklistRows } from '../../../../../orchestrator/src/done/checklist.mjs';
import {
  DONE_CHECKLIST_SECTIONS,
  DEFINITION_OF_DONE_HEADING,
  buildDefinitionOfDone
} from './doneChecklist';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const CHECKLIST_PATH = join(REPO_ROOT, 'docs/DONE-CHECKLIST.md');

interface SourceRow {
  id: string;
  section: string;
  sectionTitle: string;
  mustBeTrue: string;
  evidence: string;
}

describe('the embedded definition of done matches its source document', () => {
  it('has not drifted from docs/DONE-CHECKLIST.md', () => {
    // This test is the entire justification for embedding a copy. The generator
    // runs in the browser and cannot read the document at generate time, so the
    // rows are duplicated into TypeScript -- and a duplicate that nothing
    // compares is exactly how a rule file and its encoded rubric drift apart.
    // Re-record with `npx tsx scripts/regen-done-checklist.mts`.
    const source = loadChecklistRows(CHECKLIST_PATH) as SourceRow[];

    const embedded = DONE_CHECKLIST_SECTIONS.flatMap((s) =>
      s.rows.map((r) => ({
        id: r.id,
        section: s.letter,
        sectionTitle: s.title,
        mustBeTrue: r.mustBeTrue,
        evidence: r.evidence
      }))
    );

    expect(embedded.map((r) => r.id)).toEqual(source.map((r) => r.id));
    for (const [i, row] of embedded.entries()) {
      const from = source[i];
      expect(from, `no source row at index ${i}`).toBeDefined();
      if (from === undefined) continue;
      expect(row.mustBeTrue, `${row.id} requirement text`).toBe(from.mustBeTrue);
      expect(row.evidence, `${row.id} evidence text`).toBe(from.evidence);
      expect(row.sectionTitle, `${row.id} section title`).toBe(from.sectionTitle);
    }
  });

  it('covers every section of the source document', () => {
    const source = loadChecklistRows(CHECKLIST_PATH) as SourceRow[];
    const sourceSections = [...new Set(source.map((r) => r.section))].sort();
    const embeddedSections = DONE_CHECKLIST_SECTIONS.map((s) => s.letter).sort();
    expect(embeddedSections).toEqual(sourceSections);
  });
});

describe('buildDefinitionOfDone', () => {
  const md = buildDefinitionOfDone();

  it('emits the heading the self-check looks for', () => {
    expect(md).toContain(DEFINITION_OF_DONE_HEADING);
  });

  it('emits every row id, so a stub cannot satisfy the self-check', () => {
    for (const section of DONE_CHECKLIST_SECTIONS) {
      for (const row of section.rows) {
        expect(md, `${row.id} missing from rendered block`).toContain(`**${row.id}**`);
      }
    }
  });

  it('states that a spec is never evidence', () => {
    // The thesis that makes the rows mean anything. If this is edited away the
    // checklist becomes a to-do list a builder can tick off from intent.
    expect(md.replace(/\s+/g, ' ')).toContain(
      'A spec, a prompt, a plan, or a rule file is never evidence'
    );
  });

  it('renders every row as an unchecked box', () => {
    const boxes = md.match(/- \[ \] \*\*[A-G]\d{1,2}\*\*/g) ?? [];
    const total = DONE_CHECKLIST_SECTIONS.reduce((n, s) => n + s.rows.length, 0);
    expect(boxes).toHaveLength(total);
  });
});
