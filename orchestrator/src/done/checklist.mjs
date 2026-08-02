/**
 * The definition of done, parsed from `docs/DONE-CHECKLIST.md`.
 *
 * WHY THE MARKDOWN IS THE SOURCE OF TRUTH
 * ---------------------------------------
 * The obvious implementation is a hand-maintained array of row ids next to the
 * document. That is the shape every drifted rule in this repo already had: a
 * lane file said one thing, the encoded rubric said another, and nothing
 * compared them. `rules/rubric/*.md` and `RULES` are kept "in lockstep" by a
 * comment asking someone to remember.
 *
 * So this parses the document itself. Adding a row to the table adds a row to
 * the gate; nobody can add a requirement to the checklist and leave it
 * unenforced, because there is no second list to forget to update.
 *
 * Pure JS so the pre-push hook, `meets_the_bar`, CI and the TypeScript CLI all
 * evaluate the same rows — the same reason `done.mjs` is not TypeScript.
 */
import { readFileSync } from 'node:fs';

/**
 * A single row of the definition of done.
 *
 * @typedef {object} ChecklistRow
 * @property {string} id            Row id, e.g. `A1`.
 * @property {string} section       Section letter, e.g. `A`.
 * @property {string} sectionTitle  Section heading text.
 * @property {string} mustBeTrue    The requirement.
 * @property {string} evidence      Evidence artifact, or the "why" for section G.
 */

/** Matches `## A. The build itself` and captures the letter plus the title. */
const SECTION_RE = /^##\s+([A-G])\.\s+(.+?)\s*$/;

/** Matches a table row whose first cell is a row id like `A1` or `G5`. */
const ROW_RE = /^\|\s*([A-G]\d{1,2})\s*\|(.*)$/;

/**
 * Split a markdown table row's remaining cells.
 *
 * Escaped pipes (`\|`) inside a cell would break a naive split. None appear
 * today, but a requirement mentioning a shell pipe is exactly the kind of edit
 * that would silently drop a column, so they are handled.
 *
 * @param {string} rest - Everything after the id cell, including the trailing pipe.
 * @returns {string[]} Trimmed cell contents.
 */
function splitCells(rest) {
  /** @type {string[]} */
  const cells = [];
  let current = '';
  for (let i = 0; i < rest.length; i += 1) {
    const ch = rest[i];
    if (ch === '\\' && rest[i + 1] === '|') {
      current += '|';
      i += 1;
      continue;
    }
    if (ch === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim() !== '') cells.push(current.trim());
  return cells;
}

/**
 * Parse the checklist document into rows.
 *
 * Section G's table is `| # | Must be true | Why |` while A-F are
 * `| # | Must be true | Evidence artifact | How it fails silently |`. Both are
 * read positionally: cell 0 is the requirement, cell 1 is the evidence-or-why.
 *
 * @param {string} markdown - Contents of DONE-CHECKLIST.md.
 * @returns {ChecklistRow[]} Every row, in document order.
 */
export function parseChecklistRows(markdown) {
  /** @type {ChecklistRow[]} */
  const rows = [];
  let section = '';
  let sectionTitle = '';

  for (const line of markdown.split(/\r?\n/)) {
    const heading = SECTION_RE.exec(line);
    if (heading) {
      section = heading[1];
      sectionTitle = heading[2];
      continue;
    }
    const row = ROW_RE.exec(line);
    if (!row) continue;
    const id = row[1];
    // A row before any section heading means the document was restructured in a
    // way this parser does not understand. Failing loudly beats silently
    // attributing requirements to section "".
    if (section === '') {
      throw new Error(`checklist row ${id} appears before any "## <letter>." section heading`);
    }
    if (id[0] !== section) {
      throw new Error(`checklist row ${id} is inside section ${section} — id and section disagree`);
    }
    const cells = splitCells(row[2]);
    rows.push({
      id,
      section,
      sectionTitle,
      mustBeTrue: cells[0] ?? '',
      evidence: cells[1] ?? ''
    });
  }

  if (rows.length === 0) {
    // An empty parse is the dangerous outcome: every row would vacuously pass
    // and the gate would report the checklist as fully satisfied. Refuse.
    throw new Error('parsed zero checklist rows — the document format changed');
  }

  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.id)) throw new Error(`duplicate checklist row id ${r.id}`);
    seen.add(r.id);
  }

  return rows;
}

/**
 * Read and parse the checklist from disk.
 *
 * @param {string} path - Path to DONE-CHECKLIST.md.
 * @returns {ChecklistRow[]} Parsed rows.
 */
export function loadChecklistRows(path) {
  return parseChecklistRows(readFileSync(path, 'utf8'));
}
