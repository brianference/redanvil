import type { DataStorage } from '../job';
import { DEFAULT_DATA_STORAGE } from '../job';

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'for',
  'with',
  'app',
  'application',
  'to',
  'of',
  'and'
]);

/**
 * Words that cannot end a title. A length-bounded cut lands on whatever word
 * the budget ran out on, and these leave the phrase visibly unfinished.
 */
const DANGLING_TAIL = new Set([
  'a',
  'an',
  'the',
  'for',
  'with',
  'to',
  'of',
  'and',
  'or',
  'in',
  'on',
  'at',
  'by',
  'from',
  'that',
  'which'
]);

/** Soft max character length for a title; cuts only on a word boundary (no ellipsis). */
const TITLE_MAX_CHARS = 72;

/**
 * Derive a human product title from the prompt.
 * Title Case with stopwords kept lowercase mid-title. Never cuts mid-word;
 * if length-bounded, trims to the last full word under TITLE_MAX_CHARS.
 */
export function titleFromPrompt(prompt: string): string {
  const cleaned = prompt
    .trim()
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length === 0) return 'New App';

  let clause = cleaned;
  if (clause.length > TITLE_MAX_CHARS) {
    const head = clause.slice(0, TITLE_MAX_CHARS);
    const lastSpace = head.lastIndexOf(' ');
    // Prefer a word boundary; only hard-cut if there is no space past a minimal prefix.
    clause = lastSpace > 12 ? head.slice(0, lastSpace) : head;
  }

  // Truncation lands wherever the character budget runs out, which is often on
  // a word that cannot end a phrase: "…Lowest Cost Airline Flight with" was a
  // real generated title. Drop trailing connectives so the cut reads as a title
  // rather than an unfinished sentence.
  const words = clause.split(/\s+/).filter(Boolean);
  while (words.length > 1 && DANGLING_TAIL.has(words[words.length - 1]!.toLowerCase())) {
    words.pop();
  }
  if (words.length === 0) return 'New App';
  return words
    .map((w, i) =>
      i > 0 && STOPWORDS.has(w.toLowerCase()) ? w.toLowerCase() : w[0]!.toUpperCase() + w.slice(1)
    )
    .join(' ');
}

/** Split the free-text entities field into a clean list. */
export function entityList(entities: string): string[] {
  return entities
    .split(/[,;\n]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

/**
 * Normalize an entity label to a singular PascalCase type name (e.g. "trips" → "Trip").
 */
export function entityPascal(name: string): string {
  const parts = name
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'Item';
  return parts
    .map((part) => {
      const lower = part.toLowerCase();
      // Strip a trailing plural "s" for simple English plurals (trips → trip).
      const singular =
        lower.length > 3 && lower.endsWith('s') && !lower.endsWith('ss')
          ? lower.slice(0, -1)
          : lower;
      return singular[0]!.toUpperCase() + singular.slice(1);
    })
    .join('');
}

/**
 * Normalize an entity label to a plural snake_case table / route segment
 * (e.g. "Trip" → "trips", "ear cleaning" → "ear_cleanings").
 */
export function entityTable(name: string): string {
  const pascal = entityPascal(name);
  const snake = pascal.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  // English plurals, not `${word}s`. An entity called "search" produced a table
  // named `searchs`, which then appeared in the DDL, the routes and every test
  // name in the spec. Cheap to get right, and wrong forever once it ships in a
  // migration.
  if (/(?:s|x|z|ch|sh)$/.test(snake)) return `${snake}es`;
  if (/[^aeiou]y$/.test(snake)) return `${snake.slice(0, -1)}ies`;
  return `${snake}s`;
}

/**
 * YAML-safe single-line string (escape quotes and backslashes).
 */
export function yamlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Human label for a data-storage wizard choice (embedded in the PRD).
 */
export function storageLabel(storage: DataStorage): string {
  switch (storage) {
    case 'none':
      return 'None (stateless / no domain tables)';
    case 'relational':
      return 'Relational + search (D1 tables with indexes and list/search endpoints)';
    case 'simple':
    default:
      return 'Simple D1 tables (CRUD + parameterized queries)';
  }
}

/** Re-export for architecture section default wording. */
export { DEFAULT_DATA_STORAGE };
