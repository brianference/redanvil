/** The effort estimate shape consumed by the PRD (structurally matches estimate()). */
export interface TokenEstimate {
  iterations: number;
  tokens: number;
  confidence: string;
}

export interface Prd {
  slug: string;
  title: string;
  /** Original user prompt used to generate this PRD. */
  prompt: string;
  /** Complete PRD as GitHub-flavored markdown, ready to paste into Claude. */
  markdown: string;
}

/** One graded self-check row rendered in §14. */
export interface PrdSelfCheckItem {
  id: string;
  label: string;
  pass: boolean;
}

/** Result of grading a PRD markdown document against completeness checks. */
export interface PrdSelfCheckResult {
  items: PrdSelfCheckItem[];
  passed: number;
  total: number;
  /** Integer percent 0–100 computed from passed/total (never hardcoded). */
  percent: number;
  /** Markdown block for section 14. */
  markdown: string;
}

/** Gate threshold embedded in every generated PRD. */
export const PRD_THRESHOLD = 90;

/** Required static pages every app must ship. */
export const REQUIRED_PAGES = ['Home', 'About', 'Terms', 'Privacy', 'Contact'] as const;

/** Standard section headings in order (after YAML frontmatter). */
export const PRD_SECTION_HEADINGS = [
  '1. Introduction',
  '2. Problem Statement',
  '3. Solution Overview',
  '4. Success Outcome',
  '5. Non-goals / Out of scope',
  '6. User Stories',
  '7. Technical Requirements',
  '8. Core Features (MVP first)',
  '9. Acceptance Criteria',
  '10. Test Plan',
  '11. Build Plan (vertical slices)',
  '12. Verification & Gates',
  '13. Coding Standard (must)',
  '14. PRD Self-Check'
] as const;

/**
 * Stable identity of a derived feature, assigned where the feature is constructed.
 * Positional ids (F1, F3, F8, …) are not identity — they move when capability
 * features are prepended.
 */
export type FeatureRole =
  | 'accounts'
  | 'public-access'
  | 'entity-browse'
  | 'entity-detail'
  | 'entity-manage'
  | 'search-filter'
  | 'assistant'
  | 'required-pages'
  | 'capability';

/** One feature used while assembling Core Features, Acceptance Criteria, and Test Plan. */
export interface FeatureSpec {
  id: string;
  /** What this feature is. Set at construction; never inferred from id or name. */
  role: FeatureRole;
  name: string;
  behavior: string;
  /** True when this feature is in the minimum set that solves the stated problem. */
  mvp: boolean;
  /** Testable acceptance bullets (GIVEN/WHEN/THEN form where natural). */
  acceptance: string[];
  /** Named unit / integration / e2e cases bound to acceptance. */
  tests: {
    unit: string[];
    integration: string[];
    e2e: string[];
  };
}

/** One vertical slice in the build plan. */
export interface SliceSpec {
  index: number;
  name: string;
  mvp: boolean;
  db: string;
  api: string;
  ui: string;
  tests: string;
  verify: string;
  dependsOn: string;
}
