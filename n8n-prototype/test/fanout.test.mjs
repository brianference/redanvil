/**
 * The generated workflow follows process-map dependsOn, not map order.
 *
 * FAIL INPUT: the serial generator (every step's approve output wired to the
 * next step in orderedSteps) does not contain `Join: logo+palette` and wires
 * `If: logo approved` to `palette params`. Run this file against a temp copy
 * of that generator to see the assertion fail.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const PROTO = join(HERE, '..');
const BUILD = process.env.REDANVIL_GENERATOR || join(PROTO, 'build-workflow.mjs');
const WORKFLOW = join(PROTO, 'workflows', 'redanvil-full-build.json');
const NODE = process.execPath;

/**
 * @param {Record<string, string | undefined>} [flags]
 */
function generate(flags = {}) {
  const env = { ...process.env };
  delete env.REDANVIL_AUTO_GATES;
  delete env.REDANVIL_TELEGRAM;
  for (const [key, value] of Object.entries(flags)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return spawnSync(NODE, [BUILD], { encoding: 'utf8', env, cwd: ROOT });
}

/**
 * @param {object} workflow
 * @param {string} name
 * @param {number} [outputIndex]
 * @returns {{node: string, index: number}[]}
 */
function edges(workflow, name, outputIndex = 0) {
  const main = workflow.connections[name]?.main ?? [];
  return (main[outputIndex] ?? []).map((edge) => ({ node: edge.node, index: edge.index }));
}

describe('dependsOn fan-out', () => {
  test('product fans the design roles out together, and decide waits for all three', () => {
    const before = readFileSync(WORKFLOW);
    try {
      const run = generate();
      assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
      const workflow = JSON.parse(readFileSync(WORKFLOW, 'utf8'));
      assert.equal(workflow.settings.executionOrder, 'v1');

      const productOut = edges(workflow, 'Role: product').map((edge) => edge.node);
      assert.ok(productOut.includes('Prepare design roles after product'));
      assert.ok(productOut.includes('inspo params'));
      assert.ok(productOut.includes('reuse params'));
      assert.equal(productOut.includes('logo params'), false);
      assert.equal(productOut.includes('palette params'), false);
      assert.equal(productOut.includes('brainstorm params'), false);

      const prep = workflow.nodes.find((node) => node.name === 'Prepare design roles after product');
      assert.equal(prep.type, 'n8n-nodes-base.code');
      assert.match(prep.parameters.jsCode, /parallel-roles\.mjs/);
      assert.match(prep.parameters.jsCode, /--roles=brainstorm,logo,palette(?![,a-z])/);
      assert.deepEqual(edges(workflow, 'Prepare design roles after product'), [
        { node: 'Run design roles after product', index: 0 }
      ]);
      const runOut = edges(workflow, 'Run design roles after product').map((edge) => edge.node).sort();
      // Layout reads brainstorm's docs/FEATURES.md, so it starts after the batch
      // (which includes brainstorm) rather than inside it.
      assert.deepEqual(runOut, ['Prepare gate: logo', 'Prepare gate: palette', 'layout params']);

      assert.deepEqual(edges(workflow, 'If: logo approved', 0), [
        { node: 'Join: logo+palette', index: 0 }
      ]);
      assert.deepEqual(edges(workflow, 'If: palette approved', 0), [
        { node: 'Join: logo+palette', index: 1 }
      ]);
      assert.deepEqual(edges(workflow, 'Role: auto-logo'), [{ node: 'Join: logo+palette', index: 0 }]);
      assert.deepEqual(edges(workflow, 'If: layout approved', 0), [
        { node: 'Rework check: layout', index: 0 }
      ]);
      assert.deepEqual(edges(workflow, 'If: layout returns to decide', 0), [
        { node: 'decide params', index: 0 }
      ]);
      assert.deepEqual(edges(workflow, 'If: layout returns to decide', 1), [
        { node: 'Join: logo+palette+layout', index: 1 }
      ]);
      assert.deepEqual(edges(workflow, 'Join: logo+palette'), [
        { node: 'Join: logo+palette+layout', index: 0 }
      ]);
      assert.deepEqual(edges(workflow, 'Join: logo+palette+layout'), [
        { node: 'decide params', index: 0 }
      ]);

      for (const name of ['Join: logo+palette', 'Join: logo+palette+layout', 'Join: integration+testwriter']) {
        const join = workflow.nodes.find((node) => node.name === name);
        assert.equal(join.type, 'n8n-nodes-base.merge');
        assert.equal(join.typeVersion, 3.2);
        assert.equal(join.parameters.mode, 'chooseBranch');
        assert.equal(join.parameters.chooseBranchMode, 'waitForAll');
        assert.equal(join.parameters.numberInputs, 2);
        assert.equal(join.parameters.output, 'empty');
      }

      assert.deepEqual(edges(workflow, 'If: decide approved', 0), [
        { node: 'testwriter params', index: 0 }
      ]);
      assert.deepEqual(edges(workflow, 'If: decide cycles exceeded', 1), [
        { node: 'layout params', index: 0 }
      ]);
      assert.deepEqual(edges(workflow, 'If: logo cycles exceeded', 1), [
        { node: 'logo params', index: 0 }
      ]);
      assert.deepEqual(edges(workflow, 'logo params'), [{ node: 'Role: logo', index: 0 }]);
      assert.deepEqual(edges(workflow, 'Role: logo'), [{ node: 'Prepare gate: logo', index: 0 }]);

      assert.deepEqual(edges(workflow, 'Role: build').map((edge) => edge.node).sort(), [
        'content params',
        'visual params'
      ]);
      assert.deepEqual(edges(workflow, 'Role: integration'), [
        { node: 'Join: integration+testwriter', index: 0 }
      ]);
      assert.deepEqual(edges(workflow, 'Role: testwriter'), [
        { node: 'Join: integration+testwriter', index: 1 }
      ]);
    } finally {
      writeFileSync(WORKFLOW, before);
    }
  });
});
