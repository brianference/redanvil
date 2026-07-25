import type { PrdSelfCheckItem, PrdSelfCheckResult } from './types';
import { PRD_SECTION_HEADINGS, PRD_THRESHOLD } from './types';
import { entityTable } from './naming';

/**
 * Placeholder / incomplete markers that must not appear in a finished PRD body.
 * Excludes the self-check label text itself so grading is not self-defeating.
 */
/** Incomplete stub markers; word-boundary so normal prose is safe. */
const PLACEHOLDER_RE = /\b(TBD|TODO|FIXME|lorem ipsum)\b/i;

/**
 * Grade PRD markdown against verifiable completeness checks.
 * Score is always computed from the checks — never a hardcoded grade.
 *
 * @param markdown - Full PRD markdown (or a partial document under test).
 * @param opts - Optional generation context for entity/DDL checks.
 */
export function evaluatePrdSelfCheck(
  markdown: string,
  opts?: { entities?: string[]; hasDomainTables?: boolean }
): PrdSelfCheckResult {
  const entities = opts?.entities ?? [];
  const hasDomainTables = opts?.hasDomainTables ?? true;

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

  const items: PrdSelfCheckItem[] = [
    { id: 'frontmatter', label: 'Machine frontmatter present', pass: hasFrontmatter },
    { id: 'problem', label: 'Problem statement present', pass: problemText.length > 0 },
    { id: 'user-stories', label: 'At least one user story', pass: userStoryCount >= 1 },
    { id: 'mvp-features', label: 'At least one MVP feature marked', pass: mvpFeatureCount >= 1 },
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
