/**
 * Typed intent for the PRD role.
 *
 * Grok is faked. A separate manual run calls the real CLI; this file must
 * not. Every refusal check names the input that makes it fail.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, test } from 'node:test';
import {
  WIZARD_APP_TYPES,
  WIZARD_DATA_STORAGE,
  WIZARD_INTEGRATIONS,
  buildGrokSpawn,
  extractIntent,
  formatEntitySpec,
  parseEntitySpec,
  provenanceMetaFromIntent,
  runGrokProcess
} from '../roles/intent.mjs';
import {
  entityTextForWizard,
  picksForGroup,
  readFidelity,
  settleGeneratedPrd,
  writePrdArtifacts
} from '../roles/prd.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

/** The prompt the task requires a real grok call for. Tests fake that call. */
const DOG_PROMPT =
  'A reminder app for dog owners that tracks recurring care tasks like vaccinations, grooming and vet appointments per dog, with due dates and a history';

/** Contract example. Must parse with zero errors and round-trip. */
const ENTITY_EXAMPLE =
  'Dog: name, breed, birthDate:date; CareTask: title, dueDate:date, repeatDays:int, dog->Dog; CareLog: doneAt:datetime, note, task->CareTask';

/**
 * A complete valid intent. Email is a real chip, and the dog prompt's
 * "reminder" is a positive (not negated) match for that chip.
 */
const VALID_INTENT = {
  appName: 'Dog Care',
  appType: 'Mobile app',
  hasAuth: true,
  dataStorage: 'Simple (D1 tables)',
  hasRealtime: false,
  integrations: ['Email'],
  entities: [
    {
      name: 'Dog',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'breed', type: 'text' },
        { name: 'birthDate', type: 'date' }
      ]
    },
    {
      name: 'CareTask',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'dueDate', type: 'date' },
        { name: 'repeatDays', type: 'int' },
        { name: 'dog', type: 'text', ref: 'Dog' }
      ]
    },
    {
      name: 'CareLog',
      fields: [
        { name: 'doneAt', type: 'datetime' },
        { name: 'note', type: 'text' },
        { name: 'task', type: 'text', ref: 'CareTask' }
      ]
    }
  ],
  capabilities: ['Track recurring care tasks per dog', 'Keep a history of completed care'],
  nonGoals: ['A marketplace of sitters'],
  negated: []
};

/**
 * Labels `readGroups` actually walks to. Storage and realtime are the hint
 * under the heading, not the heading, because the button parent sits after
 * the hint paragraph.
 */
const WIZARD_GROUPS = [
  { label: 'App type', options: [...WIZARD_APP_TYPES] },
  { label: 'Does this app need sign-in?', options: ['Yes', 'No'] },
  { label: 'Optional. Default is simple D1 tables.', options: [...WIZARD_DATA_STORAGE] },
  {
    label: 'Optional. Live refresh or push-style updates (default no).',
    options: ['Yes', 'No']
  },
  { label: 'Optional. Free text or pick common chips.', options: [...WIZARD_INTEGRATIONS] }
];

/** @type {string[]} */
const scratchDirs = [];

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * A temp directory removed after the test.
 * @returns {string}
 */
function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'ra-prd-intent-'));
  scratchDirs.push(dir);
  return dir;
}

/**
 * A child_process stand-in that emits stdout and close on the next turn,
 * after the caller has attached listeners.
 *
 * @param {string} stdout
 * @returns {object}
 */
function fakeChild(stdout) {
  /** @type {Record<string, (chunk: string) => void>} */
  const stdoutListeners = {};
  /** @type {Record<string, (chunk: string) => void>} */
  const stderrListeners = {};
  /** @type {Record<string, (code: number) => void>} */
  const childListeners = {};
  return {
    stdout: {
      /** @returns {void} */
      setEncoding() {},
      /**
       * @param {string} event
       * @param {(chunk: string) => void} fn
       */
      on(event, fn) {
        stdoutListeners[event] = fn;
      }
    },
    stderr: {
      /** @returns {void} */
      setEncoding() {},
      /**
       * @param {string} event
       * @param {(chunk: string) => void} fn
       */
      on(event, fn) {
        stderrListeners[event] = fn;
      }
    },
    /** @returns {void} */
    kill() {},
    /**
     * @param {string} event
     * @param {(code: number) => void} fn
     */
    on(event, fn) {
      childListeners[event] = fn;
    },
    /** @returns {void} */
    emit() {
      stdoutListeners.data?.(stdout);
      childListeners.close?.(0);
    }
  };
}

/**
 * Quoted strings in an array literal that follows `marker` in en.ts.
 *
 * @param {string} source en.ts
 * @param {string} marker unique property name
 * @returns {string[]}
 */
function quotedArrayAfter(source, marker) {
  const at = source.indexOf(marker);
  assert.ok(at >= 0, `missing ${marker} in en.ts`);
  const list = /\[[^\]]+\]/.exec(source.slice(at, at + 400));
  assert.ok(list, `no array after ${marker}`);
  return [...list[0].matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

/**
 * PRD whose frontmatter says the prompt was missed.
 * @returns {string}
 */
function fidelityFailMarkdown() {
  return [
    '# Dog Care — product requirements',
    '',
    '```yaml',
    'appType: "Mobile app"',
    'hasAuth: true',
    'fidelity: fail',
    'fidelityUnmatched:',
    '  - track vaccinations per dog',
    '  - keep a history of grooming',
    '```',
    '',
    '## 1. Problem',
    'Owners forget care.',
    ''
  ].join('\n');
}

/**
 * The fidelity-fail check. A settle that returns success throws here.
 *
 * @param {(markdown: string, opts: {repoRoot: string, slug: string}) => {exitCode: number}} settle
 * @param {string} repo temp repo root
 * @param {string} markdown fixture PRD
 * @returns {void}
 */
function expectFidelityRefusal(settle, repo, markdown) {
  const result = settle(markdown, {
    repoRoot: repo,
    slug: 'dog-care',
    warn: () => {}
  });
  assert.equal(result.exitCode, 1, 'fidelity: fail must exit non-zero');
  const alertDir = join(repo, '.redanvil', 'dispatch', 'alerts');
  assert.equal(existsSync(alertDir), true, 'alert directory was not created');
  const files = readdirSync(alertDir).filter((name) => name.endsWith('.json'));
  assert.equal(files.length, 1, 'expected one alert file');
  const alert = JSON.parse(readFileSync(join(alertDir, files[0]), 'utf8'));
  assert.equal(alert.id, files[0].replace(/\.json$/, ''));
  assert.equal(alert.source, 'roles/prd.mjs');
  assert.equal(alert.ref, 'dog-care/docs/PRD.md');
  assert.match(alert.at, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(alert.message, /track vaccinations per dog/);
  assert.match(alert.message, /keep a history of grooming/);
  assert.deepEqual(Object.keys(alert).sort(), ['at', 'id', 'message', 'ref', 'source']);
  assert.equal(existsSync(join(alertDir, `.${files[0]}.${process.pid}.tmp`)), false);
}

describe('wizard enums are the buttons the scope step renders', () => {
  test('app type, storage and integrations match app-builder/src/i18n/en.ts', () => {
    const en = readFileSync(join(REPO, 'app-builder', 'src', 'i18n', 'en.ts'), 'utf8');
    const storageAt = en.indexOf('dataStorageOptions:');
    assert.ok(storageAt >= 0);
    const storage = en.slice(storageAt, storageAt + 400);
    const value = (key) => {
      const match = new RegExp(`${key}:\\s*'([^']+)'`).exec(storage);
      assert.ok(match, key);
      return match[1];
    };
    assert.deepEqual([...WIZARD_APP_TYPES], quotedArrayAfter(en, 'appTypeChips:'));
    assert.deepEqual([...WIZARD_INTEGRATIONS], quotedArrayAfter(en, 'integrationsChips:'));
    assert.deepEqual([...WIZARD_DATA_STORAGE], [value('none'), value('simple'), value('relational')]);
  });

  test('the headless launch is shell false, ten minutes, and carries the required flags', () => {
    const promptFile = join(scratch(), 'prompt.txt');
    const schemaText = buildGrokSpawn(promptFile, '{"type":"object"}').args.at(-1);
    // The launch helper echoes the schema it was given. The schema extractIntent
    // builds is checked by parsing a real runGrokProcess argv below.
    assert.equal(typeof schemaText, 'string');
    const launch = buildGrokSpawn(promptFile, schemaText ?? '');
    assert.equal(launch.shell, false);
    assert.equal(launch.timeoutMs, 10 * 60 * 1000);
    assert.equal(launch.args.includes('--no-auto-update'), true);
    assert.equal(launch.args.includes('--always-approve'), true);
    assert.equal(launch.args.includes('--no-alt-screen'), true);
    assert.equal(launch.args.includes('--prompt-file'), true);
    assert.equal(launch.args.includes('--json-schema'), true);
    assert.equal(launch.args[launch.args.indexOf('--prompt-file') + 1], promptFile);
  });
});

describe('grok runner', () => {
  test('spawn is shell false, secrets are scrubbed, flags and enums are the wizard ones', async () => {
    /** @type {{command?: string, args?: string[], options?: {shell: boolean, env: NodeJS.ProcessEnv}, prompt?: string, schema?: {properties: {appType: {enum: string[]}, dataStorage: {enum: string[]}, integrations: {items: {enum: string[]}}}}} | null} */
    let seen = null;
    const prompt = DOG_PROMPT;
    await runGrokProcess(prompt, {
      env: {
        PATH: 'C:\\Windows',
        HOME: 'C:\\Users\\brian',
        GITHUB_TOKEN: 'gh-secret',
        GH_TOKEN: 'gh-secret-2',
        CLOUDFLARE_API_TOKEN: 'cf-secret',
        CLOUDFLARE_ACCOUNT_ID: 'cf-account'
      },
      /**
       * @param {string} command
       * @param {string[]} args
       * @param {{shell: boolean, env: NodeJS.ProcessEnv}} options
       */
      spawn(command, args, options) {
        const promptPath = args[args.indexOf('--prompt-file') + 1];
        const schemaText = args[args.indexOf('--json-schema') + 1];
        seen = {
          command,
          args,
          options,
          prompt: readFileSync(promptPath, 'utf8'),
          schema: JSON.parse(schemaText)
        };
        const child = fakeChild('{}');
        setImmediate(() => child.emit());
        return child;
      }
    });
    assert.ok(seen);
    assert.equal(seen.options.shell, false);
    assert.equal(seen.command, process.platform === 'win32' ? 'grok.exe' : 'grok');
    assert.equal(seen.options.env.GITHUB_TOKEN, undefined);
    assert.equal(seen.options.env.GH_TOKEN, undefined);
    assert.equal(seen.options.env.CLOUDFLARE_API_TOKEN, undefined);
    assert.equal(seen.options.env.CLOUDFLARE_ACCOUNT_ID, undefined);
    assert.equal(seen.options.env.HOME, 'C:\\Users\\brian');
    assert.equal(seen.options.env.PATH, 'C:\\Windows');
    const flat = seen.args.join('\n');
    assert.equal(flat.includes('gh-secret'), false);
    assert.equal(flat.includes('cf-secret'), false);
    assert.equal(seen.args.includes('--no-auto-update'), true);
    assert.equal(seen.args.includes('--always-approve'), true);
    assert.equal(seen.args.includes('--no-alt-screen'), true);
    assert.equal(seen.args.includes('--prompt-file'), true);
    assert.equal(seen.args.includes('--json-schema'), true);
    assert.equal(seen.args[seen.args.indexOf('--max-turns') + 1], '1');
    assert.match(seen.prompt, /dog owners/);
    assert.equal(seen.prompt.includes('gh-secret'), false);
    assert.deepEqual(seen.schema.properties.appType.enum, [...WIZARD_APP_TYPES]);
    assert.deepEqual(seen.schema.properties.dataStorage.enum, [...WIZARD_DATA_STORAGE]);
    assert.deepEqual(seen.schema.properties.integrations.items.enum, [...WIZARD_INTEGRATIONS]);
  });
});

describe('entity spec', () => {
  test('the contract example parses with zero errors and round-trips', () => {
    const parsed = parseEntitySpec(ENTITY_EXAMPLE);
    assert.deepEqual(parsed.errors, []);
    assert.deepEqual(
      parsed.entities.map((entity) => entity.name),
      ['Dog', 'CareTask', 'CareLog']
    );
    assert.equal(parsed.entities[1].fields.find((field) => field.name === 'dog')?.ref, 'Dog');
    assert.equal(parsed.entities[1].fields.find((field) => field.name === 'repeatDays')?.type, 'int');
    assert.equal(parsed.entities[2].fields.find((field) => field.name === 'doneAt')?.type, 'datetime');
    assert.ok(parsed.entities.every((entity) => entity.fields.length > 0));
    const again = parseEntitySpec(formatEntitySpec(parsed.entities));
    assert.deepEqual(again, parsed);
  });

  test('FAIL INPUT: a reserved field and a dangling ref are errors; legacy names are not', () => {
    const reserved = parseEntitySpec('Dog: id, name');
    assert.ok(reserved.errors.some((error) => /reserved field: id/.test(error)));
    const dangling = parseEntitySpec('CareTask: dog->Dog');
    assert.ok(dangling.errors.some((error) => /unknown entity ref: dog->Dog/.test(error)));
    const legacy = parseEntitySpec('Dog, CareTask');
    assert.deepEqual(legacy.errors, []);
    assert.deepEqual(legacy.entities, [
      { name: 'Dog', fields: [] },
      { name: 'CareTask', fields: [] }
    ]);
    const normalised = parseEntitySpec('dog: Name, BirthDate:date');
    assert.deepEqual(normalised.errors, []);
    assert.equal(normalised.entities[0].name, 'Dog');
    assert.equal(normalised.entities[0].fields[0].name, 'name');
    assert.equal(normalised.entities[0].fields[1].name, 'birthDate');
    assert.equal(normalised.entities[0].fields[1].type, 'date');
  });
});

describe('extractIntent', () => {
  test('a valid grok envelope fills every wizard group and a parseable entity spec', async () => {
    let calls = 0;
    const intent = await extractIntent(DOG_PROMPT, {
      runGrok: () => {
        calls += 1;
        return { structuredOutput: VALID_INTENT, stopReason: 'EndTurn' };
      }
    });
    assert.equal(calls, 1);
    assert.equal(intent.intentSource, 'grok');
    assert.equal(intent.fallbackReason, undefined);
    assert.equal(typeof intent.grokDurationMs, 'number');
    const expected = ['Mobile app', 'Yes', 'Simple (D1 tables)', 'No', 'Email'];
    WIZARD_GROUPS.forEach((group, index) => {
      const picks = picksForGroup(group, DOG_PROMPT, intent);
      assert.deepEqual(picks, [expected[index]], group.label);
    });
    const spec = formatEntitySpec(intent.entities);
    const parsed = parseEntitySpec(spec);
    assert.deepEqual(parsed.errors, []);
    assert.ok(parsed.entities.every((entity) => entity.fields.length > 0));
    assert.equal(entityTextForWizard(intent, 'Ignored'), spec);
    assert.equal(
      entityTextForWizard(
        { entities: [{ name: 'bad name', fields: [{ name: 'name', type: 'text' }] }] },
        'Dog'
      ),
      'Dog'
    );
  });

  test('a negated marketplace clause never selects Marketplace, a later positive one still does', async () => {
    let rejectedCalls = 0;
    const rejected = await extractIntent('it is not a marketplace', {
      runGrok: () => {
        rejectedCalls += 1;
        if (rejectedCalls > 2) throw new Error('retried more than once');
        return { ...VALID_INTENT, appType: 'Marketplace', appName: 'Not A Market' };
      }
    });
    assert.equal(rejectedCalls, 2);
    assert.equal(rejected.intentSource, 'regex-fallback');
    assert.match(rejected.fallbackReason ?? '', /negation/i);
    assert.notEqual(rejected.appType, 'Marketplace');
    const picks = picksForGroup(
      { label: 'App type', options: [...WIZARD_APP_TYPES] },
      'it is not a marketplace',
      rejected
    );
    assert.notEqual(picks[0], 'Marketplace');

    let keptCalls = 0;
    const kept = await extractIntent(
      'it is not a job board, it is a marketplace for buyers and sellers',
      {
        runGrok: () => {
          keptCalls += 1;
          return {
            ...VALID_INTENT,
            appType: 'Marketplace',
            appName: 'Board',
            integrations: [],
            hasAuth: false
          };
        }
      }
    );
    assert.equal(keptCalls, 1);
    assert.equal(kept.intentSource, 'grok');
    assert.equal(kept.appType, 'Marketplace');
    assert.deepEqual(
      picksForGroup(
        { label: 'App type', options: [...WIZARD_APP_TYPES] },
        'it is not a job board, it is a marketplace for buyers and sellers',
        kept
      ),
      ['Marketplace']
    );
  });

  test('invalid grok output is retried once, then the regex fallback is recorded', async () => {
    let calls = 0;
    const intent = await extractIntent(DOG_PROMPT, {
      runGrok: () => {
        calls += 1;
        if (calls > 2) throw new Error('retried more than once');
        return 'nope';
      }
    });
    assert.equal(calls, 2);
    assert.equal(intent.intentSource, 'regex-fallback');
    assert.match(intent.fallbackReason ?? '', /not JSON/i);
    assert.equal(WIZARD_APP_TYPES.includes(intent.appType), true);
    assert.deepEqual(intent.entities, []);

    let retry = 0;
    const recovered = await extractIntent(DOG_PROMPT, {
      runGrok: () => {
        retry += 1;
        if (retry === 1) return '{';
        return VALID_INTENT;
      }
    });
    assert.equal(retry, 2);
    assert.equal(recovered.intentSource, 'grok');
    assert.equal(recovered.appName, 'Dog Care');
  });

  test('provenance and intent.json record the intent, its source, and the grok duration', async () => {
    const dir = scratch();
    const extracted = await extractIntent(DOG_PROMPT, {
      runGrok: () => ({ structuredOutput: VALID_INTENT })
    });
    const markdown = 'x'.repeat(2500);
    writePrdArtifacts(
      dir,
      markdown,
      DOG_PROMPT,
      [],
      'https://redanvil.pages.dev/',
      provenanceMetaFromIntent(extracted)
    );
    const provenance = JSON.parse(readFileSync(join(dir, 'prd-provenance.json'), 'utf8'));
    const intentFile = JSON.parse(readFileSync(join(dir, 'intent.json'), 'utf8'));
    assert.equal(provenance.intentSource, 'grok');
    assert.equal(typeof provenance.grokDurationMs, 'number');
    assert.equal(provenance.intent.appType, 'Mobile app');
    assert.equal(provenance.intent.entities.length, 3);
    assert.equal(intentFile.intentSource, 'grok');
    assert.equal(intentFile.grokDurationMs, provenance.grokDurationMs);
    assert.equal(intentFile.appName, 'Dog Care');
    assert.equal(intentFile.dataStorage, 'Simple (D1 tables)');
    assert.equal(intentFile.fallbackReason, undefined);

    const fallback = await extractIntent('it is not a marketplace', {
      runGrok: () => 'nope'
    });
    const fallbackDir = scratch();
    writePrdArtifacts(
      fallbackDir,
      markdown,
      'it is not a marketplace',
      [],
      'https://redanvil.pages.dev/',
      provenanceMetaFromIntent(fallback)
    );
    const recorded = JSON.parse(readFileSync(join(fallbackDir, 'intent.json'), 'utf8'));
    assert.equal(recorded.intentSource, 'regex-fallback');
    assert.equal(typeof recorded.fallbackReason, 'string');
    assert.notEqual(recorded.appType, 'Marketplace');
  });
});

describe('generated PRD settlement', () => {
  test('fidelity: fail writes an alert and returns a non-zero exit', () => {
    const repo = scratch();
    expectFidelityRefusal(settleGeneratedPrd, repo, fidelityFailMarkdown());
    const flow = readFidelity(
      '```yaml\nfidelity: fail\nfidelityUnmatched: ["track vaccinations per dog", "keep a history of grooming"]\n```\n'
    );
    assert.equal(flow.fidelity, 'fail');
    assert.deepEqual(flow.unmatched, ['track vaccinations per dog', 'keep a history of grooming']);
  });

  test('a --- frontmatter fidelity: fail is the same refusal', () => {
    const repo = scratch();
    const markdown = [
      '---',
      'fidelity: "fail"',
      'fidelityUnmatched:',
      '  - track vaccinations per dog',
      '  - keep a history of grooming',
      '---',
      '',
      '# Dog Care',
      ''
    ].join('\n');
    expectFidelityRefusal(settleGeneratedPrd, repo, markdown);
  });

  test('FAIL INPUT: a role that ignores fidelity does not pass the refusal check', () => {
    const repo = scratch();
    const ignoring = () => ({ exitCode: 0, warnings: [], message: '' });
    assert.throws(() => expectFidelityRefusal(ignoring, repo, fidelityFailMarkdown()));
  });

  test('the claims block is copied verbatim, and a wrong kind is not written', () => {
    const claimsBody = '{\n  "kind": "claims",\n  "slug": "dog-care",\n  "title": "Dog Care"\n}\n';
    const markdown =
      '# Dog Care — product requirements\n\n' +
      '```yaml\nappType: "Mobile app"\nfidelity: pass\n```\n\n' +
      '## Machine-readable claims\n\n' +
      '```json claims\n' +
      claimsBody +
      '```\n';
    const repo = scratch();
    const warnings = [];
    const result = settleGeneratedPrd(markdown, {
      repoRoot: repo,
      slug: 'dog-care',
      warn: (message) => warnings.push(message)
    });
    assert.equal(result.exitCode, 0);
    assert.deepEqual(warnings, []);
    const written = readFileSync(join(repo, 'dog-care', '.redanvil', 'claims.json'), 'utf8');
    assert.equal(written, claimsBody);
    assert.equal(JSON.parse(written).kind, 'claims');

    const badRepo = scratch();
    const bad = settleGeneratedPrd(
      '```yaml\nfidelity: pass\n```\n\n## Machine-readable claims\n\n```json claims\n{"kind":"notes"}\n```\n',
      { repoRoot: badRepo, slug: 'dog-care', warn: () => {} }
    );
    assert.equal(bad.exitCode, 1);
    assert.match(bad.message, /kind/);
    assert.equal(existsSync(join(badRepo, 'dog-care', '.redanvil', 'claims.json')), false);
  });

  test('missing fidelity and claims warn and continue', () => {
    const repo = scratch();
    /** @type {string[]} */
    const warnings = [];
    const result = settleGeneratedPrd('# Dog Care\n\n```yaml\nappType: "SaaS"\nhasAuth: false\n```\n', {
      repoRoot: repo,
      slug: 'dog-care',
      warn: (message) => warnings.push(message)
    });
    assert.equal(result.exitCode, 0);
    assert.equal(warnings.length, 2);
    assert.match(warnings.join('\n'), /fidelity/i);
    assert.match(warnings.join('\n'), /claims/i);
    assert.equal(existsSync(join(repo, '.redanvil', 'dispatch', 'alerts')), false);
    assert.equal(existsSync(join(repo, 'dog-care', '.redanvil', 'claims.json')), false);
  });
});
