/**
 * The command bound to each role, in ONE place.
 *
 * Both the n8n workflow generator and the CLI walker read this. They previously
 * held separate copies, which is how the generated workflow ran
 * "echo no runner configured" for roles the CLI could already run — the same
 * drift that let the workflow keep 4 nodes while the map grew to 16.
 *
 * `{slug}`, `{root}` and `{prompt}` are substituted at call time.
 *
 * A role absent from this map has NO runner. That is not a gap to be skipped
 * quietly: an unbound role is a step that never started, which is the failure
 * the whole process map exists to prevent, so it fails loudly instead.
 */

/** @type {Record<string,string>} */
export const BINDINGS = {
  prd: 'node n8n-prototype/roles/prd.mjs --slug={slug} --repoRoot={root} --prompt={prompt}',
  product: 'node n8n-prototype/roles/product.mjs --slug={slug} --repoRoot={root}',
  reuse: 'node n8n-prototype/roles/reuse.mjs --slug={slug} --repoRoot={root}'
};

/**
 * Substitute placeholders in a bound command.
 * @param {string} tpl the template
 * @param {{slug: string, root: string, prompt?: string}} ctx substitution values
 * @returns {string} the concrete command
 */
export function fillBinding(tpl, ctx) {
  return tpl
    .replaceAll('{slug}', ctx.slug)
    .replaceAll('{root}', JSON.stringify(ctx.root))
    .replaceAll('{prompt}', JSON.stringify(ctx.prompt ?? ''));
}

/**
 * Roles with no runner yet, in map order. Reported rather than hidden so the
 * distance to a complete build is always visible.
 * @param {string[]} stepIds every step id in the map
 * @returns {string[]} the unbound ones
 */
export function unboundRoles(stepIds) {
  return stepIds.filter((id) => !BINDINGS[id]);
}
