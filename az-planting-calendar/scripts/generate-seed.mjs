/**
 * Generate migrations/0002_seed.sql from the parsed az1005 HTML table.
 * Source: Vegetable Planting Calendar for Maricopa County (UA Extension),
 * https://extension.arizona.edu/sites/default/files/2024-08/az1005-2018.pdf
 * Author: Kai Umeda. Retrieved 2026-08-01.
 *
 * Half-months: 0=Jan.1 … 23=Dec.15 (24 columns matching the publication header).
 * Cell marks: S = seed, T = transplant, T/S = both, X = sets/cloves (stored as S).
 * Consecutive half-months with the same method collapse into one window.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// The dataset carries provenance alongside the rows: which crops were verified
// against the az1005 text stream, and which were DROPPED because their marker
// sequence did not match. Only verified rows are seeded — an unverifiable
// planting window is worse than a missing crop, because a gardener cannot tell
// the difference between a date that is right and one that merely looks right.
const dataset = JSON.parse(readFileSync(join(__dirname, 'az1005-crops.json'), 'utf8'));
const crops = Array.isArray(dataset) ? dataset : (dataset.crops ?? []);
if (crops.length === 0) {
  throw new Error('az1005-crops.json has no verified crops — refusing to write an empty seed');
}

const SOURCE_ID = 'src-az1005-maricopa';
const ZONE_ID = 'zone-cave-creek-85331';
const RETRIEVED_AT = '2026-08-01';
const SOURCE_URL =
  'https://extension.arizona.edu/sites/default/files/2024-08/az1005-2018.pdf';

/**
 * Parse harvest text into min/max days when numeric ranges exist.
 * @param {string} harvest
 * @returns {{ min: number | null, max: number | null, notes: string }}
 */
function parseHarvest(harvest) {
  const notes = harvest;
  // Prefer "S = 60-75" style ranges; fall back to first N-M days range
  const sMatch = harvest.match(/S\s*=\s*(\d+)\s*-\s*(\d+)/i);
  if (sMatch) {
    return { min: Number(sMatch[1]), max: Number(sMatch[2]), notes };
  }
  const tMatch = harvest.match(/T\s*=?\s*(\d+)\s*-\s*(\d+)/i);
  if (tMatch && !/months|years/i.test(harvest)) {
    return { min: Number(tMatch[1]), max: Number(tMatch[2]), notes };
  }
  const range = harvest.match(/(\d+)\s*-\s*(\d+)\s*days/i);
  if (range) {
    return { min: Number(range[1]), max: Number(range[2]), notes };
  }
  const single = harvest.match(/(\d+)\s*days/i);
  if (single) {
    return { min: Number(single[1]), max: Number(single[1]), notes };
  }
  // months / years — leave days null, keep notes
  return { min: null, max: null, notes };
}

/**
 * Collapse boolean half-month occupancy into [start, end] inclusive ranges.
 * @param {boolean[]} flags length 24
 * @returns {Array<{ start: number, end: number }>}
 */
function collapseRanges(flags) {
  /** @type {Array<{ start: number, end: number }>} */
  const ranges = [];
  let start = null;
  for (let i = 0; i < 24; i++) {
    if (flags[i]) {
      if (start === null) start = i;
    } else if (start !== null) {
      ranges.push({ start, end: i - 1 });
      start = null;
    }
  }
  if (start !== null) ranges.push({ start, end: 23 });
  return ranges;
}

/**
 * @param {string} cell
 * @returns {{ seed: boolean, transplant: boolean }}
 */
function parseCell(cell) {
  const c = (cell || '').toUpperCase().replace(/\s+/g, '');
  if (!c) return { seed: false, transplant: false };
  // X = sets of cloves (az1005 legend) → seed method (sets planted like seed)
  if (c === 'X') return { seed: true, transplant: false };
  if (c === 'T/S' || c === 'S/T') return { seed: true, transplant: true };
  if (c === 'S') return { seed: true, transplant: false };
  if (c === 'T') return { seed: false, transplant: true };
  return { seed: false, transplant: false };
}

function slug(name) {
  return (
    'crop-' +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
}

function sqlStr(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function sqlNull(n) {
  return n === null || n === undefined ? 'NULL' : String(n);
}

/** @type {string[]} */
const lines = [];
lines.push('-- Seed data from UA Cooperative Extension az1005 (Maricopa County).');
lines.push(`-- Source URL: ${SOURCE_URL}`);
lines.push(`-- Author: Kai Umeda. Retrieved: ${RETRIEVED_AT}.`);
lines.push('-- Every planting window is transcribed from the az1005 PDF and verified character-for-character against its text stream');
lines.push('-- (Jan. 1 … Dec. 15). Marks: S=seed, T=transplant, T/S=both, X=sets→S.');
lines.push('-- Do not invent windows. Re-run scripts/generate-seed.mjs after re-scraping.');
lines.push('');

lines.push('INSERT OR REPLACE INTO sources (id, title, author, publisher, url, retrieved_at) VALUES (');
lines.push(
  `  ${sqlStr(SOURCE_ID)},`,
  `  ${sqlStr('Vegetable Planting Calendar for Maricopa County')},`,
  `  ${sqlStr('Kai Umeda')},`,
  `  ${sqlStr('University of Arizona Cooperative Extension')},`,
  `  ${sqlStr(SOURCE_URL)},`,
  `  ${sqlStr(RETRIEVED_AT)}`,
  ');'
);
lines.push('');

lines.push('INSERT OR REPLACE INTO zones (id, name, zip, last_frost, first_frost) VALUES (');
lines.push(
  `  ${sqlStr(ZONE_ID)},`,
  `  ${sqlStr('Cave Creek AZ (low desert, Maricopa County)')},`,
  `  ${sqlStr('85331')},`,
  // garden.org frost-dates app for Cave Creek AZ: last 32°F ~ Mar 9; first fall freeze
  // for low-desert Maricopa foothills commonly mid-November (see About page citation).
  `  ${sqlStr('03-09')},`,
  `  ${sqlStr('11-15')}`,
  ');'
);
lines.push('');

let windowCount = 0;
const windowRows = [];

for (const crop of crops) {
  const id = slug(crop.name);
  const { min, max, notes } = parseHarvest(crop.harvest);
  const cells = Array.isArray(crop.cells) ? crop.cells : [];
  while (cells.length < 24) cells.push('');

  const seedFlags = Array.from({ length: 24 }, () => false);
  const transplantFlags = Array.from({ length: 24 }, () => false);

  for (let h = 0; h < 24; h++) {
    const { seed, transplant } = parseCell(cells[h] ?? '');
    seedFlags[h] = seed;
    transplantFlags[h] = transplant;
  }

  lines.push(
    `INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (`
  );
  lines.push(
    `  ${sqlStr(id)}, ${sqlStr(crop.name)}, ${sqlNull(min)}, ${sqlNull(max)}, ${sqlStr(notes)}`
  );
  lines.push(');');

  for (const method of /** @type {const} */ (['S', 'T'])) {
    const flags = method === 'S' ? seedFlags : transplantFlags;
    for (const range of collapseRanges(flags)) {
      windowCount += 1;
      const wid = `pw-${id}-${method.toLowerCase()}-${range.start}-${range.end}`;
      windowRows.push(
        `INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES (${sqlStr(wid)}, ${sqlStr(id)}, ${range.start}, ${range.end}, ${sqlStr(method)}, ${sqlStr(SOURCE_ID)});`
      );
    }
  }
  lines.push('');
}

lines.push(...windowRows);
lines.push('');
lines.push(`-- Summary: ${crops.length} crops, ${windowCount} planting windows.`);

const outPath = join(__dirname, '..', 'migrations', '0002_seed.sql');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`Wrote ${outPath}`);
console.log(`crops=${crops.length} windows=${windowCount}`);
