/**
 * Role registry for the autonomous app team.
 *
 * Each role owns a failure mode and must produce named artifacts on disk.
 * A role that returns without its artifact counts as not run -- summaries are
 * never accepted in place of a file (docs/SPEC-agent-team.md §1).
 */

/** Stable role identifiers used in assignment files and hooks. */
export type RoleId =
  | 'pm'
  | 'product'
  | 'brainstorm'
  | 'logo'
  | 'layout'
  | 'content'
  | 'engineer'
  | 'testwriter'
  | 'qa-visual'
  | 'qa-runtime'
  | 'qa-data'
  | 'debugger'
  | 'user-refuse';

/**
 * One role in the team registry.
 */
export interface Role {
  /** Stable id. */
  id: RoleId;
  /**
   * Rubric rule ids and checklist row ids this role owns.
   * Used by `assignUnmetRows` via CHECKLIST_RULE_MAP.
   */
  owns: readonly string[];
  /**
   * Repo-relative paths the role must produce. Paths may include `<slug>`
   * which callers expand with the app slug.
   */
  artifacts: readonly string[];
  /** Whether a writing worktree is required (read-only roles get none). */
  needsWorktree: boolean;
  /** Single-job prompt seed for the agent that plays this role. */
  prompt: string;
}

/**
 * Expand `<slug>` placeholders in artifact path templates.
 *
 * @param paths - Artifact path templates from the registry.
 * @param slug - App slug (e.g. `az-planting-calendar`).
 * @returns Concrete paths.
 */
export function expandArtifacts(paths: readonly string[], slug: string): string[] {
  return paths.map((p) => p.replaceAll('<slug>', slug));
}

/**
 * Look up a role by id.
 *
 * @param id - Role id.
 * @returns The role, or undefined when unknown.
 */
export function getRole(id: RoleId): Role | undefined {
  return ROLES.find((r) => r.id === id);
}

/**
 * The full team. Order is documentation order from the SPEC; execution order
 * is decided by the PM (user-refuse always last).
 */
export const ROLES: readonly Role[] = Object.freeze([
  {
    id: 'pm',
    owns: [
      'isDone',
      'F1',
      'F2',
      'F3',
      'F4',
      'F5',
      'E1',
      'E2',
      'E3',
      'E4',
      'E5',
      'lg-shipped',
      'lg-result-reproduces'
    ],
    artifacts: ['results/<slug>.json'],
    needsWorktree: false,
    prompt:
      'You are the PM orchestrator. Own the worktree, the loop, and the finish line. ' +
      'Assign every unmet checklist row to its owning role. Promote only green worktrees. ' +
      'Never declare done from an agent summary -- only from measurement artifacts. ' +
      'Never lower a bar to converge. Never stage while a delegated run is in flight. ' +
      'Order: product before design, design before build. A missing results file means ' +
      'every checklist row is unmet -- plan from that, never invent scores.'
  },
  {
    id: 'product',
    owns: ['fe-product-completeness', 'u-claims-covered'],
    artifacts: ['docs/<slug>-product-brief.md', 'docs/<slug>-prd.md'],
    needsWorktree: false,
    prompt:
      'You are the product owner, not the orchestrator. Bring the PRD in as ' +
      'docs/<slug>-prd.md and keep it authoritative. Produce docs/<slug>-product-brief.md ' +
      'that records, from the PRD: (1) what the product promises, (2) the core user job ' +
      'end to end, (3) acceptance evidence for each promise. Every promise must map to a ' +
      'checklist/rubric row someone owns -- a promise with no owning row is a hard error. ' +
      'Own fe-product-completeness and u-claims-covered. Run before design and build.'
  },
  {
    id: 'brainstorm',
    owns: ['feature-gaps'],
    artifacts: ['docs/<slug>-features.md'],
    needsWorktree: false,
    prompt:
      'Before build, produce a ranked feature list with an impact estimate and a ' +
      'data-source note per item. Catch what the PRD forgot. A feature with no ' +
      'sourceable data is listed as blocked rather than built. Output is reviewed, not auto-accepted.'
  },
  {
    id: 'logo',
    owns: ['fe-brand-mark', 'fe-brand-mark-size', 'fe-favicon-legible', 'D6', 'D7', 'D10'],
    artifacts: [
      'design-refs/logo/gallery.html',
      'design-refs/logo/DECISION.md',
      'design-refs/logo/mark-01.png',
      'design-refs/logo/mark-02.png',
      'design-refs/logo/mark-03.png'
    ],
    needsWorktree: true,
    prompt:
      'Produce three distinct brand marks via Grok Imagine, rendered at 16, 32, 96 and 256px ' +
      'on light and dark in a gallery. Report what is legible at each size. Own fe-brand-mark ' +
      'and fe-brand-mark-size. Write DECISION.md naming the chosen mark and why.'
  },
  {
    id: 'layout',
    owns: ['proc-design-options', 'C9'],
    artifacts: [
      'design-refs/design-options/gallery.html',
      'design-refs/design-options/DECISION.md'
    ],
    needsWorktree: true,
    prompt:
      'Produce three structurally distinct options each for home, header/search, footer and ' +
      'one inner page. Gallery at dark and light, 375 and 1280. DECISION.md must state ' +
      'structural difference and the choice. Own proc-design-options.'
  },
  {
    id: 'content',
    owns: [
      'fe-legal-substance',
      'u-no-placeholders',
      'u-legal-claims-true',
      'D1',
      'D2',
      'D3',
      'D4',
      'D8',
      'fe-required-pages'
    ],
    artifacts: [
      'src/pages/Terms.tsx',
      'src/pages/Privacy.tsx',
      'src/pages/About.tsx',
      'src/pages/Contact.tsx'
    ],
    needsWorktree: true,
    prompt:
      'Write Terms, Privacy, About, Contact to the 1400-word / 14-section floor with required ' +
      'topic coverage, plus every empty state and boundary explanation. Own fe-legal-substance ' +
      'and u-no-placeholders. Every claim must be true of THIS app, verified against code.'
  },
  {
    id: 'engineer',
    owns: [
      'A1',
      'A2',
      'A5',
      'A6',
      'B1',
      'B2',
      'B3',
      'B4',
      'B5',
      'D9',
      'u-typing-strict',
      'u-typing-no-any',
      'u-conc-dead-code',
      'u-build-succeeds',
      'u-test-coverage-ratchet',
      'u-api-not-found',
      'u-api-no-spa-mask',
      'u-data-no-placeholder',
      'fe-search-present',
      'fe-structured-data',
      'fe-light-dark',
      'fe-theme-tokens-only',
      'u-plat-worker-runtime',
      'u-plat-runtime-parity',
      'u-plat-migrations',
      'fe-seo-assets',
      'fe-icon-button-labels',
      'fe-breadcrumbs',
      'C3',
      'C4',
      'C5',
      'C7',
      'C8'
    ],
    artifacts: ['src/index.ts'],
    needsWorktree: true,
    prompt:
      'Full-stack engineer: schema, API, UI. Delegate implementation to Grok Build. ' +
      'Own the functional rules. Do not mark your own work done -- the measurement decides.'
  },
  {
    id: 'testwriter',
    owns: [
      'u-test-acceptance',
      'u-test-presence',
      'u-test-feature-audit',
      'u-test-runners',
      'A3',
      'A4'
    ],
    artifacts: ['tests/acceptance.spec.ts', 'tests/features.manifest.json'],
    needsWorktree: true,
    prompt:
      'Write acceptance tests from the PRD acceptance criteria BEFORE the engineer builds, ' +
      'so tests encode the requirement rather than the implementation. Own u-test-acceptance ' +
      'and the test-runner lanes. Product owns u-claims-covered (promise map); you name each ' +
      'capability in a real acceptance test.'
  },
  {
    id: 'qa-visual',
    owns: [
      'fe-result-in-viewport',
      'fe-responsive-375',
      'fe-visual-review-recorded',
      'fe-desktop-width',
      'fe-premium-nav',
      'fe-cold-visitor',
      'C1',
      'C2',
      'C6',
      'C10',
      'qaVisualOk'
    ],
    artifacts: ['evidence/qa-visual-<slug>.json'],
    needsWorktree: true,
    prompt:
      'Open every screenshot at 375/768/1280 in both themes and report what a person would ' +
      'notice first. Capture, then describe the image -- not an assertion over the DOM. ' +
      'Measure primary-result y, header vs hero, brand-mark height, truncated elements, ' +
      'primary action above the fold. Answer: what would a first-time visitor try first; ' +
      'is anything important off-screen; does this look finished. Write evidence/qa-visual-<slug>.json. ' +
      'A fail blocks isDone even at 100/100.'
  },
  {
    id: 'qa-runtime',
    owns: ['lg-bindings-bound', 'u-api-real-output', 'E6', 'B1'],
    artifacts: ['evidence/qa-runtime-<slug>.json'],
    needsWorktree: true,
    prompt:
      'Probe the DEPLOYED app -- every route, every binding, real data counts. ' +
      'Own lg-bindings-bound and u-api-real-output. Write evidence/qa-runtime-<slug>.json.'
  },
  {
    id: 'qa-data',
    owns: ['D5', 'D11', 'fe-resource-links', 'fe-prior-art', 'u-data-no-placeholder'],
    artifacts: ['evidence/qa-data-<slug>.json'],
    needsWorktree: true,
    prompt:
      'Prove the data is real and sourced, not shaped. Follow every citation and every ' +
      'external link. Own D5 and fe-resource-links. Write evidence/qa-data-<slug>.json.'
  },
  {
    id: 'debugger',
    owns: ['G1', 'G2', 'G3', 'G4', 'G5', 'meas-known-bad', 'meas-two-run', 'meas-recheck-flattering', 'meas-standard-tool', 'meas-engine-named'],
    artifacts: ['evidence/diagnosis-<slug>.json'],
    needsWorktree: true,
    prompt:
      'Take a failing measurement and find root cause before anyone proposes a fix. ' +
      'A flaky test is diagnosed, never retried. Write evidence/diagnosis-<slug>.json.'
  },
  {
    id: 'user-refuse',
    owns: ['userRefuseOk', 'product-as-stranger'],
    artifacts: ['evidence/refusal-<slug>.json'],
    needsWorktree: false,
    prompt:
      'You are a hard-to-please first-time user. You receive ONLY the deployed URL and the ' +
      "app's own description of itself -- not the PRD, not the checklist, not the diff. " +
      "Default answer is no. Try to accomplish the app's stated purpose end to end. " +
      'Name the first three things you would complain about. Answer: is any primary ' +
      "control's result off-screen; is anything advertised that does not work; does any " +
      'state look like a bug; would a reasonable person call this finished. ' +
      "Return { verdict: 'accept' | 'refuse', complaints: [...] }. A refusal blocks isDone " +
      'at any score. Seed standard: "the search doesn\'t appear to work", "the logo is way ' +
      'too small", "I can\'t type Sierra Vista", "there\'s no autocomplete".'
  }
] as const satisfies readonly Role[]);
