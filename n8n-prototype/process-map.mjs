/**
 * The RedAnvil process map as data, with a fail-closed artifact contract per step.
 *
 * This file is the single source of truth. The n8n workflow is GENERATED from it
 * (build-workflow.mjs) rather than written alongside it, because a hand-authored
 * workflow can silently omit a step -- which is exactly how the logo role was
 * skipped for pet-sitter while the gate still reported 100/100.
 *
 * Two ideas do the work:
 *
 * 1. `requires` gives a step's artifact contract. A step is not done because it
 *    ran; it is done when the named artifacts exist, carry substance, and satisfy
 *    their assertions. Unrecorded means FAILED, never "probably fine".
 *
 * 2. `dependsOn` orders the map. A build step cannot start until the design steps
 *    it depends on are DONE by that contract. A gate cannot ask for what was never
 *    started, so ordering is enforced at the start of the process, not scored at
 *    the end of it.
 */

/**
 * @typedef {object} ArtifactContract
 * @property {string} path file or directory, relative to the app directory
 * @property {'file'|'dir'} kind what is expected at that path
 * @property {number} [minBytes] substance floor for a file
 * @property {number} [minCount] minimum matching entries for a directory
 * @property {string} [glob] extension filter for a directory count, e.g. '.png'
 * @property {string[]} [mustContain] substrings that must appear in a text file
 * @property {string[]} [mustNotContain] substrings that disqualify it (placeholders)
 * @property {string} why the failure this contract exists to prevent
 */

/**
 * @typedef {object} ProcessStep
 * @property {string} id
 * @property {string} role
 * @property {string} summary
 * @property {string[]} dependsOn
 * @property {boolean} humanGate whether a person must decide before the next step
 * @property {boolean} skippable always false today; present so a skip is explicit
 * @property {ArtifactContract[]} requires
 */

/**
 * Markers whose presence means a document still holds unfilled content.
 *
 * Matched as whole words, and deliberately NOT including the bare word
 * "placeholder": the product brief contains the line "Real brand mark, not emoji
 * or letter placeholders", which is a document PROHIBITING placeholders. A naive
 * substring check failed it and blocked the entire process map behind a false
 * failure. A check that fires on a document for forbidding the thing it looks
 * for is worse than no check.
 */
export const PLACEHOLDER_MARKERS = ['TBD', 'TODO', 'Lorem ipsum', 'Sample profile used by'];

/** @type {ProcessStep[]} */
export const PROCESS = [
  {
    id: 'product',
    role: 'product',
    summary: 'Product brief: who it is for, the job, the one flow that must work',
    dependsOn: [],
    humanGate: false,
    skippable: false,
    requires: [
      {
        // Path read from the repo, not invented. The first draft of this file
        // guessed `docs/product/BRIEF.md`, which never existed, and the checker
        // blocked the whole map on a false failure -- the same class of mistake
        // as referencing a CSS class nobody defined.
        path: 'docs/pet-sitter-product-brief.md',
        kind: 'file',
        minBytes: 1200,
        mustNotContain: PLACEHOLDER_MARKERS,
        why: 'a build with no product brief optimises the rubric instead of the user'
      }
    ]
  },
  {
    id: 'logo',
    role: 'logo',
    summary: 'Five real generated brand marks, a gallery, and an OPEN decision',
    dependsOn: ['product'],
    humanGate: true,
    skippable: false,
    requires: [
      {
        path: 'design-refs/logos',
        kind: 'dir',
        glob: '.png',
        minCount: 5,
        why: 'pet-sitter shipped a single copied mark because this step never ran; the gate cannot ask for what was never started'
      },
      {
        path: 'design-refs/logos/gallery.html',
        kind: 'file',
        minBytes: 800,
        why: 'without a gallery the owner cannot pick, so the step produces no decision'
      },
      {
        path: 'design-refs/logos/DECISION.md',
        kind: 'file',
        minBytes: 300,
        mustNotContain: PLACEHOLDER_MARKERS,
        why: 'a blank DECISION.md is MISSING -- a file that exists is not a decision'
      }
    ]
  },
  {
    id: 'layout',
    role: 'layout',
    summary: 'Three structurally distinct layout options, gallery, OPEN decision',
    dependsOn: ['product'],
    humanGate: true,
    skippable: false,
    requires: [
      {
        path: 'design-refs/design-options',
        kind: 'dir',
        glob: '.html',
        minCount: 4,
        why: 'three options plus a gallery; fewer means the exploration did not happen'
      },
      {
        path: 'design-refs/design-options/DECISION.md',
        kind: 'file',
        minBytes: 600,
        mustContain: ['Forbidden'],
        mustNotContain: PLACEHOLDER_MARKERS,
        why: 'R38 -- a decision that keeps several designs must name the flattened outcome as forbidden, or the build will faithfully homogenise them'
      }
    ]
  },
  {
    id: 'decide',
    role: 'user-picks',
    summary: 'The owner picks a logo and a layout direction. Nothing builds before this',
    dependsOn: ['logo', 'layout'],
    humanGate: true,
    skippable: false,
    requires: [
      {
        path: 'design-refs/design-options/DECISION.md',
        kind: 'file',
        minBytes: 600,
        mustContain: ['DECIDED'],
        why: 'the build must read a recorded choice, never infer one'
      },
      {
        path: 'design-refs/logos/DECISION.md',
        kind: 'file',
        minBytes: 300,
        mustContain: ['CHOSEN'],
        why: 'the chosen mark must be named in writing, or a later worktree ships whatever it finds'
      }
    ]
  },
  {
    id: 'build',
    role: 'engineer',
    summary: 'Implement the decided design',
    dependsOn: ['decide'],
    humanGate: false,
    skippable: false,
    requires: [
      {
        path: 'src',
        kind: 'dir',
        glob: '.tsx',
        minCount: 3,
        why: 'a build step that changed no source did not build'
      }
    ]
  },
  {
    id: 'visual',
    role: 'qa-visual',
    summary: 'Render every surface at 375/768/1280 in both themes and OPEN the images',
    dependsOn: ['build'],
    humanGate: false,
    skippable: false,
    requires: [
      {
        path: 'design-refs/design-options/renders',
        kind: 'dir',
        glob: '.png',
        minCount: 12,
        why: 'R36 -- the claimed matrix was 24 renders and 10 existed; count the artifacts against the claim'
      }
    ]
  },
  {
    id: 'ship',
    role: 'ship',
    summary: 'Deploy and prove the served asset hash matches the build',
    dependsOn: ['visual'],
    humanGate: false,
    skippable: false,
    requires: [
      {
        path: '.redanvil/claims.json',
        kind: 'file',
        minBytes: 80,
        mustContain: ['deployUrl'],
        why: 'a wrangler success message is not proof; a recorded deploy URL and a matching asset hash are'
      }
    ]
  }
];

/**
 * Steps in dependency order, failing loudly on an unknown or cyclic dependency.
 * @returns {ProcessStep[]} topologically sorted steps
 */
export function orderedSteps() {
  /** @type {ProcessStep[]} */
  const out = [];
  const byId = new Map(PROCESS.map((s) => [s.id, s]));
  /** @type {Set<string>} */
  const done = new Set();
  /** @type {Set<string>} */
  const visiting = new Set();

  /** @param {string} id */
  const visit = (id) => {
    if (done.has(id)) return;
    if (visiting.has(id)) throw new Error(`cyclic dependency at ${id}`);
    const step = byId.get(id);
    if (!step) throw new Error(`unknown dependency ${id}`);
    visiting.add(id);
    for (const dep of step.dependsOn) visit(dep);
    visiting.delete(id);
    done.add(id);
    out.push(step);
  };

  for (const s of PROCESS) visit(s.id);
  return out;
}
