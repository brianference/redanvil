import type { DataStorage } from '../job';
import { parseEntitySpec } from './entitySpec';
import {
  STOPWORDS,
  DANGLING_TAIL,
  TITLE_MAX_WORDS,
  TITLE_BARE_ADJECTIVES,
  GENERIC_DOMAIN,
  ENTITY_STOP,
  PRONOUN_HEADS,
  NP_DETERMINERS
} from './namingWords';

/**
 * Content words of a short noun phrase after leading determiners are dropped.
 *
 * @param phrase - Entity or subject candidate.
 * @returns Lowercased remaining words, or empty.
 */
function nounPhraseContentWords(phrase: string): string[] {
  const words = phrase
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && NP_DETERMINERS.has(words[0]!)) {
    words.shift();
  }
  return words;
}

/**
 * Whether a phrase is unusable as a domain entity or feature subject because
 * a remaining content word is a pronoun (`ones`, `them`, `they`, …).
 *
 * "those listings" is allowed (determiner + noun). "ones they sent" is not.
 *
 * @param phrase - Entity or subject candidate.
 * @returns True when the phrase cannot be a domain noun.
 */
export function hasPronounHead(phrase: string): boolean {
  const words = nounPhraseContentWords(phrase);
  if (words.length === 0) return true;
  return words.some((word) => PRONOUN_HEADS.has(word));
}

/**
 * Whether a phrase is a lone attributive adjective, not a domain noun.
 * Lets extractSubject refuse to title a feature "Search real" from
 * "shows real, current job openings".
 *
 * @param phrase - Subject candidate.
 * @returns True when the whole phrase is one listed adjective.
 */
export function isBareAdjective(phrase: string): boolean {
  const words = phrase
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return words.length === 1 && TITLE_BARE_ADJECTIVES.has(words[0]!);
}

/**
 * Whether a single token is an entity-mining stopword (verbs, function words,
 * generic software words). A capture that is only this cannot be a subject.
 *
 * @param word - One token.
 * @returns True when the token is not a domain noun.
 */
export function isEntityStopWord(word: string): boolean {
  return ENTITY_STOP.has(word.trim().toLowerCase());
}

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
 * Leading action verbs that mark a title as a task phrase, not a product name.
 * Includes "book" / "schedule" / "manage" so "Book Trusted Local Pet Sitters"
 * and residue after stripping "Find and …" are both caught.
 */
const TITLE_LEADING_VERBS =
  /^(show|find|build|create|make|list|display|browse|track|search|book|schedule|manage|get|hire|order|buy|sell|rent)$/i;

/**
 * Coordinating conjunctions that only appear when a verb-phrase cut left mid-sentence
 * residue (e.g. "And Book Trusted Local Pet Sitters" from "Find and book …").
 */
const TITLE_LEADING_CONJUNCTION = /^(and|or|but)$/i;

/**
 * Whether a derived title is still a sentence fragment, not a product name.
 * True when it ends mid-clause, starts with a verb/conjunction residue, or is a
 * long imperative/description with no compact noun-phrase shape.
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
  // "Real", "Current", "Live" — a lone adjective is not a product name.
  if (words.length === 1 && TITLE_BARE_ADJECTIVES.has(last)) return true;
  if (words.length > TITLE_MAX_WORDS) return true;
  const first = words[0]!;
  // Mid-sentence residue: "And Book Trusted…" from stripping only the first verb.
  if (TITLE_LEADING_CONJUNCTION.test(first)) return true;
  // Imperative / task openers are never product names, whatever their length.
  if (TITLE_LEADING_VERBS.test(first)) return true;
  // "Find And Book …" style: verb + conjunction still visible.
  if (
    words.length >= 2 &&
    TITLE_LEADING_VERBS.test(first) &&
    TITLE_LEADING_CONJUNCTION.test(words[1]!)
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
  //
  // Do NOT let "Find and book trusted local pet sitters" capture "and book …"
  // as the product name — strip leading verb chains first (see stripLeadingVerbPhrase).
  const patterns: RegExp[] = [
    /\b(?:finds?|search(?:es)? for|tracks?|shows?|lists?|displays?|browses?)\s+(?:the\s+|what\s+is\s+|a\s+|an\s+)?(.+?)(?:\s+with\b|\s+in\b|\s+for\b|[.,]|$)/i,
    /\btracking\s+(.+?)(?:\s+with\b|[.,]|$)/i,
    /\b(?:app|application|tool|system)\s+(?:for|that|to)\s+(?:finds?\s+|tracks?\s+|shows?\s+|lists?\s+|manages?\s+|schedules?\s+|books?\s+)(.+?)(?:\s+with\b|[.,]|$)/i
  ];
  for (const re of patterns) {
    // First line only. Searching the whole blob is how "shows real, current
    // job openings" titled a job tracker "Real", and how "applicant tracking
    // system for employers" — in the What-this-is-NOT paragraph — titled it
    // "System for Employers".
    const hit = re.exec(firstLine);
    const raw = stripLeadingVerbPhrase(
      (hit?.[1] ?? '')
        .replace(/\b(lowest|highest|cheapest|best|fastest|cost|price|current)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
    );
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
  const words = stripAudienceTail(stripLeadingVerbPhrase(cleaned)).split(/\s+/).filter(Boolean);
  while (words.length > 1 && DANGLING_TAIL.has(words[words.length - 1]!.toLowerCase())) {
    words.pop();
  }
  const clipped = words.slice(0, TITLE_MAX_WORDS);
  while (clipped.length > 1 && DANGLING_TAIL.has(clipped[clipped.length - 1]!.toLowerCase())) {
    clipped.pop();
  }
  if (clipped.length === 0) return 'New App';
  const titled = toTitleCase(clipped.join(' '));
  // Last resort: if still a fragment, prefer the trailing noun phrase (last 2–3 words).
  if (isTitleFragment(titled) && clipped.length > 2) {
    const tail = clipped.slice(-3);
    const tailTitle = toTitleCase(tail.join(' '));
    if (!isTitleFragment(tailTitle)) return tailTitle;
  }
  return titled;
}

/**
 * Cut a trailing "for a/an/the <audience>" so a first-line fallback like
 * "job application site for a person who is job hunting" becomes
 * "job application site". Requires at least two words before `for` so
 * "app for X" is not reduced to the generic "app".
 *
 * @param phrase - Verb-stripped first-line residue.
 * @returns Phrase without the audience tail, or the original.
 */
function stripAudienceTail(phrase: string): string {
  const cut = /^(.*?)\s+for\s+(?:a|an|the)\s+/i.exec(phrase);
  const left = (cut?.[1] ?? '').trim();
  if (left.split(/\s+/).filter(Boolean).length >= 2 && !GENERIC_DOMAIN.test(left)) {
    return left;
  }
  return phrase;
}

/**
 * Strip leading imperative verbs, articles, and "and/or + verb" chains so a
 * task phrase reduces to its noun object.
 *
 * "Find and book trusted local pet sitters" → "trusted local pet sitters"
 *
 * @param phrase - Raw capture or first-line text.
 * @returns Residue after verb-phrase stripping.
 */
function stripLeadingVerbPhrase(phrase: string): string {
  const words = phrase
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  // Drop leading imperatives, articles, copulae, and coordinating conjunctions
  // that only glue verb chains ("find and book …").
  while (words.length > 1) {
    const w = words[0]!.toLowerCase();
    if (
      TITLE_LEADING_VERBS.test(w) ||
      TITLE_LEADING_CONJUNCTION.test(w) ||
      /^(a|an|the|what|is|are|to)$/i.test(w)
    ) {
      words.shift();
      continue;
    }
    break;
  }
  return words.join(' ');
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

/**
 * Entity names from a Main entities spec, in source order.
 *
 * Legacy comma lists still return names. A spec with fields returns the
 * entity names only, not the field tokens.
 *
 * @param entities - Entity spec text.
 * @returns Parsed entity names. Invalid names are omitted.
 */
export function entityList(entities: string): string[] {
  return parseEntitySpec(entities).entities.map((entity) => entity.name);
}

/**
 * Normalize an entity label to a singular PascalCase type name (e.g. "trips" → "Trip").
 * Empty input returns "" — callers must not invent a domain noun here.
 * Already-Pascal compounds (`PlantingWindow`, `UptimeCheck`) keep internal capitals.
 */
export function entityPascal(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '';

  // Preserve multi-hump PascalCase such as PlantingWindow or UptimeCheck.
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
