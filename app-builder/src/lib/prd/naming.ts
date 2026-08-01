import type { DataStorage } from '../job';

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
  'which',
  'vs',
  'versus'
]);

/** Soft max words for a product title (noun phrase, not a sentence). */
const TITLE_MAX_WORDS = 6;

/**
 * Words that name software packaging rather than a domain entity. Used when
 * deriving entities and titles so "app" / "tool" never become the product noun.
 */
const GENERIC_DOMAIN =
  /^(?:an?\s+)?(?:simple\s+|full[- ]stack\s+|mobile[- ]first\s+|web\s+)*(?:app|application|tool|system|site|website|platform|dashboard|record|thing|product|service|page|status)s?$/i;

/** Common English function words skipped when mining domain nouns. */
const ENTITY_STOP = new Set([
  'a',
  'an',
  'the',
  'for',
  'with',
  'from',
  'into',
  'onto',
  'and',
  'or',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'as',
  'is',
  'are',
  'was',
  'be',
  'this',
  'that',
  'these',
  'those',
  'what',
  'which',
  'who',
  'whom',
  'when',
  'where',
  'how',
  'why',
  'your',
  'you',
  'our',
  'their',
  'its',
  'my',
  'app',
  'application',
  'tool',
  'system',
  'site',
  'website',
  'platform',
  'simple',
  'full',
  'stack',
  'mobile',
  'first',
  'web',
  'show',
  'list',
  'display',
  'browse',
  'view',
  'find',
  'search',
  'track',
  'build',
  'create',
  'make',
  'need',
  'needs',
  'user',
  'users',
  'current',
  'every',
  'full',
  'year',
  'marked',
  'across',
  'down',
  'notes',
  'also',
  'that',
  'handles',
  'using',
  'based',
  'like',
  'see',
  'reverse',
  'engineer',
  'features',
  'from',
  'http',
  'https',
  'www',
  'com',
  'org',
  'pdf',
  'true',
  'false',
  'null',
  'detail',
  'details',
  'filter',
  'filters',
  'grid',
  'column',
  'columns',
  'row',
  'rows',
  'window',
  'windows',
  'half',
  'month',
  'months',
  'day',
  'days',
  'time',
  'times',
  'total',
  'vs',
  'versus'
]);

/**
 * Strip generator directives and bare URLs from product-facing prose.
 * Carries named references (URLs, "reverse engineer …" clauses) for §7.
 *
 * @param prompt - Raw wizard prompt.
 * @returns Clean product text plus named references to list under architecture.
 */
export function stripGeneratorDirectives(prompt: string): {
  productPrompt: string;
  references: string[];
} {
  const references: string[] = [];
  let text = prompt.trim();

  // Capture reverse-engineer / based-on / like-this / see <url> clauses.
  // Word boundaries on every alternative — bare "see" must not match inside "seed".
  const directiveRe =
    /(?:^|\n|\s)(?:\(?\s*)?(?:reverse\s+engineer(?:\s+features)?(?:\s+from(?:\s+this)?)?|based\s+on|like\s+this|\bsee\b)\s*:?\s*(https?:\/\/\S+|\S+)\)?/gi;
  text = text.replace(directiveRe, (_full, ref: string) => {
    const cleaned = String(ref).replace(/[),.;]+$/, '');
    if (cleaned.length > 0) {
      references.push(
        /^https?:\/\//i.test(cleaned) ? `Reference: ${cleaned}` : `Generator directive reference: ${cleaned}`
      );
    }
    return ' ';
  });

  // Bare URLs not already captured.
  text = text.replace(/https?:\/\/[^\s)]+/gi, (url) => {
    const cleaned = url.replace(/[),.;]+$/, '');
    if (!references.some((r) => r.includes(cleaned))) {
      references.push(`Reference: ${cleaned}`);
    }
    return ' ';
  });

  // Orphan parenthetical generator notes and leftover empty parens.
  text = text.replace(/\(\s*reverse\s+engineer[^)]*\)/gi, ' ');
  text = text.replace(/\(\s*\)/g, ' ');
  text = text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([).,;])/g, '$1')
    .replace(/^\s*\)\s*$/gm, '')
    .replace(/\s+\)/g, '')
    .trim();

  return { productPrompt: text, references: [...new Set(references)] };
}

/**
 * Split a prompt into non-empty requirement lines (newlines and bullet markers).
 * Shared by criteria extraction and prompt-fidelity grading.
 *
 * @param prompt - Raw or cleaned prompt text.
 * @returns One entry per requirement line, order preserved.
 */
export function requirementLines(prompt: string): string[] {
  const { productPrompt } = stripGeneratorDirectives(prompt);
  const lines: string[] = [];
  for (const raw of productPrompt.split(/\r?\n+/)) {
    const withoutBullet = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim();
    if (withoutBullet.length === 0) continue;
    // Parenthetical-only lines are noise once directives are stripped.
    if (/^\([^)]*\)$/.test(withoutBullet)) continue;
    lines.push(withoutBullet);
  }
  if (lines.length === 0 && productPrompt.trim().length > 0) {
    return [productPrompt.trim()];
  }
  return lines;
}

/**
 * Derive domain entity names from the prompt when the wizard left entities empty.
 *
 * Pulls capitalised terms and repeated content nouns (e.g. Crop, PlantingWindow).
 * Never invents a generic "Item" — returns [] so the caller can fail closed.
 *
 * @param prompt - Raw wizard prompt.
 * @returns PascalCase entity names, primary-first, de-duplicated.
 */
export function deriveEntities(prompt: string): string[] {
  const { productPrompt } = stripGeneratorDirectives(prompt);
  if (productPrompt.trim().length === 0) return [];

  const found: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string): void => {
    const pascal = entityPascal(raw);
    if (pascal.length === 0) return;
    if (GENERIC_DOMAIN.test(pascal) || GENERIC_DOMAIN.test(raw)) return;
    if (pascal.length < 2) return;
    const key = pascal.toLowerCase();
    if (seen.has(key)) return;
    // Skip pure stopword entities and numeric ids alone.
    if (ENTITY_STOP.has(key)) return;
    if (/^\d+$/.test(pascal)) return;
    seen.add(key);
    found.push(pascal);
  };

  // Capitalised multi-word and single-token domain names (Crop, PlantingWindow, Zone).
  const capitalRe = /\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = capitalRe.exec(productPrompt)) !== null) {
    const token = m[1] ?? '';
    // Skip all-caps acronyms longer than 6 (likely codes) unless alphanumeric ids.
    if (/^[A-Z]{2,6}\d*$/.test(token)) {
      // Keep document ids like AZ1005 as Source-ish only when not the primary noun.
      continue;
    }
    if (!ENTITY_STOP.has(token.toLowerCase())) push(token);
  }

  // Compound phrases that map to real tables for this class of app.
  const compoundPatterns: readonly { re: RegExp; name: string }[] = [
    { re: /\bplanting\s+windows?\b/i, name: 'PlantingWindow' },
    { re: /\bhalf[-\s]?month\s+windows?\b/i, name: 'PlantingWindow' },
    { re: /\bplantable\b/i, name: 'Crop' },
    { re: /\bcrops?\b/i, name: 'Crop' },
    { re: /\bzones?\b/i, name: 'Zone' },
    { re: /\bflights?\b/i, name: 'Flight' },
    { re: /\btrips?\b/i, name: 'Trip' },
    { re: /\bshifts?\b/i, name: 'Shift' },
    { re: /\binvoices?\b/i, name: 'Invoice' },
    { re: /\breminders?\b/i, name: 'Reminder' },
    { re: /\blistings?\b/i, name: 'Listing' },
    { re: /\buptime\s+checks?\b/i, name: 'UptimeCheck' },
    { re: /\bstatus\s+pages?\b/i, name: 'StatusPage' }
  ];
  for (const { re, name } of compoundPatterns) {
    if (re.test(productPrompt)) push(name);
  }

  // Repeated lowercase content nouns (appear 2+ times) as soft signal.
  const words = productPrompt
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !ENTITY_STOP.has(w) && !/^\d+$/.test(w));
  const counts = new Map<string, number>();
  for (const w of words) {
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  for (const [w, n] of counts) {
    if (n >= 2) push(w);
  }

  // Cap so a chatty prompt does not explode the schema.
  return found.slice(0, 6);
}

/**
 * Whether a derived title is still a sentence fragment, not a product name.
 * True when it ends mid-clause or is a long imperative/description with no
 * compact noun-phrase shape.
 *
 * @param title - Candidate product title.
 * @returns True when Forge should require an explicit product name.
 */
export function isTitleFragment(title: string): boolean {
  const words = title
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return true;
  const last = words[words.length - 1]!.toLowerCase();
  if (DANGLING_TAIL.has(last)) return true;
  if (words.length > TITLE_MAX_WORDS) return true;
  // Imperative / sentence openers that were not reduced to a noun phrase.
  if (
    words.length > 4 &&
    /^(show|find|build|create|make|list|display|browse|track|search)$/i.test(words[0]!)
  ) {
    return true;
  }
  return false;
}

/**
 * Derive a short product title (noun phrase) from the first line's subject.
 * Prefer a compact domain name over truncating a multi-line sentence at 72 chars.
 *
 * @param prompt - Raw wizard prompt.
 * @returns Title Case product name.
 */
export function titleFromPrompt(prompt: string): string {
  const { productPrompt } = stripGeneratorDirectives(prompt);
  const firstLine = (productPrompt.split(/\r?\n/)[0] ?? productPrompt).trim();
  if (firstLine.length === 0) return 'New App';

  // "X scheduling/calendar/tracker app" and "X calendar/tracker/dashboard".
  const schedulingShape =
    /\b((?:[a-z][a-z0-9]+\s+){0,2}[a-z][a-z0-9]+)\s+scheduling(?:\s+app)?\b/i.exec(productPrompt);
  if (schedulingShape) {
    return toTitleCase(`${schedulingShape[1]} Scheduling`);
  }
  const productShape =
    /\b((?:[a-z][a-z0-9]+\s+){0,3}[a-z][a-z0-9]+)\s+(calendar|tracker|dashboard|scheduler|planner|catalog|directory|board|monitor)\b/i.exec(
      productPrompt
    );
  if (productShape) {
    const left = (productShape[1] ?? '').trim();
    // Avoid "full year calendar" from a grid description when a better subject exists later.
    if (!/^(full|year|simple|status)$/i.test(left.split(/\s+/)[0] ?? '')) {
      return toTitleCase(`${left} ${productShape[2]}`);
    }
    if (/calendar/i.test(productShape[2] ?? '') && /\bplant/i.test(productPrompt)) {
      return 'Planting Calendar';
    }
  }

  // "app for/that … X" / "tracking X" / "show what is X".
  // Prefer "tracking/find X" over "app for <audience>" so "app for Small Businesses"
  // does not beat "Shift Scheduling".
  const patterns: RegExp[] = [
    /\b(?:finds?|search(?:es)? for|tracks?|shows?|lists?|displays?|browses?)\s+(?:the\s+|what\s+is\s+|a\s+|an\s+)?(.+?)(?:\s+with\b|\s+in\b|\s+for\b|[.,]|$)/i,
    /\btracking\s+(.+?)(?:\s+with\b|[.,]|$)/i,
    /\b(?:app|application|tool|system)\s+(?:for|that|to)\s+(?:finds?\s+|tracks?\s+|shows?\s+|lists?\s+|manages?\s+|schedules?\s+)(.+?)(?:\s+with\b|[.,]|$)/i
  ];
  for (const re of patterns) {
    const hit = re.exec(firstLine) ?? re.exec(productPrompt);
    const raw = (hit?.[1] ?? '')
      .replace(/\b(lowest|highest|cheapest|best|fastest|cost|price|current)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (raw.length > 2 && !GENERIC_DOMAIN.test(raw) && raw.split(/\s+/).length <= TITLE_MAX_WORDS) {
      const titled = toTitleCase(raw);
      if (!isTitleFragment(titled)) return titled;
    }
  }

  // Fall back to first content words of the first line only (never the full multi-line blob).
  const cleaned = firstLine
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  // Drop leading imperatives / articles so the residue can be a noun phrase.
  while (
    words.length > 1 &&
    /^(show|find|build|create|make|list|display|browse|track|search|a|an|the|what|is)$/i.test(
      words[0]!
    )
  ) {
    words.shift();
  }
  while (words.length > 1 && DANGLING_TAIL.has(words[words.length - 1]!.toLowerCase())) {
    words.pop();
  }
  const clipped = words.slice(0, TITLE_MAX_WORDS);
  while (clipped.length > 1 && DANGLING_TAIL.has(clipped[clipped.length - 1]!.toLowerCase())) {
    clipped.pop();
  }
  if (clipped.length === 0) return 'New App';
  return toTitleCase(clipped.join(' '));
}

/**
 * Title-case with mid-title stopwords lowercased.
 *
 * @param value - Raw phrase.
 * @returns Title Case string.
 */
function toTitleCase(value: string): string {
  const words = value
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'New App';
  return words
    .map((w, i) =>
      i > 0 && STOPWORDS.has(w.toLowerCase()) ? w.toLowerCase() : w[0]!.toUpperCase() + w.slice(1).toLowerCase()
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
 * Empty input returns "" — callers must not invent a domain noun here.
 * Already-Pascal compounds (`PlantingWindow`, `UptimeCheck`) keep internal capitals.
 */
export function entityPascal(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '';

  // Preserve multi-hump PascalCase from deriveEntities compound patterns.
  if (/^[A-Z][a-z0-9]*(?:[A-Z][a-z0-9]+)+$/.test(trimmed)) {
    return trimmed;
  }

  const parts = trimmed
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '';
  return parts
    .map((part) => {
      // Split internal camelCase so "UptimeCheck" as a single token still works
      // when it arrived with mixed case but failed the pure-Pascal guard.
      const humps = part.split(/(?=[A-Z])/).filter(Boolean);
      if (humps.length > 1 && /[a-z]/.test(part) && /[A-Z]/.test(part)) {
        return humps
          .map((h) => {
            const lower = h.toLowerCase();
            return lower[0]!.toUpperCase() + lower.slice(1);
          })
          .join('');
      }
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
 * Primary entity PascalCase label, or null when the list is empty.
 * Single helper so call sites cannot drift back to inventing "Item".
 *
 * @param entities - Domain entity names (primary first).
 * @returns PascalCase primary, or null.
 */
export function primaryEntity(entities: readonly string[]): string | null {
  const first = entities[0]?.trim();
  if (!first) return null;
  const pascal = entityPascal(first);
  return pascal.length > 0 ? pascal : null;
}

/**
 * Normalize an entity label to a plural snake_case table / route segment
 * (e.g. "Trip" → "trips", "ear cleaning" → "ear_cleanings").
 */
export function entityTable(name: string): string {
  const pascal = entityPascal(name);
  if (pascal.length === 0) return '';
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
