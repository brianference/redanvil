/**
 * Coverage boundary helpers for the Maricopa low-desert planning zone control.
 * Planting windows come only from UA Cooperative Extension az1005
 * (Vegetable Planting Calendar for Maricopa County). Towns outside that
 * geographic scope must not be presented as a software bug.
 */

/** Towns currently selectable as planning zones (Maricopa County low desert). */
export const COVERED_TOWNS = [
  'Buckeye',
  'Cave Creek',
  'Chandler',
  'Glendale',
  'Mesa',
  'Phoenix',
  'Scottsdale',
  'Tempe'
] as const;

/**
 * Known Arizona places that are outside az1005 coverage.
 * Match strings are case-insensitive fragments only -- no elevations (none sourced here).
 * Keep this list small and limited to places a visitor is likely to type.
 */
const OUT_OF_COVERAGE: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\btucson\b/i, label: 'Tucson' },
  { pattern: /\bsierra\s*vista\b/i, label: 'Sierra Vista' },
  { pattern: /\bpinetop\b/i, label: 'Pinetop' },
  { pattern: /\blakeside\b/i, label: 'Pinetop-Lakeside' },
  { pattern: /\bflagstaff\b/i, label: 'Flagstaff' },
  { pattern: /\bprescott\b/i, label: 'Prescott' },
  { pattern: /\bsedona\b/i, label: 'Sedona' },
  { pattern: /\byuma\b/i, label: 'Yuma' },
  { pattern: /\bkingman\b/i, label: 'Kingman' },
  { pattern: /\bpayson\b/i, label: 'Payson' },
  { pattern: /\bshow\s*low\b/i, label: 'Show Low' },
  { pattern: /\bbisbee\b/i, label: 'Bisbee' },
  { pattern: /\bnogales\b/i, label: 'Nogales' },
  { pattern: /\bcasa\s*grande\b/i, label: 'Casa Grande' },
  { pattern: /\bwinslow\b/i, label: 'Winslow' },
  { pattern: /\bpage\b/i, label: 'Page' },
  { pattern: /\blake\s*havasu\b/i, label: 'Lake Havasu City' }
];

/**
 * If the query names a known Arizona place outside Maricopa low-desert coverage,
 * return its display label; otherwise null.
 *
 * @param query - Raw zone search text.
 */
export function matchOutOfCoveragePlace(query: string): string | null {
  const q = query.trim();
  if (q.length === 0) return null;
  for (const entry of OUT_OF_COVERAGE) {
    if (entry.pattern.test(q)) return entry.label;
  }
  return null;
}

/**
 * True when the query is a bare state token (AZ / Arizona).
 *
 * @param query - Raw zone search text.
 */
export function isStateQuery(query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === 'az' || q === 'arizona';
}
