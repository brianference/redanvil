/**
 * Types for `checklist.mjs` — the definition of done, parsed from its document.
 */

export interface ChecklistRow {
  /** Row id, e.g. `A1`. */
  id: string;
  /** Section letter, e.g. `A`. */
  section: string;
  /** Section heading text. */
  sectionTitle: string;
  /** The requirement. */
  mustBeTrue: string;
  /** Evidence artifact, or the "why" for section G. */
  evidence: string;
}

export declare function parseChecklistRows(markdown: string): ChecklistRow[];
export declare function loadChecklistRows(path: string): ChecklistRow[];
