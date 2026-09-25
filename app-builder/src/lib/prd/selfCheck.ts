import type { PrdSelfCheckItem, PrdSelfCheckResult } from './types';
import { PRD_SECTION_HEADINGS, PRD_THRESHOLD } from './types';
import { entityTable, requirementLines } from './naming';
import { FUNCTION_WORDS } from './namingWords';
import {
  DEFINITION_OF_DONE_HEADING,
  DONE_CHECKLIST_SECTIONS
} from './sections/doneChecklist';

/**
 * Placeholder / incomplete markers that must not appear in a finished PRD body.
 * Excludes the self-check label text itself so grading is not self-defeating.
 */
/** Incomplete stub markers; word-boundary so normal prose is safe. */
const PLACEHOLDER_RE = /\b(TBD|TODO|FIXME|lorem ipsum)\b/i;

/** Stopwords ignored when building a head noun phrase for fidelity matching. */
const FIDELITY_STOP = new Set<string>([
  ...FUNCTION_WORDS,
  'show',
  'list',
  'display',
  'browse',
  'view',
  'every',
  'full',
  'current',
  'marked',
  'across',
  'down',
  'notes'
]);

/**
 * Head noun phrase for a requirement line — distinctive content used to check
 * whether the PRD actually describes what the user asked for.
 *
 * Prefers known multi-word domain phrases (e.g. "half-month window", "days to
 * harvest") when present; otherwise the first few content tokens.
 *
 * @param line - One requirement line from the prompt.
 * @returns Lowercased phrase for matching, or empty when none.
 */
export function headNounPhrase(line: string): string {
  const lower = line.toLowerCase();
  const known: readonly string[] = [
    'seed vs transplant',
    'half-month window',
    'days to harvest',
    'filter by month',
    'cites az1005',
    'planting window',
    'calendar grid',
    'lowest cost',
    'travel time'
  ];
  for (const phrase of known) {
    if (lower.includes(phrase)) return phrase;
  }

  const withoutParen = line.replace(/\([^)]*\)/g, ' ');
  // Drop leading imperative/boilerplate so the head is the domain noun phrase.
  const stripped = withoutParen
    .replace(
      /^(?:build|create|make|show|list|display|browse|view|find|track|search|an?\s+app\s+(?:for|to|that)\s+)\s*/i,
      ''
    )
    .replace(/^(?:an?\s+app\s+to\s+|app\s+to\s+|for\s+)/i, '');
  const tokens = stripped
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s/-]+/g, ' ')
    .split(/[\s/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !FIDELITY_STOP.has(t) && !/^(app|build|track|tracking|remind|reminds?)$/.test(t));
  if (tokens.length >= 2) {
    return tokens.slice(0, 3).join(' ');
  }
  return tokens[0] ?? '';
}

/**
 * Share of a requirement's content words that must appear in the features for
 * it to count as covered, when its head phrase does not appear verbatim.
 *
 * Calibrated 2026-09-24 on real documents, features and acceptance text only
 * (coverage of the prompt line):
 *   0.429  "remind you when your dog needs grooming..." with a thin spec
 *   0.357  dog-care PRD generated from the wizard entity spec (right product)
 *   0.333  old sushi-finder PRD (generic title/description CRUD)
 *   0.286  old dog-care PRD: a double-booking scheduler, the wrong product
 *   0.273  old plant-water-tracker PRD
 *   0.182  old herb-garden-log PRD
 * 0.35 passes the right product and fails every generic or wrong one, but the
 * margin is 0.024: word overlap is a weak proxy. It fails closed, so a borderline
 * good PRD stops the build and asks the owner; the owner's job approval and the
 * claims-based gate checks remain the primary defences. An earlier version also
 * scored the declared entity names, which let the wrong product pass at 0.43.
 */
export const FIDELITY_MIN_COVERAGE = 0.35;

/**
 * Lower-case, singular content words, with camelCase split (`dueDate` gives
 * `due` and `date`) so declared field names count as domain words.
 *
 * @param text - Requirement line or feature corpus.
 * @returns Content words, stopwords removed.
 */
function fidelityWords(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !FIDELITY_STOP.has(word) && !FIDELITY_FILLER.has(word))
    .map(fidelityStem);
}

/**
 * Pronouns and request filler that say nothing about the product, so they must
 * not count against coverage ("an app to remind you when your dog ...").
 */
const FIDELITY_FILLER = new Set([
  'app', 'you', 'your', 'they', 'their', 'them', 'when', 'what', 'which', 'who',
  'need', 'needs', 'want', 'wants', 'can', 'will', 'should', 'would', 'like',
  'such', 'etc', 'per', 'into', 'via', 'about', 'all', 'any', 'each', 'some', 'user', 'users'
]);

/**
 * Crude stem so `reminder`/`remind`, `cleaning`/`clean` and `tasks`/`task` meet.
 * Only strips a suffix when a stem of at least four letters remains.
 *
 * @param word - Lower-case word.
 * @returns Stemmed word.
 */
function fidelityStem(word: string): string {
  for (const suffix of ['ings', 'ing', 'ers', 'er', 'ed', 'es', 's']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 4 && !word.endsWith('ss')) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

/**
 * Share of a requirement line's content words that appear in the corpus.
 *
 * @param line - One prompt requirement line.
 * @param corpus - Feature text plus declared entity and field names.
 * @returns 1 when the line has no content words, otherwise covered / total.
 */
export function requirementCoverage(line: string, corpus: string): number {
  const words = [...new Set(fidelityWords(line))];
  if (words.length === 0) return 1;
  const corpusWords = new Set(fidelityWords(corpus));
  return words.filter((word) => corpusWords.has(word)).length / words.length;
}

/**
 * Prompt requirement lines the features do not cover.
 *
 * A line is covered when its head noun phrase appears in the features, or when
 * at least {@link FIDELITY_MIN_COVERAGE} of its content words do. The old rule
 * needed every one of the first three content words, so "A reminder app for
 * dog owners ..." failed on the word "owners" however right the features were.
 *
 * @param prompt - The product prompt.
 * @param featureCorpus - Core features, acceptance criteria, and declared entity/field names.
 * @returns Requirement lines that are not covered.
 */
export function unmatchedPromptRequirements(prompt: string, featureCorpus: string): string[] {
  const corpus = featureCorpus.toLowerCase();
  const unmatched: string[] = [];
  for (const line of requirementLines(prompt)) {
    const head = headNounPhrase(line);
    if (head.length === 0) continue;
    if (corpus.includes(head)) continue;
    if (requirementCoverage(line, featureCorpus) < FIDELITY_MIN_COVERAGE) unmatched.push(line);
  }
  return unmatched;
}

/**
 * Extract feature names, behaviors, and acceptance bullets from PRD markdown
 * for prompt-fidelity grading.
 *
 * @param markdown - Full or partial PRD markdown.
 * @returns Lowercase-ready corpus string.
 */
function featureCorpusFromMarkdown(markdown: string): string {
  const core = markdown.match(/## 8\. Core Features[\s\S]*?(?=\n## \d+\.)/)?.[0] ?? '';
  const acceptance = markdown.match(/## 9\. Acceptance Criteria[\s\S]*?(?=\n## \d+\.)/)?.[0] ?? '';
  return `${core}\n${acceptance}`;
}

/**
 * Grade PRD markdown against verifiable completeness checks.
 * Score is always computed from the checks — never a hardcoded grade.
 *
 * @param markdown - Full PRD markdown (or a partial document under test).
 * @param opts - Optional generation context for entity/DDL and fidelity checks.
 */
export function evaluatePrdSelfCheck(
  markdown: string,
  opts?: { entities?: string[]; hasDomainTables?: boolean; prompt?: string }
): PrdSelfCheckResult {
  const entities = opts?.entities ?? [];
  const hasDomainTables = opts?.hasDomainTables ?? true;
  const prompt = opts?.prompt ?? '';

  // Body used for placeholder scan: strip the self-check section so its own
  // checklist labels (which mention "placeholder") do not fail the check.
  const selfCheckAt = markdown.indexOf('## 14. PRD Self-Check');
  const bodyForPlaceholders = selfCheckAt >= 0 ? markdown.slice(0, selfCheckAt) : markdown;

  const hasFrontmatter =
    /```yaml[\s\S]*?threshold:\s*\d+[\s\S]*?```/.test(markdown) ||
    /```yaml[\s\S]*?slug:\s*".+?"[\s\S]*?```/.test(markdown);

  const problemSection = markdown.match(/## 2\. Problem Statement\s*\n+([\s\S]*?)(?=\n## \d+\.)/);
  const problemText = problemSection?.[1]?.trim() ?? '';

  const userStoryCount = (markdown.match(/As a \*\*[^*]+\*\*, I want/g) ?? []).length;

  const mvpFeatureCount = (markdown.match(/\*\*\[MVP\]\*\*/g) ?? []).length;

  // Acceptance bullets under §9: lines that look like "- GIVEN ..." or plain "- ..." after Acceptance criteria
  const acceptanceSection = markdown.match(
    /## 9\. Acceptance Criteria\s*\n+([\s\S]*?)(?=\n## \d+\.)/
  );
  const acceptanceBody = acceptanceSection?.[1] ?? '';
  const featureBlocks = acceptanceBody.split(/### F\d+ —/).slice(1);
  const everyFeatureHasAcceptanceBullet =
    featureBlocks.length > 0 && featureBlocks.every((block) => /^\s*-\s+\S+/m.test(block));

  const entityDdlPresent =
    !hasDomainTables || entities.length === 0
      ? markdown.includes('CREATE TABLE') || markdown.includes('No D1 domain schema')
      : entities.every((e) => markdown.includes(`CREATE TABLE IF NOT EXISTS ${entityTable(e)}`));

  const slicesWithVerify =
    (markdown.match(/### Slice \d+ —/g) ?? []).length > 0 &&
    (markdown.match(/^- Verify: `/gm) ?? []).length >=
      (markdown.match(/### Slice \d+ —/g) ?? []).length;

  const noPlaceholders = !PLACEHOLDER_RE.test(bodyForPlaceholders);

  const gateNamed =
    /npm run gate -- /.test(markdown) && markdown.includes(`--threshold ${PRD_THRESHOLD}`);

  // Presence of the heading alone would pass on an empty stub, so require the
  // rows too. Section letters A-G each carry requirements; a document with the
  // heading and no rows has emitted nothing a builder can act on.
  const hasDefinitionOfDone =
    markdown.includes(DEFINITION_OF_DONE_HEADING) &&
    DONE_CHECKLIST_SECTIONS.every((section) =>
      section.rows.every((row) => markdown.includes(`**${row.id}**`))
    );

  const hasApiExample =
    /Request:\s*\{[\s\S]*?\}/.test(markdown) && /Response:\s*\d{3}\s*\{/.test(markdown);

  const sectionsInOrder = PRD_SECTION_HEADINGS.every((heading, i) => {
    const at = markdown.indexOf(`## ${heading}`);
    if (at < 0) return false;
    if (i === 0) return true;
    const prevAt = markdown.indexOf(`## ${PRD_SECTION_HEADINGS[i - 1]}`);
    return prevAt >= 0 && prevAt < at;
  });

  // Fidelity grades against §8/§9. When those sections are absent (unit tests on
  // incomplete stubs), treat as N/A-pass so structure checks stay independent.
  const corpus = featureCorpusFromMarkdown(markdown);
  const hasFeatureSections = /## 8\. Core Features/.test(markdown) && /## 9\. Acceptance/.test(markdown);
  const unmatched =
    prompt.trim().length > 0 && hasFeatureSections
      ? unmatchedPromptRequirements(prompt, corpus)
      : [];
  const fidelityPass =
    prompt.trim().length === 0 || !hasFeatureSections || unmatched.length === 0;
  const fidelityLabel =
    unmatched.length === 0
      ? 'Prompt fidelity: every requirement line appears in a feature'
      : `Prompt fidelity: unmatched requirements — ${unmatched
          .map((line) => line.replace(/\s+/g, ' ').slice(0, 60))
          .join('; ')}`;

  // Standard features every generated PRD must name. Missing either means the
  // document is not gradeable at 100% -- same hole that shipped a collection
  // with no search and no assistant. Grade against §8 only so §14's own labels
  // and slice names cannot satisfy the check.
  const coreFeaturesSection =
    markdown.match(/## 8\. Core Features[\s\S]*?(?=\n## \d+\.)/)?.[0] ?? '';
  const hasSearchFeature = /### F\d+ — Search and filter /i.test(coreFeaturesSection);
  const hasAssistantFeature = /### F\d+ — Ask the assistant about /i.test(coreFeaturesSection);

  const items: PrdSelfCheckItem[] = [
    { id: 'frontmatter', label: 'Machine frontmatter present', pass: hasFrontmatter },
    { id: 'problem', label: 'Problem statement present', pass: problemText.length > 0 },
    { id: 'user-stories', label: 'At least one user story', pass: userStoryCount >= 1 },
    { id: 'mvp-features', label: 'At least one MVP feature marked', pass: mvpFeatureCount >= 1 },
    {
      id: 'search-feature',
      label: 'Search and filter feature present (standard)',
      pass: hasSearchFeature
    },
    {
      id: 'assistant-feature',
      label: 'Ask the assistant feature present (standard)',
      pass: hasAssistantFeature
    },
    {
      id: 'acceptance-bullets',
      label: 'Every feature has ≥1 acceptance bullet',
      pass: everyFeatureHasAcceptanceBullet
    },
    {
      id: 'ddl',
      label: 'DDL present for every entity (or explicit none)',
      pass: entityDdlPresent
    },
    {
      id: 'slice-verify',
      label: 'Every vertical slice has a verify command',
      pass: slicesWithVerify
    },
    {
      id: 'no-placeholders',
      label: 'No placeholder tokens (TBD/TODO/lorem) in body',
      pass: noPlaceholders
    },
    { id: 'gate', label: 'Gate command named with threshold', pass: gateNamed },
    // The gate score was never the finish line. A PRD that names the gate but not
    // the definition of done lets a builder clear the threshold and reasonably
    // believe it is finished, which is exactly how apps shipped 'green' and broken.
    {
      id: 'definition-of-done',
      label: 'Definition of Done checklist embedded (non-optional)',
      pass: hasDefinitionOfDone
    },
    {
      id: 'api-examples',
      label: 'API example includes request and response bodies',
      pass: hasApiExample
    },
    {
      id: 'sections-order',
      label: 'All 14 standard sections present in order',
      pass: sectionsInOrder
    },
    {
      id: 'success-outcome',
      label: 'Success Outcome (definition of done) present',
      pass: /## 4\. Success Outcome/.test(markdown) && markdown.includes('score >=')
    },
    {
      id: 'prompt-fidelity',
      label: fidelityLabel,
      pass: fidelityPass
    }
  ];

  const passed = items.filter((i) => i.pass).length;
  const total = items.length;
  const percent = total === 0 ? 0 : Math.round((passed / total) * 100);
  // A fidelity miss used to still print "15/16 (94%)", which reads as a pass
  // against the gate threshold of 90. The checklist row already fails. The
  // grade line has to say so, or the percentage is the only thing a reader sees.
  const fidelityFailed = items.some((item) => item.id === 'prompt-fidelity' && !item.pass);
  const gradeLine = fidelityFailed
    ? `**Grade: FAIL — prompt fidelity failed (${passed}/${total} checks, ${percent}%)**`
    : `**Grade: ${passed}/${total} checks passed (${percent}%)**`;

  const checklist = items.map((i) => `- [${i.pass ? 'x' : ' '}] ${i.label}`).join('\n');
  const markdownOut = [
    '## 14. PRD Self-Check',
    '',
    'Completeness graded from this document at generation time (not a hardcoded score).',
    '',
    checklist,
    '',
    gradeLine
  ].join('\n');

  return { items, passed, total, percent, markdown: markdownOut };
}
