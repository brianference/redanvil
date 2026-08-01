import type { PrdSelfCheckItem, PrdSelfCheckResult } from './types';
import { PRD_SECTION_HEADINGS, PRD_THRESHOLD } from './types';
import { entityTable, requirementLines } from './naming';

/**
 * Placeholder / incomplete markers that must not appear in a finished PRD body.
 * Excludes the self-check label text itself so grading is not self-defeating.
 */
/** Incomplete stub markers; word-boundary so normal prose is safe. */
const PLACEHOLDER_RE = /\b(TBD|TODO|FIXME|lorem ipsum)\b/i;

/** Stopwords ignored when building a head noun phrase for fidelity matching. */
const FIDELITY_STOP = new Set([
  'a',
  'an',
  'the',
  'for',
  'with',
  'and',
  'or',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'from',
  'is',
  'are',
  'be',
  'as',
  'this',
  'that',
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
 * Requirement lines whose head noun phrase does not appear in feature text.
 *
 * @param prompt - Original product prompt (not generator directives).
 * @param featureCorpus - Concatenated feature names, behaviors, and acceptance.
 * @returns Unmatched requirement lines (original wording), order preserved.
 */
export function unmatchedPromptRequirements(prompt: string, featureCorpus: string): string[] {
  const corpus = featureCorpus.toLowerCase();
  const unmatched: string[] = [];
  for (const line of requirementLines(prompt)) {
    const head = headNounPhrase(line);
    if (head.length === 0) continue;
    // Phrase hit, or every content token of the head appears in features.
    if (corpus.includes(head)) continue;
    const tokens = head.split(/\s+/).filter((t) => t.length > 1);
    const hit = tokens.length > 0 && tokens.every((t) => corpus.includes(t));
    if (!hit) unmatched.push(line);
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

  const checklist = items.map((i) => `- [${i.pass ? 'x' : ' '}] ${i.label}`).join('\n');
  const markdownOut = [
    '## 14. PRD Self-Check',
    '',
    'Completeness graded from this document at generation time (not a hardcoded score).',
    '',
    checklist,
    '',
    `**Grade: ${passed}/${total} checks passed (${percent}%)**`
  ].join('\n');

  return { items, passed, total, percent, markdown: markdownOut };
}
