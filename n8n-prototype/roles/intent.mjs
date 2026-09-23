/**
 * Typed intent for the PRD role.
 *
 * The wizard used to be answered by regex over the prompt. That is still the
 * fallback, but the first attempt asks grok for a structured intent whose
 * appType, dataStorage and integrations are limited to the buttons the wizard
 * actually renders (app-builder/src/i18n/en.ts). Entity text follows the Batch
 * 3 entity-spec contract so the wizard field parses with zero errors.
 *
 * The grok runner is injectable (`opts.runGrok`). Tests pass a fake. The real
 * runner is headless, `shell: false`, ten minutes, and never sees GitHub or
 * Cloudflare credentials.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** How long one grok attempt may run before it is killed. */
const GROK_TIMEOUT_MS = 10 * 60 * 1000;

/** Invalid model output is tried twice (the first call, then one retry). */
const MAX_GROK_ATTEMPTS = 2;

/** Contract: entity and field names are at most this many characters. */
const NAME_MAX_LENGTH = 40;

/** Short product name. Longer than this is a sentence, not a name. */
const APP_NAME_MAX_LENGTH = 80;

/**
 * App-type chips. `en.wizard.appTypeChips` in app-builder/src/i18n/en.ts.
 * There is no Job board chip. Do not add one here.
 * @type {readonly string[]}
 */
export const WIZARD_APP_TYPES = ['SaaS', 'Marketplace', 'Internal tool', 'Mobile app', 'API'];

/**
 * Storage button labels. `en.wizard.dataStorageOptions` (none / simple / relational).
 * @type {readonly string[]}
 */
export const WIZARD_DATA_STORAGE = ['None', 'Simple (D1 tables)', 'Relational + search'];

/**
 * Integration chips. `en.wizard.integrationsChips`.
 * @type {readonly string[]}
 */
export const WIZARD_INTEGRATIONS = ['Stripe', 'Email', 'Webhooks', 'SMS'];

/** Field types the entity-spec contract allows. */
export const FIELD_TYPES = ['text', 'int', 'real', 'bool', 'date', 'datetime'];

/** Always added by the generator. Listing them is an error. */
const RESERVED_FIELDS = new Set(['id', 'created_at', 'updated_at']);

const ENTITY_NAME = new RegExp(`^[A-Z][A-Za-z0-9]{0,${NAME_MAX_LENGTH - 1}}$`);
const FIELD_NAME = new RegExp(`^[a-z][a-zA-Z0-9_]{0,${NAME_MAX_LENGTH - 1}}$`);

/** @type {Promise<typeof import('./prd.mjs')> | undefined} */
let prdModulePromise;

/**
 * Load the PRD role's regex helpers.
 *
 * Dynamic so this module can be imported by `prd.mjs` without a cycle at
 * evaluation time. The helpers are only needed once a prompt is being judged.
 *
 * @returns {Promise<typeof import('./prd.mjs')>}
 */
function loadPrd() {
  if (!prdModulePromise) prdModulePromise = import('./prd.mjs');
  return prdModulePromise;
}

/**
 * Normalise an entity name: trim, upper-case the first letter.
 *
 * @param {unknown} raw model or spec text
 * @returns {string}
 */
export function normaliseEntityName(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Normalise a field name: trim, lower-case the first letter.
 *
 * @param {unknown} raw model or spec text
 * @returns {string}
 */
export function normaliseFieldName(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

/**
 * JSON schema passed to `grok --json-schema`.
 *
 * Enums are the wizard's real button labels, not a guessed taxonomy.
 *
 * @returns {Record<string, unknown>}
 */
export function intentJsonSchema() {
  return {
    type: 'object',
    required: [
      'appName',
      'appType',
      'hasAuth',
      'dataStorage',
      'hasRealtime',
      'integrations',
      'entities',
      'capabilities',
      'nonGoals',
      'negated'
    ],
    properties: {
      appName: { type: 'string' },
      appType: { type: 'string', enum: [...WIZARD_APP_TYPES] },
      hasAuth: { type: 'boolean' },
      dataStorage: { type: 'string', enum: [...WIZARD_DATA_STORAGE] },
      hasRealtime: { type: 'boolean' },
      integrations: {
        type: 'array',
        items: { type: 'string', enum: [...WIZARD_INTEGRATIONS] }
      },
      entities: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'fields'],
          properties: {
            name: { type: 'string' },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                required: ['name', 'type'],
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', enum: [...FIELD_TYPES] },
                  ref: { type: 'string' }
                }
              }
            }
          }
        }
      },
      capabilities: { type: 'array', items: { type: 'string' } },
      nonGoals: { type: 'array', items: { type: 'string' } },
      negated: { type: 'array', items: { type: 'string' } }
    }
  };
}

/**
 * Format entities as the wizard's Main entities value.
 *
 * `Name: field, field:type, field->Other`. Entities are separated by `; `.
 * A text field with no ref is just the name. Round-trips through
 * {@link parseEntitySpec}.
 *
 * @param {Array<{name: string, fields?: Array<{name: string, type?: string, ref?: string}>}>} entities
 * @returns {string}
 */
export function formatEntitySpec(entities) {
  return (entities ?? [])
    .map((entity) => {
      const name = normaliseEntityName(entity.name);
      const fields = (entity.fields ?? []).map((field) => {
        const fieldName = normaliseFieldName(field.name);
        if (field.ref) return `${fieldName}->${normaliseEntityName(field.ref)}`;
        const type = String(field.type ?? 'text').toLowerCase();
        if (type === 'text') return fieldName;
        return `${fieldName}:${type}`;
      });
      return `${name}: ${fields.join(', ')}`;
    })
    .join('; ');
}

/**
 * One field token from an entity spec (`name`, `name:type`, or `name->Entity`).
 *
 * @param {string} token trimmed field text
 * @param {string[]} errors accumulated parse errors
 * @returns {{name: string, type: string, ref?: string} | null}
 */
function parseFieldToken(token, errors) {
  const refMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*->\s*([A-Za-z][A-Za-z0-9]*)$/.exec(token);
  if (refMatch) {
    const name = normaliseFieldName(refMatch[1]);
    const ref = normaliseEntityName(refMatch[2]);
    if (!FIELD_NAME.test(name)) {
      errors.push(`invalid field name: ${refMatch[1]}`);
      return null;
    }
    if (RESERVED_FIELDS.has(name)) {
      errors.push(`reserved field: ${name}`);
      return null;
    }
    if (!ENTITY_NAME.test(ref)) {
      errors.push(`invalid entity ref: ${refMatch[2]}`);
      return null;
    }
    return { name, type: 'text', ref };
  }

  const typeMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z]+)$/.exec(token);
  if (typeMatch) {
    const name = normaliseFieldName(typeMatch[1]);
    const type = typeMatch[2].toLowerCase();
    if (!FIELD_NAME.test(name)) {
      errors.push(`invalid field name: ${typeMatch[1]}`);
      return null;
    }
    if (RESERVED_FIELDS.has(name)) {
      errors.push(`reserved field: ${name}`);
      return null;
    }
    if (!FIELD_TYPES.includes(type)) {
      errors.push(`invalid field type: ${type}`);
      return null;
    }
    return { name, type };
  }

  const name = normaliseFieldName(token);
  if (!FIELD_NAME.test(name)) {
    errors.push(`invalid field name: ${token}`);
    return null;
  }
  if (RESERVED_FIELDS.has(name)) {
    errors.push(`reserved field: ${name}`);
    return null;
  }
  return { name, type: 'text' };
}

/**
 * Parse the wizard's Main entities text.
 *
 * Mirrors the Batch 3 contract: `;` or newline separates entities, a colon
 * separates the name from its fields, and a chunk with no colon is a legacy
 * list of entities that have no fields (valid to parse, not enough to generate).
 *
 * @param {string} text entity spec
 * @returns {{entities: Array<{name: string, fields: Array<{name: string, type: string, ref?: string}>}>, errors: string[]}}
 */
export function parseEntitySpec(text) {
  /** @type {string[]} */
  const errors = [];
  /** @type {Array<{name: string, fields: Array<{name: string, type: string, ref?: string}>}>} */
  const entities = [];
  const raw = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!raw) return { entities, errors };

  const chunks = raw
    .split(/[;\n]+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  for (const chunk of chunks) {
    const colon = chunk.indexOf(':');
    if (colon === -1) {
      for (const nameRaw of chunk.split(',')) {
        const trimmed = nameRaw.trim();
        if (!trimmed) continue;
        const name = normaliseEntityName(trimmed);
        if (!ENTITY_NAME.test(name)) errors.push(`invalid entity name: ${trimmed}`);
        else entities.push({ name, fields: [] });
      }
      continue;
    }

    const name = normaliseEntityName(chunk.slice(0, colon));
    if (!ENTITY_NAME.test(name)) {
      errors.push(`invalid entity name: ${chunk.slice(0, colon).trim()}`);
      continue;
    }
    /** @type {Array<{name: string, type: string, ref?: string}>} */
    const fields = [];
    const fieldSrc = chunk.slice(colon + 1).trim();
    if (fieldSrc) {
      for (const part of fieldSrc.split(',')) {
        const token = part.trim();
        if (!token) continue;
        const field = parseFieldToken(token, errors);
        if (field) fields.push(field);
      }
    }
    entities.push({ name, fields });
  }

  const names = new Set(entities.map((entity) => entity.name));
  /** @type {Set<string>} */
  const seenEntities = new Set();
  for (const entity of entities) {
    if (seenEntities.has(entity.name)) errors.push(`duplicate entity: ${entity.name}`);
    seenEntities.add(entity.name);
    /** @type {Set<string>} */
    const seenFields = new Set();
    for (const field of entity.fields) {
      if (seenFields.has(field.name)) errors.push(`duplicate field: ${entity.name}.${field.name}`);
      seenFields.add(field.name);
      if (field.ref && !names.has(field.ref)) {
        errors.push(`unknown entity ref: ${field.name}->${field.ref}`);
      }
    }
  }
  return { entities, errors };
}

/**
 * Copy of the intent fields, without runner metadata.
 *
 * @param {{appName: string, appType: string, hasAuth: boolean, dataStorage: string, hasRealtime: boolean, integrations: string[], entities: Array<{name: string, fields: Array<{name: string, type: string, ref?: string}>}>, capabilities: string[], nonGoals: string[], negated: string[]}} result
 * @returns {{appName: string, appType: string, hasAuth: boolean, dataStorage: string, hasRealtime: boolean, integrations: string[], entities: Array<{name: string, fields: Array<{name: string, type: string, ref?: string}>}>, capabilities: string[], nonGoals: string[], negated: string[]}}
 */
export function publicIntent(result) {
  return {
    appName: result.appName,
    appType: result.appType,
    hasAuth: result.hasAuth,
    dataStorage: result.dataStorage,
    hasRealtime: result.hasRealtime,
    integrations: [...(result.integrations ?? [])],
    entities: (result.entities ?? []).map((entity) => ({
      name: entity.name,
      fields: entity.fields.map((field) => {
        /** @type {{name: string, type: string, ref?: string}} */
        const copy = { name: field.name, type: field.type };
        if (field.ref) copy.ref = field.ref;
        return copy;
      })
    })),
    capabilities: [...(result.capabilities ?? [])],
    nonGoals: [...(result.nonGoals ?? [])],
    negated: [...(result.negated ?? [])]
  };
}

/**
 * Provenance payload: the intent, where it came from, and how long grok took.
 *
 * @param {{appName: string, appType: string, hasAuth: boolean, dataStorage: string, hasRealtime: boolean, integrations: string[], entities: Array<{name: string, fields: Array<{name: string, type: string, ref?: string}>}>, capabilities: string[], nonGoals: string[], negated: string[], intentSource: string, grokDurationMs: number, fallbackReason?: string}} extracted
 * @returns {{intent: ReturnType<typeof publicIntent>, intentSource: string, grokDurationMs: number, fallbackReason?: string}}
 */
export function provenanceMetaFromIntent(extracted) {
  /** @type {{intent: ReturnType<typeof publicIntent>, intentSource: string, grokDurationMs: number, fallbackReason?: string}} */
  const meta = {
    intent: publicIntent(extracted),
    intentSource: extracted.intentSource,
    grokDurationMs: extracted.grokDurationMs
  };
  if (extracted.fallbackReason) meta.fallbackReason = extracted.fallbackReason;
  return meta;
}

/**
 * Environment for the grok child.
 *
 * GitHub and Cloudflare credentials are dropped. Everything else stays so the
 * `grok login` session under the user profile still resolves.
 *
 * @param {NodeJS.ProcessEnv} [base] environment to copy
 * @returns {NodeJS.ProcessEnv}
 */
export function scrubGrokEnv(base = process.env) {
  /** @type {NodeJS.ProcessEnv} */
  const env = {};
  for (const [key, value] of Object.entries(base)) {
    if (value === undefined) continue;
    if (key === 'GITHUB_TOKEN' || key === 'GH_TOKEN') continue;
    if (key.startsWith('CLOUDFLARE_')) continue;
    env[key] = value;
  }
  return env;
}

/**
 * Argv for one headless grok call.
 *
 * `--max-turns 1` is required for `--json-schema` to come back as
 * `structuredOutput`. Without it the CLI spends the turn on tools and the
 * schema result is null (same failure the independent diff review hit).
 * `--cwd` is the temp dir that holds the prompt file, so a tool call cannot
 * write into the repo.
 *
 * @param {string} promptFile absolute path to the prompt
 * @param {string} schemaText JSON schema
 * @returns {{command: string, args: string[], shell: false, timeoutMs: number}}
 */
export function buildGrokSpawn(promptFile, schemaText) {
  return {
    command: process.platform === 'win32' ? 'grok.exe' : 'grok',
    args: [
      '--no-auto-update',
      '--always-approve',
      '--no-alt-screen',
      '--max-turns',
      '1',
      '--cwd',
      dirname(promptFile),
      '--prompt-file',
      promptFile,
      '--json-schema',
      schemaText
    ],
    shell: false,
    timeoutMs: GROK_TIMEOUT_MS
  };
}

/**
 * spawn options. `shell` is false: grok.exe is on PATH and must not go through
 * cmd.exe, which is what splits a free-text argument.
 *
 * @param {NodeJS.ProcessEnv} [baseEnv] environment before scrubbing
 * @returns {{shell: false, env: NodeJS.ProcessEnv, windowsHide: true}}
 */
export function grokProcessOptions(baseEnv = process.env) {
  return {
    shell: false,
    env: scrubGrokEnv(baseEnv),
    windowsHide: true
  };
}

/**
 * Instructions plus the user's description. The description is data, not a
 * second system prompt.
 *
 * @param {string} prompt app description
 * @returns {string}
 */
function intentPrompt(prompt) {
  return [
    'Extract a structured product intent from the app description below.',
    'Return only JSON matching the schema. Do not use tools, do not edit files, do not explain.',
    '',
    'Rules:',
    '- appType, dataStorage and every integrations entry must be one of the schema enums. Those are the wizard buttons. Do not invent a value.',
    '- If the description says the product is NOT something (not a marketplace, rather than, never, what this is not), put that thing in negated and do not select it as appType or as an integration.',
    '- appName is a short product name, not the whole description.',
    '- entities are the records the app stores. Normalise entity names to start with an uppercase letter and field names to start with a lowercase letter. Letters and digits only for entities. Fields may use underscores.',
    '- Do not emit id, created_at, or updated_at. Those columns are added automatically.',
    '- Field type is text, int, real, bool, date, or datetime. When a field points at another entity, set ref to that entity name and type to text. Omit ref otherwise.',
    '- Every entity needs at least one field.',
    '- hasAuth is true only when people sign in or have their own accounts.',
    '- hasRealtime is true only when the app needs live or push updates.',
    '- capabilities are what the app does. nonGoals are what it does not do.',
    '',
    'App description:',
    '---',
    String(prompt),
    '---'
  ].join('\n');
}

/**
 * Run grok once and return its stdout.
 *
 * @param {string} prompt app description
 * @param {{spawn?: typeof spawn, env?: NodeJS.ProcessEnv}} [deps] test doubles
 * @returns {Promise<string>}
 */
export async function runGrokProcess(prompt, deps = {}) {
  const spawnImpl = deps.spawn ?? spawn;
  const dir = mkdtempSync(join(tmpdir(), 'ra-intent-'));
  const promptFile = join(dir, 'prompt.txt');
  const schemaText = JSON.stringify(intentJsonSchema());
  writeFileSync(promptFile, intentPrompt(prompt), 'utf8');
  const launch = buildGrokSpawn(promptFile, schemaText);
  try {
    return await new Promise((resolve, reject) => {
      const child = spawnImpl(launch.command, launch.args, {
        cwd: dir,
        ...grokProcessOptions(deps.env)
      });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        reject(new Error(`grok timed out after ${launch.timeoutMs}ms`));
      }, launch.timeoutMs);
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`grok exited ${code}: ${String(stderr).slice(0, 400)}`));
          return;
        }
        resolve(stdout);
      });
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Unwrap grok's `--output-format json` envelope.
 *
 * A successful `--json-schema` run puts the object on `structuredOutput`.
 * `text` is the same JSON as a string when the envelope has no structured
 * field. A bare intent object (what a fake runner returns) is accepted too.
 *
 * @param {unknown} raw runner return value
 * @returns {Record<string, unknown>}
 */
export function decodeGrokPayload(raw) {
  if (raw && typeof raw === 'object') return unwrapGrokObject(/** @type {Record<string, unknown>} */ (raw));
  if (typeof raw !== 'string') throw new Error('grok runner returned nothing');
  const text = raw.trim();
  if (!text) throw new Error('grok returned empty stdout');
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const at = text.indexOf('{');
    if (at < 0) throw new Error(`grok stdout was not JSON: ${text.slice(0, 180)}`);
    parsed = JSON.parse(text.slice(at));
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('grok JSON was not an object');
  }
  return unwrapGrokObject(/** @type {Record<string, unknown>} */ (parsed));
}

/**
 * @param {Record<string, unknown>} parsed envelope or intent
 * @returns {Record<string, unknown>}
 */
function unwrapGrokObject(parsed) {
  const structured = parsed.structuredOutput;
  if (structured && typeof structured === 'object' && !Array.isArray(structured)) {
    return /** @type {Record<string, unknown>} */ (structured);
  }
  if (
    structured == null &&
    typeof parsed.structuredOutputError === 'string' &&
    parsed.structuredOutputError.length > 0
  ) {
    throw new Error(`grok structured output failed: ${parsed.structuredOutputError.slice(0, 300)}`);
  }
  if (parsed.stopReason === 'Cancelled' && structured == null) {
    throw new Error('grok cancelled before producing structured output');
  }
  if (typeof parsed.text === 'string') {
    let body = parsed.text.trim();
    const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(body);
    if (fenced?.[1]) body = fenced[1].trim();
    if (body.startsWith('{')) {
      const inner = JSON.parse(body);
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        return /** @type {Record<string, unknown>} */ (inner);
      }
    }
  }
  if (typeof parsed.appType === 'string') return parsed;
  throw new Error('grok JSON had no intent object');
}

/**
 * @param {unknown} value candidate list
 * @param {string} label field name for the error
 * @param {string[]} errors accumulated errors
 * @returns {string[]}
 */
function stringList(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return [];
  }
  /** @type {string[]} */
  const out = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') {
      errors.push(`${label} must contain only non-empty strings`);
      return [];
    }
    out.push(item.trim());
  }
  return out;
}

/**
 * Normalise one model entity, or record why it cannot be used.
 *
 * @param {unknown} raw one entities[] element
 * @param {string[]} errors accumulated errors
 * @returns {{name: string, fields: Array<{name: string, type: string, ref?: string}>} | null}
 */
function normaliseModelEntity(raw, errors) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push('entity must be an object');
    return null;
  }
  const row = /** @type {Record<string, unknown>} */ (raw);
  const name = normaliseEntityName(row.name);
  if (!ENTITY_NAME.test(name)) {
    errors.push(`invalid entity name: ${String(row.name ?? '')}`);
    return null;
  }
  if (!Array.isArray(row.fields)) {
    errors.push(`${name} fields must be an array`);
    return null;
  }
  /** @type {Array<{name: string, type: string, ref?: string}>} */
  const fields = [];
  for (const fieldRaw of row.fields) {
    if (!fieldRaw || typeof fieldRaw !== 'object' || Array.isArray(fieldRaw)) {
      errors.push(`${name} field must be an object`);
      continue;
    }
    const field = /** @type {Record<string, unknown>} */ (fieldRaw);
    const fieldName = normaliseFieldName(field.name);
    if (!FIELD_NAME.test(fieldName)) {
      errors.push(`invalid field name: ${String(field.name ?? '')}`);
      continue;
    }
    if (RESERVED_FIELDS.has(fieldName)) {
      errors.push(`reserved field: ${fieldName}`);
      continue;
    }
    const type = String(field.type ?? 'text').toLowerCase();
    if (!FIELD_TYPES.includes(type)) {
      errors.push(`invalid field type: ${type}`);
      continue;
    }
    /** @type {{name: string, type: string, ref?: string}} */
    const next = { name: fieldName, type };
    if (typeof field.ref === 'string' && field.ref.trim() !== '') {
      const ref = normaliseEntityName(field.ref);
      if (!ENTITY_NAME.test(ref)) errors.push(`invalid entity ref: ${field.ref}`);
      else if (type !== 'text') errors.push(`${fieldName} ref must be stored as text`);
      else next.ref = ref;
    }
    fields.push(next);
  }
  return { name, fields };
}

/**
 * Whether `option` is selected even though the only clauses that name it are negated.
 *
 * A positive mention in another clause is enough. This is the marketplace bug:
 * "it is not a marketplace" must not become appType Marketplace.
 *
 * @param {string} prompt app description
 * @param {string} option wizard option
 * @param {Array<{option: string, test: RegExp}>} rules rule table that owns the option
 * @param {typeof import('./prd.mjs')} prd regex helpers
 * @returns {string} empty when the selection is allowed
 */
function negationConflict(prompt, option, rules, prd) {
  const rule = rules.find((candidate) => candidate.option === option);
  if (!rule) return '';
  if (prd.ruleMatchesPrompt(prompt, rule.test)) return '';
  const negatedHit = prd
    .clausesWithNegation(prompt)
    .some((clause) => clause.negated && rule.test.test(clause.text));
  if (!negatedHit) return '';
  return `${option} is only mentioned under negation`;
}

/**
 * Check types, enums, entity rules, and negation. On success the value is
 * normalised (names, unique integrations).
 *
 * @param {Record<string, unknown>} raw decoded model object
 * @param {string} prompt app description, for the negation check
 * @returns {Promise<{ok: true, value: ReturnType<typeof publicIntent>} | {ok: false, reason: string}>}
 */
async function validateIntent(raw, prompt) {
  /** @type {string[]} */
  const errors = [];
  const appName = typeof raw.appName === 'string' ? raw.appName.trim() : '';
  if (!appName || appName.length > APP_NAME_MAX_LENGTH) {
    errors.push('appName must be a non-empty string up to 80 characters');
  }
  const appType = typeof raw.appType === 'string' ? raw.appType : '';
  if (!WIZARD_APP_TYPES.includes(appType)) errors.push(`appType is not a wizard option: ${appType}`);
  if (typeof raw.hasAuth !== 'boolean') errors.push('hasAuth must be a boolean');
  const dataStorage = typeof raw.dataStorage === 'string' ? raw.dataStorage : '';
  if (!WIZARD_DATA_STORAGE.includes(dataStorage)) {
    errors.push(`dataStorage is not a wizard option: ${dataStorage}`);
  }
  if (typeof raw.hasRealtime !== 'boolean') errors.push('hasRealtime must be a boolean');

  /** @type {string[]} */
  const integrations = [];
  if (!Array.isArray(raw.integrations)) errors.push('integrations must be an array');
  else {
    for (const item of raw.integrations) {
      if (typeof item !== 'string' || !WIZARD_INTEGRATIONS.includes(item)) {
        errors.push(`integration is not a wizard chip: ${String(item)}`);
      } else if (integrations.includes(item)) errors.push(`duplicate integration: ${item}`);
      else integrations.push(item);
    }
  }

  /** @type {Array<{name: string, fields: Array<{name: string, type: string, ref?: string}>}>} */
  const entities = [];
  if (!Array.isArray(raw.entities)) errors.push('entities must be an array');
  else {
    for (const entityRaw of raw.entities) {
      const entity = normaliseModelEntity(entityRaw, errors);
      if (entity) entities.push(entity);
    }
  }
  if (entities.length === 0) errors.push('at least one entity is required');
  for (const entity of entities) {
    if (entity.fields.length === 0) errors.push(`${entity.name} has no fields`);
  }
  const entityNames = new Set(entities.map((entity) => entity.name));
  const seenEntities = new Set();
  for (const entity of entities) {
    if (seenEntities.has(entity.name)) errors.push(`duplicate entity: ${entity.name}`);
    seenEntities.add(entity.name);
    const seenFields = new Set();
    for (const field of entity.fields) {
      if (seenFields.has(field.name)) errors.push(`duplicate field: ${entity.name}.${field.name}`);
      seenFields.add(field.name);
      if (field.ref && !entityNames.has(field.ref)) {
        errors.push(`unknown entity ref: ${field.name}->${field.ref}`);
      }
    }
  }

  const capabilities = stringList(raw.capabilities, 'capabilities', errors);
  const nonGoals = stringList(raw.nonGoals, 'nonGoals', errors);
  const negated = stringList(raw.negated, 'negated', errors);

  if (errors.length === 0 && typeof raw.hasAuth === 'boolean' && typeof raw.hasRealtime === 'boolean') {
    const prd = await loadPrd();
    const appRules = prd.ANSWER_RULES.flatMap((spec) => spec.rules);
    const appConflict = negationConflict(prompt, appType, appRules, prd);
    if (appConflict) errors.push(`appType ${appConflict}`);
    for (const name of integrations) {
      const integrationConflict = negationConflict(prompt, name, prd.INTEGRATION_RULES, prd);
      if (integrationConflict) errors.push(`integration ${integrationConflict}`);
    }
  }

  if (errors.length > 0) return { ok: false, reason: errors.join('; ') };
  return {
    ok: true,
    value: {
      appName,
      appType,
      hasAuth: /** @type {boolean} */ (raw.hasAuth),
      dataStorage,
      hasRealtime: /** @type {boolean} */ (raw.hasRealtime),
      integrations,
      entities,
      capabilities,
      nonGoals,
      negated
    }
  };
}

/**
 * A short name for the regex fallback, taken from the first clause.
 *
 * Not a guess at the domain. The wizard title is still the slug.
 *
 * @param {string} prompt app description
 * @returns {string}
 */
function appNameFromPrompt(prompt) {
  const first = String(prompt)
    .split(/[\n.!?]/)[0]
    ?.trim() ?? '';
  const name = first.split(/\s+/).slice(0, 8).join(' ').trim();
  if (!name) return 'App';
  return name.length > APP_NAME_MAX_LENGTH ? name.slice(0, APP_NAME_MAX_LENGTH).trim() : name;
}

/**
 * Intent from the existing per-group regex rules.
 *
 * Entities stay empty. Guessing nouns out of prose is the defect this role
 * stopped doing; a caller-supplied `--entities` list is still applied later.
 *
 * @param {string} prompt app description
 * @returns {Promise<ReturnType<typeof publicIntent>>}
 */
async function buildRegexIntent(prompt) {
  const prd = await loadPrd();
  const appType =
    prd.derivePicks({ label: 'App type', options: [...WIZARD_APP_TYPES] }, prompt)[0] ?? 'SaaS';
  const auth = prd.derivePicks(
    { label: 'Does this app need sign-in?', options: ['Yes', 'No'] },
    prompt
  )[0];
  const dataStorage =
    prd.derivePicks({ label: 'Data storage', options: [...WIZARD_DATA_STORAGE] }, prompt)[0] ??
    'Simple (D1 tables)';
  const realtime = prd.derivePicks(
    { label: 'Realtime updates?', options: ['Yes', 'No'] },
    prompt
  )[0];
  const integrations = prd.derivePicks(
    { label: 'Integrations', options: [...WIZARD_INTEGRATIONS] },
    prompt
  );
  const negated = prd
    .clausesWithNegation(prompt)
    .filter((clause) => clause.negated)
    .map((clause) => clause.text);
  return {
    appName: appNameFromPrompt(prompt),
    appType,
    hasAuth: auth === 'Yes',
    dataStorage,
    hasRealtime: realtime === 'Yes',
    integrations,
    entities: [],
    capabilities: [],
    nonGoals: [],
    negated
  };
}

/**
 * Extract a typed intent.
 *
 * Runs grok, validates, retries once on invalid output, then falls back to
 * the regex rules. `intentSource` is `grok` or `regex-fallback`. On fallback,
 * `fallbackReason` is the last validation or runner error.
 *
 * @param {string} prompt app description
 * @param {{runGrok?: (prompt: string, ctx: {attempt: number, schema: Record<string, unknown>}) => unknown | Promise<unknown>, fallback?: (prompt: string) => Promise<ReturnType<typeof publicIntent>> | ReturnType<typeof publicIntent>}} [opts]
 * @returns {Promise<ReturnType<typeof publicIntent> & {intentSource: 'grok' | 'regex-fallback', grokDurationMs: number, fallbackReason?: string}>}
 */
export async function extractIntent(prompt, opts = {}) {
  const runGrok = opts.runGrok ?? ((text) => runGrokProcess(text));
  const started = Date.now();
  /** @type {string[]} */
  const reasons = [];
  const schema = intentJsonSchema();

  for (let attempt = 1; attempt <= MAX_GROK_ATTEMPTS; attempt += 1) {
    try {
      const raw = await runGrok(prompt, { attempt, schema });
      const decoded = decodeGrokPayload(raw);
      const validated = await validateIntent(decoded, prompt);
      if (validated.ok) {
        return {
          ...validated.value,
          intentSource: 'grok',
          grokDurationMs: Date.now() - started
        };
      }
      reasons.push(validated.reason);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reasons.push(message);
    }
  }

  const fallback = opts.fallback ?? buildRegexIntent;
  const base = await fallback(prompt);
  const fallbackReason = (reasons[reasons.length - 1] || 'grok output was not a valid intent').slice(
    0,
    500
  );
  return {
    ...base,
    intentSource: 'regex-fallback',
    fallbackReason,
    grokDurationMs: Date.now() - started
  };
}

