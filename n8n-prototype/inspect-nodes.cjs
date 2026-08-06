/**
 * Print the ground-truth node identity for every node the prototype workflow uses.
 *
 * The published docs omit typeVersion and the sub-workflow trigger's type string,
 * and they disagree with themselves on the Execute Command id
 * (`executecommand` in the node page, `executeCommand` in the block-nodes page).
 * Guessing either would put an invented config key into a workflow file, so the
 * installed package is the only source used here.
 */
const { join } = require('node:path');

const BASE = join(__dirname, 'node_modules', 'n8n-nodes-base', 'dist', 'nodes');

/** Node classes the prototype needs, as [label, path-within-nodes, exported class]. */
const TARGETS = [
  ['Execute Command', 'ExecuteCommand/ExecuteCommand.node.js', 'ExecuteCommand'],
  ['Execute Sub-workflow', 'ExecuteWorkflow/ExecuteWorkflow/ExecuteWorkflow.node.js', 'ExecuteWorkflow'],
  ['Sub-workflow Trigger', 'ExecuteWorkflow/ExecuteWorkflowTrigger/ExecuteWorkflowTrigger.node.js', 'ExecuteWorkflowTrigger'],
  ['If', 'If/If.node.js', 'If'],
  ['Code', 'Code/Code.node.js', 'Code'],
  ['Manual Trigger', 'ManualTrigger/ManualTrigger.node.js', 'ManualTrigger'],
  ['Stop And Error', 'StopAndError/StopAndError.node.js', 'StopAndError'],
  ['Wait', 'Wait/Wait.node.js', 'Wait'],
  ['No Operation', 'NoOp/NoOp.node.js', 'NoOp']
];

/**
 * Load one node class and report the fields a workflow JSON must get exactly right.
 * @param {string} label human-facing name
 * @param {string} rel path under dist/nodes
 * @param {string} cls exported class name
 */
function describe(label, rel, cls) {
  let mod;
  try {
    mod = require(join(BASE, rel));
  } catch (err) {
    console.log(`${label}\n  NOT RESOLVED: ${err.message.split('\n')[0]}\n`);
    return;
  }
  const Ctor = mod[cls];
  if (typeof Ctor !== 'function') {
    console.log(`${label}\n  NO EXPORT '${cls}' (has: ${Object.keys(mod).join(', ')})\n`);
    return;
  }
  const d = new Ctor().description;
  const props = (d.properties ?? [])
    .map((p) => `${p.name}${p.required ? '*' : ''}:${p.type}`)
    .join(', ');
  console.log(
    `${label}\n  type: ${d.name}\n  defaultVersion: ${JSON.stringify(d.defaultVersion ?? d.version)}\n  props: ${props || '(none)'}\n`
  );
}

for (const [label, rel, cls] of TARGETS) describe(label, rel, cls);
