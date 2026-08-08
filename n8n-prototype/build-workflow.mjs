#!/usr/bin/env node
/**
 * Generate the n8n workflow FROM process-map.mjs.
 *
 * This file was claimed in process-map.mjs's header ("The n8n workflow is
 * GENERATED from it (build-workflow.mjs)") and then never written. The claim sat
 * in a comment while the workflow was hand-authored, and the two drifted exactly
 * as predicted: the map grew to 16 steps while the workflow kept 4 role nodes,
 * silently missing prd, reuse, palette, decide, testwriter, content, runners,
 * visual, qa-runtime, judge, reverify and ship.
 *
 * That is the spec-is-not-a-deliverable failure inside the file whose entire
 * purpose is to prevent skipped steps. Generating removes the drift by
 * construction: a step added to the map appears in the workflow or this script
 * fails.
 *
 * Node identities were read out of the installed n8n package, never from the
 * docs, which omit typeVersion and disagree with themselves on the Execute
 * Command id (`executecommand` in the node page, `executeCommand` in reality).
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { orderedSteps } from './process-map.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Horizontal spacing between generated nodes on the n8n canvas. */
const X_STEP = 220;

/**
 * Build the parameter-shaping Code node for one step.
 * @param {import('./process-map.mjs').ProcessStep} step the step
 * @param {number} index position in the ordered map
 * @returns {object} an n8n Code node
 */
function paramsNode(step, index) {
  // Each role owns a DISTINCT artifact directory. Point two roles at the same
  // path and each takes credit for the other's work, so the contract's first
  // required path is the role's own territory.
  const artifacts = step.requires[0]?.path ?? '.';
  const envKey = `REDANVIL_CMD_${step.id.replace(/-/g, '_').toUpperCase()}`;
  return {
    id: `p_${step.id}`,
    name: `${step.id} params`,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [X_STEP * (index * 2 + 2), 0],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        `const c = $('Slice config').first().json;\n` +
        `return [{ json: { ...c, role: ${JSON.stringify(step.role)}, step: ${JSON.stringify(step.id)},\n` +
        `  artifacts: \`\${c.slug}/${artifacts}\`,\n` +
        `  cmd: $env.${envKey} || 'echo no runner configured for ${step.id} && exit 1' } }];`
    }
  };
}

/**
 * Build the sub-workflow call for one step.
 * @param {import('./process-map.mjs').ProcessStep} step the step
 * @param {number} index position in the ordered map
 * @returns {object} an n8n Execute Sub-workflow node
 */
function roleNode(step, index) {
  return {
    id: `r_${step.id}`,
    name: `Role: ${step.id}`,
    // typeVersion 1 takes a plain-string workflowId; 1.1+ needs a
    // resourceLocator object, which is easy to get subtly wrong by hand.
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1,
    position: [X_STEP * (index * 2 + 3), 0],
    parameters: { source: 'database', workflowId: 'redanvilRole001', mode: 'once', options: {} }
  };
}

/**
 * Build the blocking approval node for a human gate.
 * @param {import('./process-map.mjs').ProcessStep} step the step
 * @param {number} index position in the ordered map
 * @returns {object} an n8n Wait node configured as a form
 */
function approvalNode(step, index) {
  return {
    id: `h_${step.id}`,
    name: `Owner approves: ${step.id}`,
    type: 'n8n-nodes-base.wait',
    typeVersion: 1.1,
    position: [X_STEP * (index * 2 + 3), 160],
    parameters: {
      resume: 'form',
      formTitle: `Approve ${step.id}`,
      formDescription: step.summary,
      formFields: {
        values: [
          { fieldLabel: 'Decision', fieldType: 'dropdown', fieldOptions: { values: [{ option: 'approve' }, { option: 'redo' }] }, requiredField: true },
          { fieldLabel: 'Notes', fieldType: 'textarea', requiredField: false }
        ]
      },
      options: {}
    }
  };
}

const steps = orderedSteps();
/** @type {object[]} */
const nodes = [
  {
    id: 'start',
    name: 'Start a build',
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position: [0, 0],
    parameters: {}
  },
  {
    id: 'cfg',
    name: 'Slice config',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [X_STEP, 0],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const repoRoot = $env.REDANVIL_REPO || 'C:/Users/brian/RedAnvil';\n" +
        "const runner = $env.REDANVIL_RUNNER || 'C:/Users/brian/RedAnvil/n8n-prototype/role-run.mjs';\n" +
        "const slug = $env.REDANVIL_SLUG || 'pet-sitter';\n" +
        'return [{ json: { repoRoot, runner, slug } }];'
    }
  }
];

/** @type {Record<string, {main: object[][]}>} */
const connections = { 'Start a build': { main: [[{ node: 'Slice config', type: 'main', index: 0 }]] } };
let previous = 'Slice config';

steps.forEach((step, i) => {
  const params = paramsNode(step, i);
  const role = roleNode(step, i);
  nodes.push(params, role);
  connections[previous] = { main: [[{ node: params.name, type: 'main', index: 0 }]] };
  connections[params.name] = { main: [[{ node: role.name, type: 'main', index: 0 }]] };
  previous = role.name;

  if (step.humanGate) {
    const approve = approvalNode(step, i);
    nodes.push(approve);
    connections[previous] = { main: [[{ node: approve.name, type: 'main', index: 0 }]] };
    previous = approve.name;
  }
});
connections[previous] = { main: [[]] };

const workflow = {
  id: 'redanvilFull001',
  name: `RedAnvil full build (${steps.length} steps, generated)`,
  active: false,
  settings: { executionOrder: 'v1', saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all' },
  nodes,
  connections
};

const out = join(HERE, 'workflows', 'redanvil-full-build.json');
writeFileSync(out, JSON.stringify(workflow, null, 2) + '\n');

const gates = steps.filter((s) => s.humanGate).map((s) => s.id);
console.log(`generated ${out}`);
console.log(`  ${steps.length} steps -> ${nodes.length} nodes`);
console.log(`  human gates: ${gates.join(', ')}`);
console.log(`  order: ${steps.map((s) => s.id).join(' -> ')}`);
