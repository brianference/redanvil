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

/** Shorthand for a judgement role delegated to Grok Build. */
const grok = (role) => `node n8n-prototype/roles/grok-role.mjs --role=${role} --slug={slug} --repoRoot={root}`;

/** Shorthand for a deterministic local script. */
const script = (name) => `node n8n-prototype/roles/${name}.mjs --slug={slug} --repoRoot={root}`;

/** @type {Record<string,string>} */
export const BINDINGS = {
  // Deterministic scripts.
  prd: 'node n8n-prototype/roles/prd.mjs --slug={slug} --repoRoot={root} --prompt={prompt}',
  product: script('product'),
  reuse: script('reuse'),
  inspo: script('inspo'),
  visual: script('visual'),
  'qa-runtime': script('qa-runtime'),
  'qa-data': script('qa-data'),
  // Added after the owner asked why the app had no live location data and why
  // the UI never called its own endpoints. Both roles exist because a rule
  // without a step is not enforced.
  integration: script('integration'),
  'ui-live': script('ui-live'),
  runners: script('runners'),

  // Judgement roles, delegated to Grok Build until n8n's native agents are in
  // use. n8n 2.33.7 is available and supports them; we ran 2.22.6, so this is a
  // stopgap that keeps the process complete rather than leaving six holes in it.
  brainstorm: grok('brainstorm'),
  testwriter: grok('testwriter'),
  judge: grok('judge'),
  'user-refuse': grok('user-refuse'),
  pm: grok('pm'),
  debugger: grok('debugger'),

  // Design and build work, delegated to Grok because that is where it is
  // strongest -- logos and component/layout options -- with a compact spec
  // rather than 60KB of generated option HTML.
  logo: 'node n8n-prototype/roles/design-role.mjs --role=logo --slug={slug} --repoRoot={root}',
  palette: 'node n8n-prototype/roles/design-role.mjs --role=palette --slug={slug} --repoRoot={root}',
  layout: 'node n8n-prototype/roles/design-role.mjs --role=layout --slug={slug} --repoRoot={root}',
  build: 'node n8n-prototype/roles/design-role.mjs --role=build --slug={slug} --repoRoot={root}',
  content: 'node n8n-prototype/roles/design-role.mjs --role=content --slug={slug} --repoRoot={root}',

  // `decide` is a human gate. Its runner only records what the owner chose; it
  // cannot manufacture a decision, which is the whole point of the step.
  decide: script('decide'),

  // Ship and re-verify reuse the existing tooling rather than reimplementing it.
  reverify: 'node .github/scripts/reverify.mjs --app {slug}',
  ship: script('ship')
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
