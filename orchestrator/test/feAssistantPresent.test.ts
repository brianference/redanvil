/**
 * Known-answer fixtures for `fe-assistant-present`.
 *
 * Proves FAIL on missing endpoint, stubbed/canned assistants, model-less
 * handlers, and missing UI; PASS on a QuickFlight-shaped grounded Worker
 * assistant; n/a when there is no queryable domain data.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadRubric } from '../src/rubric/index';
import { APP_CHECKS } from '../src/commands/gate';

const CHECK_SCRIPT = fileURLToPath(
  new URL('../scripts/checks/fe-assistant-present.mjs', import.meta.url)
);
const CHECK_VIA_ROUTER = fileURLToPath(
  new URL('../scripts/checks/check.mjs', import.meta.url)
);
const node = process.execPath;

/** Temp dirs cleaned after each test. */
const tempDirs: string[] = [];

/**
 * Create a unique temp app directory.
 * @returns Absolute path.
 */
function makeAppDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'redanvil-fe-asst-'));
  tempDirs.push(dir);
  return dir;
}

/**
 * Write a file under the app root.
 * @param appDir App root.
 * @param relPath Relative path.
 * @param body Contents.
 */
function write(appDir: string, relPath: string, body: string): void {
  const full = join(appDir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, 'utf8');
}

/**
 * Give the app queryable domain data (D1 + CREATE TABLE).
 * @param appDir App root.
 */
function withDomainData(appDir: string): void {
  write(
    appDir,
    'wrangler.toml',
    `
name = "demo"
compatibility_date = "2024-01-01"
[[d1_databases]]
binding = "DB"
database_name = "demo-db"
database_id = "00000000-0000-0000-0000-000000000000"
`
  );
  write(
    appDir,
    'migrations/0001_init.sql',
    `CREATE TABLE IF NOT EXISTS crops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
`
  );
}

/**
 * Run the standalone check script.
 * @param appDir App root.
 * @returns Child result.
 */
function runStandalone(appDir: string) {
  return spawnSync(node, [CHECK_SCRIPT, appDir], { encoding: 'utf8', env: process.env });
}

/**
 * Run via check.mjs router.
 * @param appDir App root.
 * @returns Child result.
 */
function runViaRouter(appDir: string) {
  return spawnSync(node, [CHECK_VIA_ROUTER, 'fe-assistant-present', appDir], {
    encoding: 'utf8',
    env: process.env
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) break;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
});

describe('fe-assistant-present registration', () => {
  it('is encoded as a pure-det frontend blocker and wired into APP_CHECKS', () => {
    const rule = loadRubric().find((r) => r.id === 'fe-assistant-present');
    expect(rule, 'missing from rubric').toBeDefined();
    expect(rule!.lane).toBe('frontend');
    expect(rule!.severity).toBe('blocker');
    expect(rule!.method).toBe('det');
    expect(APP_CHECKS.map((c) => c.ruleId)).toContain('fe-assistant-present');
  });
});

describe('fe-assistant-present known-answer failures', () => {
  it('fails when domain data exists but there is no assistant endpoint', () => {
    const app = makeAppDir();
    withDomainData(app);
    write(
      app,
      'functions/api/health.ts',
      `export function onRequestGet() { return new Response('ok'); }\n`
    );
    const r = runStandalone(app);
    expect(r.status, r.stderr + r.stdout).toBe(1);
    expect(r.stderr).toMatch(/no assistant endpoint/i);
  });

  it('fails a canned-response stub that never calls a model', () => {
    const app = makeAppDir();
    withDomainData(app);
    write(
      app,
      'functions/api/assistant.ts',
      `
const CANNED_RESPONSES = ['Hello', 'I cannot help with that'];
export async function onRequestPost() {
  return Response.json({ reply: CANNED_RESPONSES[0] });
}
`
    );
    write(
      app,
      'src/components/AssistantSheet.tsx',
      `
export function AssistantSheet() {
  return (
    <form>
      <input aria-label="Ask the assistant" />
      <button type="submit">Send</button>
    </form>
  );
}
`
    );
    write(
      app,
      'src/lib/api.ts',
      `export async function ask() { return fetch('/api/assistant', { method: 'POST' }); }\n`
    );
    const r = runStandalone(app);
    expect(r.status, r.stderr + r.stdout).toBe(1);
    expect(r.stderr).toMatch(/stub|canned|never calls a model|model/i);
  });

  it('fails a model call that never grounds in app data', () => {
    const app = makeAppDir();
    withDomainData(app);
    write(
      app,
      'functions/api/assistant.ts',
      `
export async function onRequestPost(context: { env: { AI: { run: (m: string, i: unknown) => Promise<{ response: string }> } } }) {
  const result = await context.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [{ role: 'user', content: 'hi' }]
  });
  return Response.json({ reply: result.response });
}
`
    );
    write(
      app,
      'src/lib/api.ts',
      `export async function ask() { return fetch('/api/assistant', { method: 'POST' }); }\n`
    );
    const r = runStandalone(app);
    expect(r.status, r.stderr + r.stdout).toBe(1);
    expect(r.stderr).toMatch(/ground/i);
  });

  it('fails when the API exists but no shell chat affordance calls it', () => {
    const app = makeAppDir();
    withDomainData(app);
    write(
      app,
      'functions/api/assistant.ts',
      `
const SYSTEM_PROMPT = 'Answer only from the stored catalog filters.';
export async function onRequestPost(context: {
  request: Request;
  env: { AI: { run: (m: string, i: unknown) => Promise<{ response: string }> }; DB: { prepare: (s: string) => { all: () => Promise<{ results: unknown[] }> } } };
}) {
  const rows = await context.env.DB.prepare('SELECT name FROM crops LIMIT 20').all();
  const result = await context.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + JSON.stringify(rows.results) },
      { role: 'user', content: 'when to plant' }
    ]
  });
  return Response.json({ reply: result.response, query: {} });
}
`
    );
    write(app, 'src/pages/Home.tsx', `export function Home() { return <main>Home</main>; }\n`);
    const r = runStandalone(app);
    expect(r.status, r.stderr + r.stdout).toBe(1);
    expect(r.stderr).toMatch(/chat affordance|shell/i);
  });

  it('passes a QuickFlight-shaped Workers AI assistant grounded in domain filters', () => {
    const app = makeAppDir();
    withDomainData(app);
    write(
      app,
      'functions/api/assistant.ts',
      `
import { z } from 'zod';

const ASSISTANT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const SYSTEM_PROMPT = 'Convert the sentence into JSON filter fields for the catalog.';
const Body = z.object({ message: z.string().min(1) });

export async function onRequestPost(context: {
  request: Request;
  env: { AI: { run: (m: string, i: unknown) => Promise<{ response: string }> } };
}) {
  if (!context.env.AI) {
    return Response.json({ error: 'Assistant binding unavailable' }, { status: 503 });
  }
  const raw = await context.request.json();
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return Response.json({ error: 'Invalid message' }, { status: 400 });
  let rawText = '';
  try {
    const result = await context.env.AI.run(ASSISTANT_MODEL, {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: parsed.data.message }
      ]
    });
    rawText = result.response;
  } catch (cause) {
    return Response.json({ error: 'Assistant model failed: ' + String(cause) }, { status: 502 });
  }
  return Response.json({ query: {}, summary: 'Applied filters from catalog.' });
}
`
    );
    write(
      app,
      'src/components/AssistantSheet.tsx',
      `
export function AssistantSheet({ onSubmit }: { onSubmit: (m: string) => Promise<void> }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit('plant tomatoes');
      }}
    >
      <label htmlFor="assistant-input">Ask the assistant</label>
      <input id="assistant-input" aria-label="Ask the assistant" placeholder="Ask about crops" />
      <button type="submit">Send</button>
    </form>
  );
}
`
    );
    write(
      app,
      'src/lib/api.ts',
      `
export async function postAssistant(message: string) {
  return fetch('/api/assistant', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message })
  });
}
`
    );
    const r = runStandalone(app);
    expect(r.status, r.stderr + r.stdout).toBe(0);
  });

  it('returns n/a when the app has no queryable domain data', () => {
    const app = makeAppDir();
    write(app, 'src/pages/Home.tsx', `export function Home() { return <main>Static</main>; }\n`);
    const r = runStandalone(app);
    expect(r.status, r.stderr + r.stdout).toBe(3);
    expect(r.stderr).toMatch(/n\/a/i);
  });

  it('fails the same way through check.mjs (gate router)', () => {
    const app = makeAppDir();
    withDomainData(app);
    const r = runViaRouter(app);
    expect(r.status, r.stderr + r.stdout).toBe(1);
  });
});
