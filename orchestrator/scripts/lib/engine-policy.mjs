/**
 * Which work may run on Grok. One definition for the n8n roles, the overnight
 * loop, the CI judge and the TypeScript orchestrator.
 *
 * Owner decision, 2026-09-24: Grok is used ONLY for Grok Imagine images
 * (logos, icons, OG art, illustrations), logo design, and component/UX design
 * options (palette, layout). Everything else -- coding, judging, diff review,
 * PRD intent, the overnight loop, and the brainstorm / testwriter / judge /
 * user-refuse / pm / debugger roles -- runs on Claude (`claude -p`, prompt on
 * stdin, `--output-format json`).
 *
 * There is no fallback from Claude to Grok. When Claude cannot run, the caller
 * fails closed (UNVERIFIED, or a non-zero exit). A design role may still hand
 * off from Grok to Claude when Grok itself cannot run, because Claude doing
 * design text is allowed; the reverse is not.
 *
 * FAIL INPUT: `engineForRole('judge')` returning 'grok', or
 * `mayUseGrok('build')` returning true. Both are asserted false/claude in
 * n8n-prototype/test/engine-policy.test.mjs and orchestrator/test/enginePolicy.test.ts.
 */

/** The engine for every role not listed in GROK_ALLOWED_ROLES. */
export const ENGINE_CLAUDE = 'claude';

/** The engine reserved for image and design-option work. */
export const ENGINE_GROK = 'grok';

/**
 * Roles allowed to run on Grok. Frozen so a caller cannot widen it at runtime.
 * `logo` needs Grok Imagine (`image_gen`); `palette` and `layout` are the
 * component/UX design-option roles.
 * @type {readonly string[]}
 */
export const GROK_ALLOWED_ROLES = Object.freeze(['logo', 'palette', 'layout']);

/**
 * Whether this role may be run on Grok at all.
 * Unknown, empty and non-string roles are never allowed.
 * @param {unknown} role role id
 * @returns {boolean}
 */
export function mayUseGrok(role) {
  return typeof role === 'string' && GROK_ALLOWED_ROLES.includes(role);
}

/**
 * The primary engine for a role: grok for the design allowlist, claude for
 * everything else, including a missing role.
 * @param {unknown} role role id
 * @returns {'grok'|'claude'}
 */
export function engineForRole(role) {
  return mayUseGrok(role) ? ENGINE_GROK : ENGINE_CLAUDE;
}
