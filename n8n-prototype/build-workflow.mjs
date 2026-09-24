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
import { fileURLToPath, pathToFileURL } from 'node:url';
import { countedArtifactPath, orderedSteps } from './process-map.mjs';
import { BINDINGS, unboundRoles } from './bindings.mjs';
import { BUILD_WORKFLOW_ID, DEFAULT_MAX_CYCLES, ERROR_WORKFLOW_ID } from './dispatch/constants.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The workflow files are written only when this file is the program.
 * Importing the builders (the live proof, a unit test) must not rewrite them.
 */
const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

/**
 * Production human-gate wait. A live proof passes a shorter limit and must
 * not change this default. resumeUnit values are the Wait node's options
 * (seconds, minutes, hours, days) from Wait.node.ts in n8n 2.22.6.
 */
export const DEFAULT_GATE_WAIT = { amount: 2, unit: 'hours' };

/** Horizontal spacing between generated nodes on the n8n canvas. */
const X_STEP = 220;

/**
 * Opt-in unattended resolution of the four human gates. Unset (the default)
 * must leave the generated JSON byte-identical to today's file.
 */
const AUTO_GATES =
  process.env.REDANVIL_AUTO_GATES === '1' || process.env.REDANVIL_AUTO_GATES === 'true';

/**
 * Telegram is off unless this is set at generation time. A missing bot
 * credential used to be a node on every gate; it is now opt-in.
 */
const TELEGRAM =
  process.env.REDANVIL_TELEGRAM === '1' || process.env.REDANVIL_TELEGRAM === 'true';

/**
 * Decision.md path per auto-resolved axis. Paths taken from decide.mjs AXES
 * and process-map.mjs -- not invented.
 * @type {Record<string, string>}
 */
const AUTO_AXIS_ARTIFACT = {
  logo: 'design-refs/logos/DECISION.md',
  palette: 'design-refs/palettes/DECISION.md',
  layout: 'design-refs/design-options/DECISION.md'
};

/**
 * Build the parameter-shaping Code node for one step.
 * @param {import('./process-map.mjs').ProcessStep} step the step
 * @param {number} index position in the ordered map
 * @param {string} [boundCmd] bound command override used by auto-gate runners
 * @returns {object} an n8n Code node
 */
function paramsNode(step, index, boundCmd) {
  // Each role owns a DISTINCT artifact. Point two roles at the same path and
  // each takes credit for the other's work. The counted path is the file this
  // step writes (`owned: true`), not an input it only verifies. Steps that
  // predate that flag still count requires[0], which is what this used to
  // hard-code -- and what credited decide for layout's DECISION.md.
  const artifacts = countedArtifactPath(step);
  const envKey = `REDANVIL_CMD_${step.id.replace(/-/g, '_').toUpperCase()}`;
  // The bound command is baked in from bindings.mjs. Previously the generator
  // emitted only an env-var lookup with an "echo no runner configured" fallback,
  // so the workflow refused roles the CLI walker could already run.
  const bound = boundCmd ?? BINDINGS[step.id] ?? '';
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
        `  cmd: $env.${envKey} || ${JSON.stringify(bound || `echo no runner bound for ${step.id} && exit 1`)}
` +
        // {promptB64} is BASE64 on purpose. The prompt has to cross two shells
        // -- n8n's Execute Command, then role-run's `shell: true` -- and each
        // one eats a level of quoting. A quoted sentence arrived as `--prompt=A`,
        // its own first letter, which left the builder's Send button disabled
        // and killed the run 30s later on a click timeout.
        //
        // Base64 contains no spaces, quotes or shell metacharacters, so it
        // survives any number of shell hops byte-for-byte. The receiving role
        // decodes it. This also removes the injection surface that free text in
        // a command string would otherwise carry.
        `    .replaceAll('{slug}', c.slug).replaceAll('{root}', JSON.stringify(c.repoRoot))` +
        `.replaceAll('{promptB64}', Buffer.from(String(c.prompt ?? ''), 'utf8').toString('base64'))` +
        `.replaceAll('{entitiesB64}', Buffer.from(String(c.entities ?? ''), 'utf8').toString('base64'))` +
        `.replaceAll('{prompt}', JSON.stringify(c.prompt ?? '')) } }];`
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
 * Telegram notification sent immediately BEFORE a gate blocks.
 *
 * Without this, a gate pausing at 02:00 is invisible until someone happens to
 * look at n8n, which for an overnight run means the build sits idle until
 * morning. The message carries the signed resume link, so approving is a tap.
 *
 * `$execution.resumeFormUrl` is the real thing, read out of n8n's source
 * (n8n-core get-additional-keys.js) rather than guessed: it is built from
 * formWaitingBaseUrl + executionId and ALREADY has the resume token appended.
 * That token is the authorization -- an unsigned /form-waiting/<id> returns 401
 * and a hand-built link is rejected as "invalid or expired", which is exactly
 * what happened when this was constructed by hand instead of read.
 *
 * NEITHER SECRET IS IN THIS FILE. The bot token lives in an n8n credential
 * (encrypted in n8n's own store) and the chat id comes from the environment, so
 * the generated workflow JSON stays safe to commit to a public repo.
 *
 * @param {import('./process-map.mjs').ProcessStep} step the step being gated
 * @param {number} index position in the ordered map
 * @returns {object} an n8n Telegram sendMessage node
 */
function notifyNode(step, index) {
  return {
    id: `n_${step.id}`,
    name: `Notify: ${step.id} needs approval`,
    type: 'n8n-nodes-base.telegram',
    typeVersion: 1.2,
    position: [X_STEP * (index * 2 + 3), 20],
    parameters: {
      chatId: '={{ $env.REDANVIL_TELEGRAM_CHAT_ID }}',
      text: AUTO_GATES
        ? `=RedAnvil auto-resolved *${step.id}* -- pending owner review\n\n` +
          `${step.summary}\n\n` +
          `App: {{ $('Slice config').first().json.slug }}\n` +
          `This is a provisional pick, not a preference.`
        : `=RedAnvil needs a decision: *${step.id}*\n\n` +
          `${step.summary}\n\n` +
          `App: {{ $('Slice config').first().json.slug }}\n` +
          `Approve or request a redo:\n{{ $execution.resumeFormUrl }}`,
      additionalFields: { appendAttribution: false, parse_mode: 'Markdown' }
    },
    credentials: { telegramApi: { id: 'redanvil-telegram', name: 'RedAnvil Telegram' } },
    // A failed notification must NEVER kill a build. If Telegram is down, or the
    // credential is missing, the gate should still block and wait -- losing the
    // message is an inconvenience, losing the run is hours of work.
    onError: 'continueRegularOutput'
  };
}

/**
 * Build the blocking approval node for a human gate.
 * @param {import('./process-map.mjs').ProcessStep} step the step
 * @param {number} index position in the ordered map
 * @param {{ amount?: number, unit?: string }} [waitLimit] defaults to two hours
 * @returns {object} an n8n Wait node configured as a form
 */
export function approvalNode(step, index, waitLimit = {}) {
  const resumeAmount = waitLimit.amount ?? DEFAULT_GATE_WAIT.amount;
  const resumeUnit = waitLimit.unit ?? DEFAULT_GATE_WAIT.unit;
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
          {
            fieldLabel: 'Decision',
            fieldType: 'dropdown',
            fieldOptions: { values: [{ option: 'approve' }, { option: 'redo' }] },
            requiredField: true
          },
          { fieldLabel: 'Notes', fieldType: 'textarea', requiredField: false }
        ]
      },
      // Wait.node.ts (n8n 2.22.6): limitWaitTime + limitType afterTimeInterval
      // + resumeAmount + resumeUnit. Two hours, then the execution resumes.
      //
      // Timeout and a submitted form share this node's single output, and they
      // are not the same item. putToWait() returns getInputData() and sets
      // waitTill. On resume, workflow-execute.ts handleWaitingState disables
      // the Wait node and pops that run; handleDisabledNode then passes the
      // input (the Register command's exitCode/stdout/stderr) straight through.
      // A form POST does not: formWebhook -> prepareFormReturnItem sets
      // formMode, submittedAt, and the field labels (Decision, Notes). The
      // If below treats a missing formMode as the limit expiring.
      limitWaitTime: true,
      limitType: 'afterTimeInterval',
      resumeAmount,
      resumeUnit,
      options: {}
    }
  };
}

/**
 * Code node that builds a shell command whose only free text is base64.
 * repoRoot is read from Slice config, which itself reads only the environment.
 * @param {string} id node id
 * @param {string} name node name
 * @param {number[]} position canvas position
 * @param {string} jsCode code that returns [{ json: { cmd } }]
 * @returns {object}
 */
export function commandPrepNode(id, name, position, jsCode) {
  return {
    id,
    name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position,
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode }
  };
}

/**
 * Execute Command that runs the command the previous Code node put on `cmd`.
 * @param {string} id node id
 * @param {string} name node name
 * @param {number[]} position canvas position
 * @returns {object}
 */
export function commandNode(id, name, position) {
  return {
    id,
    name,
    type: 'n8n-nodes-base.executeCommand',
    typeVersion: 1,
    position,
    parameters: { executeOnce: true, command: '={{ $json.cmd }}' }
  };
}

/**
 * n8n expression that shells out to a dispatch script. The payload is base64
 * so a summary or a resume URL cannot break out of the command.
 * @param {string} bodyJs statements that declare `payload`
 * @param {string} scriptFile file name under n8n-prototype/dispatch
 * @returns {string}
 */
export function dispatchCommandCode(bodyJs, scriptFile) {
  return (
    `${bodyJs}\n` +
    `const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');\n` +
    `const root = String(c.repoRoot);\n` +
    `const script = JSON.stringify(root.replaceAll('\\\\', '/') + '/n8n-prototype/dispatch/${scriptFile}');\n` +
    `const cmd = 'node ' + script + ' --payloadB64=' + b64 + ' --repoRoot=' + JSON.stringify(root);\n` +
    `return [{ json: { cmd } }];`
  );
}

/**
 * If node. operation is `exists` (string), `true` (boolean), or `equals`.
 * @param {string} id node id
 * @param {string} name node name
 * @param {number[]} position canvas position
 * @param {string} leftValue expression
 * @param {'exists'|'true'|'equals'} operation comparison
 * @param {string} [rightValue] right side for equals
 * @returns {object}
 */
export function ifNode(id, name, position, leftValue, operation, rightValue) {
  const operator =
    operation === 'exists'
      ? { type: 'string', operation: 'exists', singleValue: true }
      : operation === 'true'
        ? { type: 'boolean', operation: 'true', singleValue: true }
        : { type: 'string', operation: 'equals' };
  return {
    id,
    name,
    type: 'n8n-nodes-base.if',
    typeVersion: 2.3,
    position,
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        combinator: 'and',
        conditions: [
          {
            id: `${id}_c`,
            leftValue,
            rightValue: rightValue ?? '',
            operator
          }
        ]
      },
      options: {}
    }
  };
}

/**
 * Binary Merge that waits until both inputs have arrived.
 *
 * Read from the installed n8n 2.22.6 package, not from the docs:
 * `n8n-nodes-base/dist/nodes/Merge/Merge.node.js` defaultVersion is 3.2.
 * `actions/mode/chooseBranch.js` names `chooseBranchMode: 'waitForAll'`
 * "Wait for All Inputs to Arrive".
 * `actions/versionDescription.js` sets chooseBranch `requiredInputs` to
 * `[0, 1]`. A 3-input chooseBranch still only requires the first two when
 * the stack is empty (workflow-execute.js), so three or more dependencies
 * are a chain of these binary nodes. `output: 'empty'` yields one item;
 * downstream Code nodes read Slice config, not the merged json.
 *
 * @param {string} id node id
 * @param {string} name node name
 * @param {number[]} position canvas position
 * @returns {object}
 */
function joinNode(id, name, position) {
  return {
    id,
    name,
    type: 'n8n-nodes-base.merge',
    typeVersion: 3.2,
    position,
    parameters: {
      mode: 'chooseBranch',
      numberInputs: 2,
      chooseBranchMode: 'waitForAll',
      output: 'empty'
    }
  };
}

/**
 * Grok and design-role bindings are the slow steps. Local scripts are not.
 * @param {import('./process-map.mjs').ProcessStep} step
 * @returns {boolean}
 */
function isAgentStep(step) {
  const cmd = BINDINGS[step.id] ?? '';
  return cmd.includes('roles/grok-role.mjs') || cmd.includes('roles/design-role.mjs');
}

/**
 * Code-node source for the parallel design launch.
 * The role list is fixed at generation time. slug and repoRoot come from
 * Slice config, quoted the same way as the dispatch commands.
 * @param {string} roleList comma-separated step ids
 * @returns {string}
 */
function designFanoutJs(roleList) {
  return (
    `const c = $('Slice config').first().json;\n` +
    `const root = String(c.repoRoot);\n` +
    `const script = JSON.stringify(root.replaceAll('\\\\', '/') + '/n8n-prototype/roles/parallel-roles.mjs');\n` +
    `const cmd = 'node ' + script + ' --roles=${roleList} --slug=' + JSON.stringify(c.slug) + ' --repoRoot=' + JSON.stringify(root);\n` +
    `return [{ json: { cmd } }];`
  );
}

/**
 * Connect every completion tail to one target input.
 * @param {{from: string, outputIndex: number}[]} tails
 * @param {string} to target node name
 * @param {number} inputIndex merge input slot
 */
function wireTails(tails, to, inputIndex) {
  for (const edge of tails) link(edge.from, to, edge.outputIndex, inputIndex);
}

/**
 * Wire steps from `dependsOn` instead of from map order.
 *
 * Steps that share a dependency set fan out from one predecessor. A set of
 * two or more grok/design roles is launched by one Execute Command
 * (`parallel-roles.mjs`), because executionOrder v1 walks one branch to the
 * end before the next (n8n-core workflow-execute.js: the loop shifts a
 * single stack entry, and v1 unshifts children). Human gates stay on their
 * own branch after that command. A redo still enters the one step's params
 * node. When that step is someone else's `reworkTo`, a later pass skips the
 * join: the join already consumed the other branches, and waiting for them
 * again would stall the redo.
 */
function wireDag() {
  const indexOf = new Map(steps.map((step, index) => [step.id, index]));
  /**
   * @param {import('./process-map.mjs').ProcessStep} step
   * @returns {string[]}
   */
  const depIdsOf = (step) =>
    step.dependsOn.slice().sort((left, right) => indexOf.get(left) - indexOf.get(right));

  /** @type {Map<string, {from: string, outputIndex: number}[]>} */
  const effective = new Map(completion);

  if (!AUTO_GATES) {
    for (const step of steps) {
      const gates = steps.filter((gate) => gate.humanGate && gate.reworkTo === step.id);
      if (!gates.length) continue;
      let incoming = effective.get(step.id) ?? [];
      for (const gate of gates) {
        const checkName = `Rework check: ${step.id}${gates.length > 1 ? ` ${gate.id}` : ''}`;
        const ifName = `If: ${step.id} returns to ${gate.id}`;
        const cycleKey = `cycles_${gate.id.replace(/-/g, '_')}`;
        nodes.push(
          commandPrepNode(
            `rwc_${step.id}_${gate.id}`,
            checkName,
            [X_STEP * ((indexOf.get(step.id) ?? 0) + 2), 360],
            `const used = Number($execution.customData.get(${JSON.stringify(cycleKey)}) || '0');\n` +
              `return [{ json: { reworkGate: used > 0 ? ${JSON.stringify(gate.id)} : '' } }];`
          ),
          ifNode(
            `rwi_${step.id}_${gate.id}`,
            ifName,
            [X_STEP * ((indexOf.get(step.id) ?? 0) + 3), 360],
            '={{ $json.reworkGate }}',
            'equals',
            gate.id
          )
        );
        for (const edge of incoming) link(edge.from, checkName, edge.outputIndex);
        link(checkName, ifName);
        link(ifName, `${gate.id} params`, 0);
        incoming = [{ from: ifName, outputIndex: 1 }];
      }
      effective.set(step.id, incoming);
    }
  }

  /** @type {Map<string, import('./process-map.mjs').ProcessStep[]>} */
  const groups = new Map();
  for (const step of steps) {
    const key = depIdsOf(step).join('+');
    const list = groups.get(key) ?? [];
    list.push(step);
    groups.set(key, list);
  }

  /** @type {Map<string, {prepName: string, runName: string, agents: import('./process-map.mjs').ProcessStep[]}>} */
  const batches = new Map();
  for (const [key, group] of groups) {
    const agents = group.filter(isAgentStep);
    if (agents.length < 2) continue;
    const label = key || 'start';
    const slug = label.replace(/[^a-z0-9]+/gi, '_');
    const prepName = `Prepare design roles after ${label}`;
    const runName = `Run design roles after ${label}`;
    nodes.push(
      commandPrepNode(`pfan_${slug}`, prepName, [X_STEP * 4, 480], designFanoutJs(agents.map((step) => step.id).join(','))),
      commandNode(`rfan_${slug}`, runName, [X_STEP * 5, 480])
    );
    link(prepName, runName);
    for (const step of agents) {
      if (!afterRole.has(step.id)) {
        effective.set(step.id, [{ from: runName, outputIndex: 0 }]);
      }
    }
    batches.set(key, { prepName, runName, agents });
  }

  /**
   * @param {string[]} depIds process-order dependency ids
   * @returns {{from: string, outputIndex: number}[]}
   */
  const joinedTails = (depIds) => {
    if (depIds.length === 0) return [{ from: 'Slice config', outputIndex: 0 }];
    if (depIds.length === 1) return effective.get(depIds[0]) ?? [];
    /** @type {string[]} */
    let accIds = [];
    /** @type {{from: string, outputIndex: number}[]} */
    let accTails = [];
    for (let index = 0; index < depIds.length; index += 1) {
      const depId = depIds[index];
      if (index === 0) {
        accIds = [depId];
        accTails = effective.get(depId) ?? [];
        continue;
      }
      accIds = accIds.concat(depId);
      const name = `Join: ${accIds.join('+')}`;
      if (!nodes.some((node) => node.name === name)) {
        nodes.push(joinNode(`join_${accIds.join('_')}`, name, [X_STEP * (steps.length + index), index * 180]));
        wireTails(accTails, name, 0);
        wireTails(effective.get(depId) ?? [], name, 1);
      }
      accTails = [{ from: name, outputIndex: 0 }];
    }
    return accTails;
  };

  for (const [key, group] of groups) {
    const depIds = key ? key.split('+') : [];
    const source = joinedTails(depIds);
    const batch = batches.get(key);
    const batched = new Set(batch ? batch.agents.map((step) => step.id) : []);
    if (batch) wireTails(source, batch.prepName, 0);
    for (const step of group) {
      if (batched.has(step.id)) {
        const next = afterRole.get(step.id);
        if (next && batch) link(batch.runName, next);
        continue;
      }
      const entryName = entry.get(step.id);
      if (entryName) wireTails(source, entryName, 0);
    }
  }
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
  // The trigger that makes HUMAN GATES POSSIBLE.
  //
  // `n8n execute` cannot run a Wait node with `resume: form`. It throws
  // "context.getNodeParameter is not a function", because form resume needs
  // the server's webhook context and the CLI has none. A CLI-driven build can
  // therefore NEVER pause for an owner decision -- it dies at the first gate.
  //
  // Starting the run through the server instead puts the execution in the
  // process that owns the webhooks, so the Wait node suspends properly and n8n
  // serves a real form URL that resumes it.
  //
  // Identity read out of the installed package, not the docs:
  //   type n8n-nodes-base.webhook, versions [1, 1.1, 2, 2.1]
  // The docs have been wrong about node ids in this project before.
  //
  // A FIXED, VALID UUID. Fixed so the callback URL survives regeneration and
  // the overnight loop never has to rediscover it. Valid because n8n looks the
  // webhook up by this id when it builds the node's execution context -- the
  // first attempt used a readable-but-malformed id ending "-redanvilbuild",
  // and the request reached the node with `context` undefined:
  //   TypeError: Cannot read properties of undefined (reading 'getNode')
  // which reads like a bug in the node and is actually a bad id in our JSON.
  //
  // Respond immediately. The build runs for hours; holding the HTTP
  // connection open for it would time out long before the first gate.
  webhookTriggerNode({
      id: 'hook',
      name: 'Start via webhook',
      webhookId: 'daccb558-a999-48b4-9d11-9ac2067ac177',
      path: 'redanvil-build',
      position: [0, 220]
    }),
  {
    id: 'cfg',
    name: 'Slice config',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [X_STEP, 0],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      // `prompt` is REQUIRED and has no default. Every `<role> params` node
      // substitutes `{prompt}` from `c.prompt ?? ''`, so when the config node
      // omitted it the very first step ran
      //   prd.mjs --slug=... --prompt=""
      // and prd.mjs refuses an empty prompt at its `if (!slug || !prompt)`
      // guard. The full build therefore could not clear step 1, and the failure
      // read as a broken role rather than as config that was never passed
      // through -- the prompt is the ONE input the whole build derives from.
      //
      // It throws rather than defaulting: a placeholder prompt would forge a
      // PRD for an app nobody asked for, and every later role would faithfully
      // build it. Failing here is the cheap failure.
      // The WEBHOOK BODY WINS over the environment.
      //
      // Environment variables are per-process, so an env-only build meant every
      // run in one n8n process built the same slug from the same prompt, and
      // changing either meant restarting the server. A POST body makes each run
      // self-contained, which is what lets a queue drive many different builds
      // through one running instance.
      //
      // Env stays as the fallback so a manual editor run and the existing CLI
      // path keep working unchanged.
      // `repoRoot` and `runner` are ENV-ONLY and are deliberately NOT read from
      // the request body.
      //
      // Both resolve to executable paths that end up inside a command string run
      // with `shell: true`. Taking either from an unauthenticated POST is remote
      // code execution, not a configuration convenience -- an attacker sets
      // `runner` to anything on disk and n8n runs it. The first version of this
      // node did exactly that, and n8n binds on `::` (all interfaces), so it was
      // not even limited to this machine.
      //
      // `slug` IS accepted, because a queue needs to name what it is building,
      // but it is interpolated into that same command string and used as a path
      // component, so it is validated against a strict allowlist first rather
      // than escaped. `prompt` is the only free text, and it reaches the role
      // through REDANVIL_PROMPT in the environment rather than through argv, so
      // no amount of quoting in it can break out.
      jsCode:
        'const body = ($json && $json.body) ? $json.body : {};\n' +
        "const repoRoot = $env.REDANVIL_REPO || 'C:/Users/brian/RedAnvil';\n" +
        "const runner = $env.REDANVIL_RUNNER || 'C:/Users/brian/RedAnvil/n8n-prototype/role-run.mjs';\n" +
        "const requestedSlug = typeof body.slug === 'string' ? body.slug : '';\n" +
        'if (requestedSlug && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(requestedSlug)) {\n' +
        "  throw new Error('slug must match /^[a-z0-9][a-z0-9-]{0,63}$/ -- it becomes a path component and a shell argument');\n" +
        '}\n' +
        "const slug = requestedSlug || $env.REDANVIL_SLUG || 'pet-sitter';\n" +
        "const prompt = typeof body.prompt === 'string' && body.prompt.trim() ? body.prompt : $env.REDANVIL_PROMPT;\n" +
        'if (!prompt) {\n' +
        "  throw new Error('No prompt: POST a { prompt } body to the webhook, or set REDANVIL_PROMPT. The prd role drives the live app builder with it, and every later role builds what that PRD says, so there is no safe default.');\n" +
        '}\n' +
        // The domain entities the wizard's own entities field takes. Optional,
        // and empty is legal: the builder then falls back to deriving them from
        // the prompt, which is what it did before this existed.
        "const entities = typeof body.entities === 'string' ? body.entities : ($env.REDANVIL_ENTITIES || '');\n" +
        'return [{ json: { repoRoot, runner, slug, prompt, entities } }];'
    }
  }
];

/** @type {Record<string, {main: object[][]}>} */
// Both triggers feed the same config node: the manual one for driving a run from
// the editor, the webhook for anything programmatic (the overnight loop, a
// queued job from the site). The pipeline after this point is identical, so a
// run cannot behave differently depending on how it was started.
const connections = {
  'Start a build': { main: [[{ node: 'Slice config', type: 'main', index: 0 }]] },
  'Start via webhook': { main: [[{ node: 'Slice config', type: 'main', index: 0 }]] }
};
/**
 * Add one outgoing edge without dropping the node's other outputs.
 * An If has two outputs; assigning the whole connection object would wipe one.
 * @param {Record<string, {main: object[][]}>} connections workflow connections
 * @param {string} from source node name
 * @param {string} to target node name
 * @param {number} [outputIndex] which output. 0 for a single-output node
 * @param {number} [inputIndex] which input on the target. Merge uses this to wait
 */
export function linkInto(connections, from, to, outputIndex = 0, inputIndex = 0) {
  if (!connections[from]) connections[from] = { main: [] };
  const main = connections[from].main;
  while (main.length <= outputIndex) main.push([]);
  main[outputIndex].push({ node: to, type: 'main', index: inputIndex });
}

/**
 * @param {string} from source node name
 * @param {string} to target node name
 * @param {number} [outputIndex] which output. 0 for a single-output node
 * @param {number} [inputIndex] which input on the target
 */
function link(from, to, outputIndex = 0, inputIndex = 0) {
  linkInto(connections, from, to, outputIndex, inputIndex);
}

/**
 * Code-node source that registers one gate. Free text rides inside the
 * base64 payload, so the summary cannot break the shell command.
 * @param {{ id: string, summary: string }} step gated step
 * @returns {string}
 */
export function registerGateJs(step) {
  return dispatchCommandCode(
    `const c = $('Slice config').first().json;\n` +
      `const payload = {\n` +
      `  slug: c.slug,\n` +
      `  step: ${JSON.stringify(step.id)},\n` +
      `  title: ${JSON.stringify(`Approve ${step.id}`)},\n` +
      `  summary: ${JSON.stringify(step.summary)},\n` +
      `  resumeUrl: $execution.resumeFormUrl,\n` +
      `  executionId: String($execution.id ?? '')\n` +
      `};`,
    'register-gate.mjs'
  );
}

/**
 * Code-node source that records a timeout decision for one gate.
 * @param {{ id: string }} step gated step
 * @returns {string}
 */
export function resolveTimeoutJs(step) {
  return dispatchCommandCode(
    `const c = $('Slice config').first().json;\n` +
      `const payload = {\n` +
      `  slug: c.slug,\n` +
      `  step: ${JSON.stringify(step.id)},\n` +
      `  executionId: String($execution.id ?? '')\n` +
      `};`,
    'resolve-timeout.mjs'
  );
}

/**
 * Code-node source that increments this execution's redo counter.
 * customData keys may only contain [A-Za-z0-9_] (execution-metadata.ts).
 * @param {{ id: string }} step gated step
 * @param {number} maxCycles how many redo loops are allowed
 * @returns {string}
 */
export function cycleCountJs(step, maxCycles) {
  const cycleKey = `cycles_${step.id.replace(/-/g, '_')}`;
  return (
    `const key = ${JSON.stringify(cycleKey)};\n` +
    `const raw = $execution.customData.get(key);\n` +
    `const used = Number(raw || '0') + 1;\n` +
    `if (!Number.isFinite(used)) {\n` +
    `  throw new Error('cycle counter for ${step.id} is not a number');\n` +
    `}\n` +
    `$execution.customData.set(key, String(used));\n` +
    `const max = ${maxCycles};\n` +
    `return [{ json: { gateCycles: used, gateMaxCycles: max, gateExceeded: used > max } }];`
  );
}

/**
 * Webhook trigger. webhookId must be a real UUID: n8n looks the webhook up
 * by it when it builds the node's execution context, and a malformed id
 * arrives with `context` undefined.
 * @param {{ id: string, name: string, webhookId: string, path: string, position: number[], responseMode?: string }} spec
 * @returns {object}
 */
export function webhookTriggerNode(spec) {
  return {
    id: spec.id,
    name: spec.name,
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2.1,
    position: spec.position,
    webhookId: spec.webhookId,
    parameters: {
      httpMethod: 'POST',
      path: spec.path,
      responseMode: spec.responseMode ?? 'onReceived',
      options: {}
    }
  };
}

/**
 * Wire the auto-decide params + role pair and return the role's name.
 * @param {import('./process-map.mjs').ProcessStep} step the gated step
 * @param {number} index position in the ordered map
 * @param {string} from node that feeds the pair
 * @returns {string}
 */
function addAutoDecide(step, index, from) {
  const autoArtifact = AUTO_AXIS_ARTIFACT[step.id];
  const autoStep = {
    id: `auto-${step.id}`,
    role: 'auto-decide',
    requires: [{ path: autoArtifact }]
  };
  const autoCmd = `node n8n-prototype/roles/auto-decide.mjs --axis=${step.id} --slug={slug} --repoRoot={root}`;
  const autoParams = paramsNode(autoStep, index, autoCmd);
  const autoRole = roleNode(autoStep, index);
  nodes.push(autoParams, autoRole);
  link(from, autoParams.name);
  link(autoParams.name, autoRole.name);
  return autoRole.name;
}

const stepIds = new Set(steps.map((step) => step.id));

/** @type {Map<string, {from: string, outputIndex: number}[]>} */
const completion = new Map();
/** @type {Map<string, string>} */
const entry = new Map();
/** @type {Map<string, string>} */
const afterRole = new Map();

steps.forEach((step, i) => {
  const params = paramsNode(step, i);
  const role = roleNode(step, i);
  nodes.push(params, role);
  link(params.name, role.name);
  entry.set(step.id, params.name);
  /** @type {{ from: string, outputIndex: number }[]} */
  let tails = [{ from: role.name, outputIndex: 0 }];

  if (step.humanGate) {
    if (TELEGRAM) {
      // Notify BEFORE the wait, never after. A message sent after the gate
      // resolves announces a decision that has already been made.
      const notify = notifyNode(step, i);
      nodes.push(notify);
      link(tails[0].from, notify.name);
      tails = [{ from: notify.name, outputIndex: 0 }];
    }

    const autoArtifact = AUTO_AXIS_ARTIFACT[step.id];
    if (AUTO_GATES && autoArtifact) {
      // Instead of the Wait node: a params + Role pair so role-run still
      // refuses a step whose DECISION.md did not change.
      const autoRoleName = addAutoDecide(step, i, tails[0].from);
      tails = [{ from: autoRoleName, outputIndex: 0 }];
    } else if (!AUTO_GATES) {
      if (step.reworkTo && !stepIds.has(step.reworkTo)) {
        throw new Error(`gate ${step.id} reworkTo ${step.reworkTo} is not a step`);
      }
      const reworkName = `${step.reworkTo || step.id} params`;
      const maxCycles = step.maxCycles ?? DEFAULT_MAX_CYCLES;

      const prep = commandPrepNode(
        `gprep_${step.id}`,
        `Prepare gate: ${step.id}`,
        [X_STEP * (i * 2 + 3), 80],
        registerGateJs(step)
      );
      const register = commandNode(`greg_${step.id}`, `Register gate: ${step.id}`, [
        X_STEP * (i * 2 + 4),
        80
      ]);
      const wait = approvalNode(step, i);
      const formIf = ifNode(
        `gif_${step.id}`,
        `If: ${step.id} form submitted`,
        [X_STEP * (i * 2 + 5), 80],
        '={{ $json.formMode }}',
        'exists'
      );
      const decisionIf = ifNode(
        `gid_${step.id}`,
        `If: ${step.id} approved`,
        [X_STEP * (i * 2 + 6), 0],
        '={{ $json.Decision }}',
        'equals',
        'approve'
      );
      // The value is the redo count for this step in this execution.
      const cycle = commandPrepNode(
        `gcyc_${step.id}`,
        `Count cycles: ${step.id}`,
        [X_STEP * (i * 2 + 7), 80],
        cycleCountJs(step, maxCycles)
      );
      const exceeded = ifNode(
        `gex_${step.id}`,
        `If: ${step.id} cycles exceeded`,
        [X_STEP * (i * 2 + 8), 80],
        '={{ $json.gateExceeded }}',
        'true'
      );
      const stop = {
        id: `gstop_${step.id}`,
        name: `Stop: ${step.id} max cycles`,
        type: 'n8n-nodes-base.stopAndError',
        typeVersion: 1,
        position: [X_STEP * (i * 2 + 9), 160],
        parameters: {
          errorType: 'errorMessage',
          errorMessage:
            `=Gate ${step.id} exceeded maxCycles (${maxCycles}) ` +
            `rewinding to ${step.reworkTo || step.id}. cycles={{ $json.gateCycles }}`
        }
      };
      const timeoutPrep = commandPrepNode(
        `gtprep_${step.id}`,
        `Prepare timeout: ${step.id}`,
        [X_STEP * (i * 2 + 6), 240],
        resolveTimeoutJs(step)
      );
      const timeoutRun = commandNode(`gtrun_${step.id}`, `Resolve timeout: ${step.id}`, [
        X_STEP * (i * 2 + 7),
        240
      ]);

      nodes.push(
        prep,
        register,
        wait,
        formIf,
        decisionIf,
        cycle,
        exceeded,
        stop,
        timeoutPrep,
        timeoutRun
      );
      link(tails[0].from, prep.name);
      link(prep.name, register.name);
      link(register.name, wait.name);
      link(wait.name, formIf.name);
      link(formIf.name, decisionIf.name, 0);
      link(formIf.name, timeoutPrep.name, 1);
      link(timeoutPrep.name, timeoutRun.name);
      link(decisionIf.name, cycle.name, 1);
      link(cycle.name, exceeded.name);
      link(exceeded.name, stop.name, 0);
      link(exceeded.name, reworkName, 1);

      /** @type {{ from: string, outputIndex: number }[]} */
      const continueFrom = [{ from: decisionIf.name, outputIndex: 0 }];
      if (autoArtifact) {
        continueFrom.push({ from: addAutoDecide(step, i, timeoutRun.name), outputIndex: 0 });
      } else {
        continueFrom.push({ from: timeoutRun.name, outputIndex: 0 });
      }
      tails = continueFrom;
    }
  }

  completion.set(step.id, tails);
  const roleNext = connections[role.name]?.main?.[0]?.[0]?.node;
  if (roleNext) afterRole.set(step.id, roleNext);
});

wireDag();

for (const node of nodes) {
  if (!connections[node.name]) connections[node.name] = { main: [[]] };
}

const workflow = {
  id: BUILD_WORKFLOW_ID,
  name: `RedAnvil full build (${steps.length} steps, generated)`,
  active: false,
  settings: {
    executionOrder: 'v1',
    saveDataErrorExecution: 'all',
    saveDataSuccessExecution: 'all',
    // execute-error-workflow.ts reads settings.errorWorkflow and runs that
    // workflow with the execution error. The id is the error workflow's id.
    errorWorkflow: ERROR_WORKFLOW_ID
  },
  nodes,
  connections
};

const out = join(HERE, 'workflows', 'redanvil-full-build.json');
if (isDirectRun) writeFileSync(out, JSON.stringify(workflow, null, 2) + '\n');

const errorWorkflow = {
  id: ERROR_WORKFLOW_ID,
  name: 'RedAnvil build errors',
  active: false,
  settings: { executionOrder: 'v1', saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all' },
  nodes: [
    {
      id: 'err-trigger',
      name: 'On build error',
      type: 'n8n-nodes-base.errorTrigger',
      typeVersion: 1,
      position: [0, 0],
      parameters: {}
    },
    commandPrepNode(
      'err-prep',
      'Prepare alert',
      [X_STEP, 0],
      `const root = $env.REDANVIL_REPO;\n` +
        `if (!root) {\n` +
        `  throw new Error('REDANVIL_REPO is not set; the error workflow cannot write an alert');\n` +
        `}\n` +
        `const execution = $json.execution || {};\n` +
        `const workflowInfo = $json.workflow || {};\n` +
        `const failure = execution.error || {};\n` +
        `const message = typeof failure.message === 'string' && failure.message\n` +
        `  ? failure.message\n` +
        `  : 'build workflow failed';\n` +
        `const payload = {\n` +
        `  executionId: String(execution.id ?? 'unknown'),\n` +
        `  source: 'n8n:' + String(workflowInfo.id || ${JSON.stringify(BUILD_WORKFLOW_ID)}),\n` +
        `  message,\n` +
        `  ref: typeof execution.url === 'string' ? execution.url : null\n` +
        `};\n` +
        `const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');\n` +
        `const script = JSON.stringify(String(root).replaceAll('\\\\', '/') + '/n8n-prototype/dispatch/write-alert.mjs');\n` +
        `const cmd = 'node ' + script + ' --payloadB64=' + b64 + ' --repoRoot=' + JSON.stringify(String(root));\n` +
        `return [{ json: { cmd } }];`
    ),
    commandNode('err-run', 'Write alert', [X_STEP * 2, 0])
  ],
  connections: {
    'On build error': { main: [[{ node: 'Prepare alert', type: 'main', index: 0 }]] },
    'Prepare alert': { main: [[{ node: 'Write alert', type: 'main', index: 0 }]] },
    'Write alert': { main: [[]] }
  }
};

const errorOut = join(HERE, 'workflows', 'redanvil-errors.json');
if (isDirectRun) {
  writeFileSync(errorOut, JSON.stringify(errorWorkflow, null, 2) + '\n');

  const unbound = unboundRoles(steps.map((s) => s.id));
  const gates = steps.filter((s) => s.humanGate).map((s) => s.id);
  console.log(`generated ${out}`);
  console.log(`generated ${errorOut}`);
  console.log(`  ${steps.length} steps -> ${nodes.length} nodes`);
  console.log(`  human gates: ${gates.join(', ')}`);
  console.log(`  auto gates: ${AUTO_GATES ? 'on' : 'off'}`);
  console.log(`  telegram: ${TELEGRAM ? 'on' : 'off'}`);
  console.log(`  error workflow: ${ERROR_WORKFLOW_ID}`);
  console.log(`  UNBOUND (will fail, not skip): ${unbound.join(', ') || 'none'}`);
  console.log(`  order: ${steps.map((s) => s.id).join(' -> ')}`);
}
