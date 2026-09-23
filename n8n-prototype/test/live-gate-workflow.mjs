#!/usr/bin/env node
/**
 * One-gate workflow for the live n8n proof.
 *
 * The Register, Wait, If, timeout, and cycle nodes come from the same
 * builders as the production workflow. Approve writes marker A, redo writes
 * marker R (it does not loop into a role), and a timeout runs
 * resolve-timeout.mjs and then writes marker T. The wait is one minute
 * here. Production stays at two hours.
 *
 * A second webhook fails on purpose so the imported error workflow can
 * write an alert.
 */
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { orderedSteps } from '../process-map.mjs';
import { DEFAULT_MAX_CYCLES, ERROR_WORKFLOW_ID } from '../dispatch/constants.mjs';
import {
  approvalNode,
  commandNode,
  commandPrepNode,
  cycleCountJs,
  ifNode,
  linkInto,
  registerGateJs,
  resolveTimeoutJs,
  webhookTriggerNode
} from '../build-workflow.mjs';

/** Workflow id imported into the throwaway n8n. */
export const LIVE_GATE_WORKFLOW_ID = 'redanvilLiveGate001';

/** Webhook path that starts one gate execution. */
export const LIVE_GATE_WEBHOOK_PATH = 'redanvil-gate-live';

/** Webhook path that fails on purpose. */
export const LIVE_GATE_FAIL_PATH = 'redanvil-gate-live-fail';

/**
 * Wait used only by this proof. resumeUnit `minutes` is a Wait-node option
 * in n8n 2.22.6. The production default is two hours.
 */
export const LIVE_GATE_WAIT = { amount: 1, unit: 'minutes' };

/**
 * Code-node source that writes markers/<executionId>.txt containing one letter.
 * The letter is a constant, not form text, so it cannot carry the notes.
 * @param {string} letter A, R, or T
 * @returns {string}
 */
export function markerJs(letter) {
  if (letter !== 'A' && letter !== 'R' && letter !== 'T') {
    throw new Error(`marker letter must be A, R, or T (got ${JSON.stringify(letter)})`);
  }
  return (
    "const c = $('Slice config').first().json;\n" +
    "const id = String($execution.id ?? '');\n" +
    "if (!id) throw new Error('execution id is missing');\n" +
    "const root = String(c.repoRoot).replaceAll('\\\\', '/');\n" +
    "const file = root + '/markers/' + id + '.txt';\n" +
    "const writer = \"const fs=require('fs');const path=require('path');const file=process.argv[1];fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file, process.argv[2]);\";\n" +
    `const cmd = 'node -e ' + JSON.stringify(writer) + ' ' + JSON.stringify(file) + ' ' + JSON.stringify(${JSON.stringify(letter)});\n` +
    'return [{ json: { cmd } }];'
  );
}

/**
 * Slice-config equivalent. The gate builders read $('Slice config') for
 * slug and repoRoot. repoRoot is the environment only, same rule as the
 * production config: a webhook body must not choose which directory node runs.
 * @returns {object}
 */
function sliceConfigNode() {
  return {
    id: 'cfg',
    name: 'Slice config',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [220, 0],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        'const body = ($json && $json.body) ? $json.body : {};\n' +
        'const repoRoot = $env.REDANVIL_REPO;\n' +
        "if (!repoRoot) throw new Error('REDANVIL_REPO is not set');\n" +
        "const requestedSlug = typeof body.slug === 'string' ? body.slug : '';\n" +
        'if (requestedSlug && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(requestedSlug)) {\n' +
        "  throw new Error('slug must match /^[a-z0-9][a-z0-9-]{0,63}$/');\n" +
        '}\n' +
        "const slug = requestedSlug || 'gate-live';\n" +
        'return [{ json: { repoRoot, slug } }];'
    }
  };
}

/**
 * Prepare + Execute Command pair that writes one marker.
 * @param {string} letter A, R, or T
 * @param {number} x canvas x
 * @param {number} y canvas y
 * @returns {{ prep: object, run: object }}
 */
function markerNodes(letter, x, y) {
  const prep = commandPrepNode(`mprep_${letter}`, `Prepare marker ${letter}`, [x, y], markerJs(letter));
  const run = commandNode(`mrun_${letter}`, `Write marker ${letter}`, [x + 220, y]);
  return { prep, run };
}

/**
 * Build the live-proof workflow.
 * @returns {object} n8n workflow JSON
 */
export function buildLiveGateWorkflow() {
  const logo = orderedSteps().find((step) => step.id === 'logo');
  if (!logo) throw new Error('process map has no logo step');
  const maxCycles = logo.maxCycles ?? DEFAULT_MAX_CYCLES;

  const hook = webhookTriggerNode({
    id: 'hook',
    name: 'Start via webhook',
    webhookId: 'c0ffee00-b2e1-4a11-8c0d-111111111111',
    path: LIVE_GATE_WEBHOOK_PATH,
    position: [0, 0]
  });
  const failHook = webhookTriggerNode({
    id: 'fail-hook',
    name: 'Fail via webhook',
    webhookId: 'c0ffee00-b2e1-4a11-8c0d-222222222222',
    path: LIVE_GATE_FAIL_PATH,
    position: [0, 420]
  });
  const config = sliceConfigNode();
  const prep = commandPrepNode('gprep_logo', 'Prepare gate: logo', [440, 80], registerGateJs(logo));
  const register = commandNode('greg_logo', 'Register gate: logo', [660, 80]);
  const wait = approvalNode(logo, 0, LIVE_GATE_WAIT);
  const formIf = ifNode(
    'gif_logo',
    'If: logo form submitted',
    [880, 80],
    '={{ $json.formMode }}',
    'exists'
  );
  const decisionIf = ifNode(
    'gid_logo',
    'If: logo approved',
    [1100, 0],
    '={{ $json.Decision }}',
    'equals',
    'approve'
  );
  const cycle = commandPrepNode(
    'gcyc_logo',
    'Count cycles: logo',
    [1320, 160],
    cycleCountJs(logo, maxCycles)
  );
  const approve = markerNodes('A', 1320, 0);
  const redo = markerNodes('R', 1540, 160);
  const timeoutPrep = commandPrepNode(
    'gtprep_logo',
    'Prepare timeout: logo',
    [1100, 320],
    resolveTimeoutJs(logo)
  );
  const timeoutRun = commandNode('gtrun_logo', 'Resolve timeout: logo', [1320, 320]);
  const timeoutMarker = markerNodes('T', 1540, 320);
  const stop = {
    id: 'fail-stop',
    name: 'Stop: forced failure',
    type: 'n8n-nodes-base.stopAndError',
    typeVersion: 1,
    position: [280, 420],
    parameters: {
      errorType: 'errorMessage',
      errorMessage: 'live gate proof: forced failure'
    }
  };

  /** @type {Record<string, {main: object[][]}>} */
  const connections = {};
  linkInto(connections, hook.name, config.name);
  linkInto(connections, config.name, prep.name);
  linkInto(connections, prep.name, register.name);
  linkInto(connections, register.name, wait.name);
  linkInto(connections, wait.name, formIf.name);
  linkInto(connections, formIf.name, decisionIf.name, 0);
  linkInto(connections, formIf.name, timeoutPrep.name, 1);
  linkInto(connections, decisionIf.name, approve.prep.name, 0);
  linkInto(connections, approve.prep.name, approve.run.name);
  linkInto(connections, decisionIf.name, cycle.name, 1);
  linkInto(connections, cycle.name, redo.prep.name);
  linkInto(connections, redo.prep.name, redo.run.name);
  linkInto(connections, timeoutPrep.name, timeoutRun.name);
  linkInto(connections, timeoutRun.name, timeoutMarker.prep.name);
  linkInto(connections, timeoutMarker.prep.name, timeoutMarker.run.name);
  linkInto(connections, failHook.name, stop.name);

  return {
    id: LIVE_GATE_WORKFLOW_ID,
    name: 'RedAnvil live gate proof',
    active: false,
    settings: {
      executionOrder: 'v1',
      saveDataErrorExecution: 'all',
      saveDataSuccessExecution: 'all',
      errorWorkflow: ERROR_WORKFLOW_ID
    },
    nodes: [
      hook,
      failHook,
      config,
      prep,
      register,
      wait,
      formIf,
      decisionIf,
      cycle,
      approve.prep,
      approve.run,
      redo.prep,
      redo.run,
      timeoutPrep,
      timeoutRun,
      timeoutMarker.prep,
      timeoutMarker.run,
      stop
    ],
    connections
  };
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const json = JSON.stringify(buildLiveGateWorkflow(), null, 2) + '\n';
  const dest = process.argv[2];
  if (dest) writeFileSync(dest, json);
  else process.stdout.write(json);
}
