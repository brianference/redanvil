/**
 * Word lists the naming heuristics in ./naming.ts read: stopwords, title tails, bare adjectives, pronoun heads.
 */
export const STOPWORDS = new Set([
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
export const DANGLING_TAIL = new Set([
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
  'versus',
  // Possessive determiners. These ALWAYS introduce the noun they belong to, so
  // a title ending on one is cut mid-phrase by construction. Missing them let
  // "an app to remind you when your dogs ears need cleaned…" title itself
  // "App to Remind You When Your" -- and because isTitleFragment returned false,
  // every downstream guard agreed it was a finished name and shipped it as the
  // product's H1.
  'your',
  'my',
  'our',
  'their',
  'its',
  'his',
  'her',
  // Subordinating/relative words, same failure shape as 'that' and 'which'
  // which were already here.
  'when',
  'where',
  'while',
  'who',
  'whose',
  'if',
  // Copulas and bare auxiliaries cannot end a noun phrase either.
  'is',
  'are',
  'was',
  'were',
  'be',
  'need',
  'needs'
]);

/** Soft max words for a product title (noun phrase, not a sentence). */
export const TITLE_MAX_WORDS = 6;

/**
 * Attributive adjectives that are not a product name on their own.
 * The shows/finds capture stops at a comma, so "shows real, current job
 * openings" titled itself "Real". A single leading adjective lifted out of
 * the middle of a sentence is a fragment, not a name.
 */
export const TITLE_BARE_ADJECTIVES = new Set([
  'real',
  'current',
  'simple',
  'new',
  'live',
  'genuine',
  'public',
  'original',
  'personal',
  'local',
  'actual',
  'extra',
  'entire',
  'whole',
  'single',
  'upcoming',
  'dark',
  'light',
  'pale',
  'full',
  'empty',
  'open',
  'closed',
  'best',
  'lowest',
  'highest',
  'cheapest',
  'first',
  'last',
  'next',
  'other',
  'same',
  'own',
  'true',
  'false',
  'free',
  'paid',
  'remote',
  'onsite',
  'good',
  'great',
  'bad',
  'old',
  'latest',
  'earliest',
  'specific',
  'general',
  'common',
  'official',
  'native'
]);

/**
 * Words that name software packaging rather than a domain entity. Used when
 * deriving entities and titles so "app" / "tool" never become the product noun.
 */
export const GENERIC_DOMAIN =
  /^(?:an?\s+)?(?:simple\s+|full[- ]stack\s+|mobile[- ]first\s+|web\s+)*(?:app|application|tool|system|site|website|platform|dashboard|record|thing|product|service|page|status)s?$/i;

/**
 * Articles, prepositions, conjunctions and copulas. Shared by the entity miner
 * and the PRD fidelity check so the two cannot drift on what counts as a word
 * with no domain meaning.
 */
export const FUNCTION_WORDS = [
  'a',
  'an',
  'the',
  'for',
  'with',
  'from',
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
  'be',
  'this',
  'that'
] as const;

/** Common English function words skipped when mining domain nouns. */
export const ENTITY_STOP = new Set<string>([
  ...FUNCTION_WORDS,
  'into',
  'onto',
  'was',
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
  'versus',
  // Sentence-initial function words / ordinals / imperatives. CapitalRe
  // otherwise lifts "If", "Do", "Second", "Each", "Verify" out of
  // "If the first source…", "Do not fabricate…", "Second, it lets…".
  'if',
  'do',
  'first',
  'second',
  'third',
  'each',
  'both',
  'verify',
  'never',
  'keep',
  'someone',
  'it',
  'one',
  'they',
  'them',
  'have',
  'sent',
  'does',
  'let'
]);

/**
 * Pronouns that cannot be the head (or a remaining content word) of a domain
 * entity or a feature subject. A phrase-shape heuristic matching these is how
 * "loses track of which ones they sent" became a feature name.
 */
export const PRONOUN_HEADS = new Set([
  'ones',
  'one',
  'those',
  'them',
  'it',
  'they',
  'which',
  'anyone',
  'anybody',
  'someone',
  'somebody',
  'everyone',
  'everybody',
  'nobody',
  'you'
]);

/**
 * Leading determiners stripped before the remaining words are checked for
 * pronouns. "those listings" is headed by listings; a bare "those" is not.
 */
export const NP_DETERMINERS = new Set(['a', 'an', 'the', 'this', 'that', 'these', 'those', 'which']);
