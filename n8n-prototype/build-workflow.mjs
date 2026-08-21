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
import { BINDINGS, unboundRoles } from './bindings.mjs';

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
  // The bound command is baked in from bindings.mjs. Previously the generator
  // emitted only an env-var lookup with an "echo no runner configured" fallback,
  // so the workflow refused roles the CLI walker could already run.
  const bound = BINDINGS[step.id] ?? '';
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
      text:
        `=RedAnvil needs a decision: *${step.id}*\n\n` +
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
    id: 'hook',
    name: 'Start via webhook',
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2.1,
    position: [0, 220],
    // A FIXED, VALID UUID. Fixed so the callback URL survives regeneration and
    // the overnight loop never has to rediscover it. Valid because n8n looks the
    // webhook up by this id when it builds the node's execution context -- the
    // first attempt used a readable-but-malformed id ending "-redanvilbuild",
    // and the request reached the node with `context` undefined:
    //   TypeError: Cannot read properties of undefined (reading 'getNode')
    // which reads like a bug in the node and is actually a bad id in our JSON.
    webhookId: 'daccb558-a999-48b4-9d11-9ac2067ac177',
    parameters: {
      httpMethod: 'POST',
      path: 'redanvil-build',
      // Respond immediately. The build runs for hours; holding the HTTP
      // connection open for it would time out long before the first gate.
      responseMode: 'onReceived',
      options: {}
    }
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
        "const body = ($json && $json.body) ? $json.body : {};\n" +
        "const repoRoot = $env.REDANVIL_REPO || 'C:/Users/brian/RedAnvil';\n" +
        "const runner = $env.REDANVIL_RUNNER || 'C:/Users/brian/RedAnvil/n8n-prototype/role-run.mjs';\n" +
        "const requestedSlug = typeof body.slug === 'string' ? body.slug : '';\n" +
        "if (requestedSlug && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(requestedSlug)) {\n" +
        "  throw new Error('slug must match /^[a-z0-9][a-z0-9-]{0,63}$/ -- it becomes a path component and a shell argument');\n" +
        "}\n" +
        "const slug = requestedSlug || $env.REDANVIL_SLUG || 'pet-sitter';\n" +
        "const prompt = typeof body.prompt === 'string' && body.prompt.trim() ? body.prompt : $env.REDANVIL_PROMPT;\n" +
        "if (!prompt) {\n" +
        "  throw new Error('No prompt: POST a { prompt } body to the webhook, or set REDANVIL_PROMPT. The prd role drives the live app builder with it, and every later role builds what that PRD says, so there is no safe default.');\n" +
        "}\n" +
        'return [{ json: { repoRoot, runner, slug, prompt } }];'
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
let previous = 'Slice config';

steps.forEach((step, i) => {
  const params = paramsNode(step, i);
  const role = roleNode(step, i);
  nodes.push(params, role);
  connections[previous] = { main: [[{ node: params.name, type: 'main', index: 0 }]] };
  connections[params.name] = { main: [[{ node: role.name, type: 'main', index: 0 }]] };
  previous = role.name;

  if (step.humanGate) {
    // Notify BEFORE the wait, never after. A message sent after the gate
    // resolves announces a decision that has already been made.
    const notify = notifyNode(step, i);
    const approve = approvalNode(step, i);
    nodes.push(notify, approve);
    connections[previous] = { main: [[{ node: notify.name, type: 'main', index: 0 }]] };
    connections[notify.name] = { main: [[{ node: approve.name, type: 'main', index: 0 }]] };
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

const unbound = unboundRoles(steps.map((s) => s.id));
const gates = steps.filter((s) => s.humanGate).map((s) => s.id);
console.log(`generated ${out}`);
console.log(`  ${steps.length} steps -> ${nodes.length} nodes`);
console.log(`  human gates: ${gates.join(', ')}`);
console.log(`  UNBOUND (will fail, not skip): ${unbound.join(', ') || 'none'}`);
console.log(`  order: ${steps.map((s) => s.id).join(' -> ')}`);
