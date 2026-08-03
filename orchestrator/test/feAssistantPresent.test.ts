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
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { loadRubric } from '../src/rubric/index';
import { APP_CHECKS } from '../src/commands/gate';
import {
  extractFieldList,
  readDeployUrl,
  readGroundingFixture,
  verifyLiveGrounding,
  runAssistantPresent
} from '../scripts/checks/fe-assistant-present.mjs';

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
  env: { AI: { run: (m: string, i: unknown) => Promise<{ response: string }> }; DB: { prepare: (s: string) => { all: () => Promise<{ results: unknown[] }> } } };
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
  const rows = await context.env.DB.prepare('SELECT name FROM crops WHERE name LIKE ?').all();
  return Response.json({ query: {}, summary: 'Applied filters from catalog.', crops: rows.results });
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

  it('regression: FAILS the exact fixture that used to pass on bare "filters"/"summary:" words with no DB access', () => {
    // Independent review finding (evidence/independent-review-az-planting-calendar.json):
    // this endpoint calls a model and returns `{ query: {}, summary: '...' }`
    // but never touches env.DB or any prepared SQL statement at all — it is not
    // grounded in anything. Before the fix this passed on the bare words
    // "query:" and "summary:" alone. It must fail now.
    const app = makeAppDir();
    withDomainData(app);
    write(
      app,
      'functions/api/assistant.ts',
      `
const ASSISTANT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const SYSTEM_PROMPT = 'Convert the sentence into JSON filter fields for the catalog.';

export async function onRequestPost(context: {
  request: Request;
  env: { AI: { run: (m: string, i: unknown) => Promise<{ response: string }> } };
}) {
  const filters = {};
  const result = await context.env.AI.run(ASSISTANT_MODEL, {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: 'hi' }
    ]
  });
  return Response.json({ query: filters, summary: 'Applied filters from catalog.' });
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
    expect(r.stderr).toMatch(/does not ground/i);
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

describe('extractFieldList', () => {
  it('pulls one array hop plus a dotted field path', () => {
    const body = { crops: [{ name: 'Tomatoes' }, { name: 'Carrots' }] };
    expect(extractFieldList(body, 'crops[].name')).toEqual(['Tomatoes', 'Carrots']);
  });

  it('walks a nested field under the array (items[].crop.name)', () => {
    const body = { items: [{ crop: { name: 'Beans, Snap' } }, { crop: { name: 'Pumpkin' } }] };
    expect(extractFieldList(body, 'items[].crop.name')).toEqual(['Beans, Snap', 'Pumpkin']);
  });

  it('returns [] when the array path does not resolve', () => {
    expect(extractFieldList({ other: [] }, 'crops[].name')).toEqual([]);
    expect(extractFieldList(null, 'crops[].name')).toEqual([]);
    expect(extractFieldList({ crops: 'not-an-array' }, 'crops[].name')).toEqual([]);
  });

  it('drops entries where the field is missing or non-string', () => {
    const body = { crops: [{ name: 'Tomatoes' }, { name: 42 }, {}] };
    expect(extractFieldList(body, 'crops[].name')).toEqual(['Tomatoes']);
  });
});

/**
 * Read the deploy URL / grounding fixture helpers from disk (unit-level).
 */
describe('readDeployUrl / readGroundingFixture', () => {
  it('returns null when claims.json or the fixture is absent', () => {
    const app = makeAppDir();
    expect(readDeployUrl(app)).toBeNull();
    expect(readGroundingFixture(app)).toBeNull();
  });

  it('reads a recorded deploy URL and a well-formed fixture', () => {
    const app = makeAppDir();
    write(app, '.redanvil/claims.json', JSON.stringify({ deployUrl: 'https://example.pages.dev/' }));
    write(
      app,
      'tests/assistant-grounding.json',
      JSON.stringify({
        message: 'What can I plant during early August?',
        crossCheckPath: '/api/plantable?date=2026-08-01',
        assistantField: 'crops[].name',
        crossCheckField: 'items[].crop.name'
      })
    );
    expect(readDeployUrl(app)).toBe('https://example.pages.dev');
    expect(readGroundingFixture(app)?.message).toBe('What can I plant during early August?');
  });
});

/**
 * verifyLiveGrounding against a REAL local HTTP server (node:http), the same
 * pattern lg-bindings-bound's own tests use. This is the proof the
 * independent review asked for: a fixture that used to be indistinguishable
 * from a genuinely grounded answer now has to actually cross-check against a
 * second live endpoint, and every known-bad shape below must fail loudly
 * rather than pass or silently skip.
 */
describe('verifyLiveGrounding (live fixture server)', () => {
  /** Start a fixture server for one test; caller closes it. */
  async function startServer(
    handler: (path: string, method: string, body: string) => { status: number; body: string }
  ) {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const bodyText = Buffer.concat(chunks).toString('utf8');
        const result = handler(req.url ?? '', req.method ?? 'GET', bodyText);
        res.writeHead(result.status, { 'content-type': 'application/json' });
        res.end(result.body);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address() as AddressInfo;
    return { server, base: `http://127.0.0.1:${addr.port}` };
  }

  const fixture = {
    message: 'What can I plant during early August?',
    crossCheckPath: '/api/plantable?date=2026-08-01',
    assistantField: 'crops[].name',
    crossCheckField: 'items[].crop.name'
  };

  it('known-bad: FAILS loudly on a 503 (missing AI binding), never an infra-skip', async () => {
    const { server, base } = await startServer((path) => {
      if (path.includes('/api/assistant')) {
        return { status: 503, body: JSON.stringify({ error: 'Assistant binding unavailable (AI missing)' }) };
      }
      return { status: 404, body: '{}' };
    });
    try {
      const r = await verifyLiveGrounding(base, fixture);
      expect(r.ok).toBe(false);
      expect(r.infra).not.toBe(true);
      expect(r.why).toMatch(/503/);
      console.log('verifyLiveGrounding known-bad (503):', r.why);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('known-bad: FAILS when the assistant invents a crop absent from the cross-check data', async () => {
    const { server, base } = await startServer((path) => {
      if (path.includes('/api/assistant')) {
        return {
          status: 200,
          body: JSON.stringify({
            answer: 'ok',
            crops: [{ id: 'crop-tomatoes', name: 'Tomatoes' }, { id: 'crop-dragonfruit', name: 'Dragonfruit' }],
            filters: { half_month: 14 }
          })
        };
      }
      if (path.includes('/api/plantable')) {
        return {
          status: 200,
          body: JSON.stringify({ items: [{ crop: { id: 'crop-tomatoes', name: 'Tomatoes' } }] })
        };
      }
      return { status: 404, body: '{}' };
    });
    try {
      const r = await verifyLiveGrounding(base, fixture);
      expect(r.ok).toBe(false);
      expect(r.why).toMatch(/dragonfruit/i);
      console.log('verifyLiveGrounding known-bad (invented crop):', r.why);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('known-bad: FAILS when the assistant omits a crop the real data has', async () => {
    const { server, base } = await startServer((path) => {
      if (path.includes('/api/assistant')) {
        return {
          status: 200,
          body: JSON.stringify({ answer: 'ok', crops: [{ id: 'crop-tomatoes', name: 'Tomatoes' }], filters: {} })
        };
      }
      if (path.includes('/api/plantable')) {
        return {
          status: 200,
          body: JSON.stringify({
            items: [
              { crop: { id: 'crop-tomatoes', name: 'Tomatoes' } },
              { crop: { id: 'crop-carrots', name: 'Carrots' } }
            ]
          })
        };
      }
      return { status: 404, body: '{}' };
    });
    try {
      const r = await verifyLiveGrounding(base, fixture);
      expect(r.ok).toBe(false);
      expect(r.why).toMatch(/carrots/i);
      console.log('verifyLiveGrounding known-bad (omitted crop):', r.why);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('known-bad: FAILS when the cross-check route itself has nothing to compare against', async () => {
    const { server, base } = await startServer((path) => {
      if (path.includes('/api/assistant')) {
        return {
          status: 200,
          body: JSON.stringify({ answer: 'ok', crops: [{ id: 'crop-tomatoes', name: 'Tomatoes' }], filters: {} })
        };
      }
      if (path.includes('/api/plantable')) {
        return { status: 200, body: JSON.stringify({ items: [] }) };
      }
      return { status: 404, body: '{}' };
    });
    try {
      const r = await verifyLiveGrounding(base, fixture);
      expect(r.ok).toBe(false);
      expect(r.why).toMatch(/no values/i);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('reports infra (not fail) when the deploy cannot be reached at all', async () => {
    // Port 9 is a "discard" service port that refuses TCP connections on every
    // major OS, so this fails fast without depending on a real network outage.
    const r = await verifyLiveGrounding('http://127.0.0.1:9', fixture);
    expect(r.ok).toBe(false);
    expect(r.infra).toBe(true);
  });

  it('known-good: PASSES when the assistant crop set exactly matches the cross-check', async () => {
    const { server, base } = await startServer((path) => {
      if (path.includes('/api/assistant')) {
        return {
          status: 200,
          body: JSON.stringify({
            answer: '2 crops can go in.',
            crops: [
              { id: 'crop-tomatoes', name: 'Tomatoes', methods: ['T'] },
              { id: 'crop-carrots', name: 'Carrots', methods: ['S'] }
            ],
            filters: { half_month: 14 }
          })
        };
      }
      if (path.includes('/api/plantable')) {
        return {
          status: 200,
          body: JSON.stringify({
            items: [
              { crop: { id: 'crop-carrots', name: 'Carrots' } },
              { crop: { id: 'crop-tomatoes', name: 'Tomatoes' } }
            ]
          })
        };
      }
      return { status: 404, body: '{}' };
    });
    try {
      const r = await verifyLiveGrounding(base, fixture);
      expect(r.ok, r.why).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

/**
 * Full runAssistantPresent() integration: a well-grounded local app whose
 * deploy URL points at a live fixture server. Proves the live half is
 * actually WIRED IN (fixture + deploy URL => io.fail/io.pass driven by
 * verifyLiveGrounding), not just callable in isolation.
 */
describe('runAssistantPresent live-grounding wiring', () => {
  function captureIo(): {
    io: {
      pass: () => never;
      fail: (m?: string) => never;
      notApplicable: (w?: string) => never;
      infra: (m?: string) => never;
    };
    result: { code: number; msg: string };
  } {
    const result = { code: -1, msg: '' };
    const io = {
      pass: (): never => {
        result.code = 0;
        throw { __done: true };
      },
      fail: (m?: string): never => {
        result.code = 1;
        result.msg = m ?? '';
        throw { __done: true };
      },
      notApplicable: (w?: string): never => {
        result.code = 3;
        result.msg = w ?? '';
        throw { __done: true };
      },
      infra: (m?: string): never => {
        result.code = 2;
        result.msg = m ?? '';
        throw { __done: true };
      }
    };
    return { io: io as never, result };
  }

  async function runCaptured(
    fn: (io: ReturnType<typeof captureIo>['io']) => void | Promise<void>
  ): Promise<{ code: number; msg: string }> {
    const { io, result } = captureIo();
    try {
      await fn(io);
    } catch (e) {
      if (!(e && typeof e === 'object' && '__done' in e)) throw e;
    }
    return result;
  }

  function groundedAssistantApp(deployUrl: string) {
    const app = makeAppDir();
    withDomainData(app);
    write(
      app,
      'functions/api/assistant.ts',
      `
export async function onRequestPost(context: {
  request: Request;
  env: { AI: { run: (m: string, i: unknown) => Promise<{ response: string }> }; DB: { prepare: (s: string) => { all: () => Promise<{ results: unknown[] }> } } };
}) {
  if (!context.env.AI) return Response.json({ error: 'Assistant binding unavailable' }, { status: 503 });
  const result = await context.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [{ role: 'user', content: 'hi' }]
  });
  const rows = await context.env.DB.prepare('SELECT name FROM crops').all();
  return Response.json({ answer: result.response, crops: rows.results, filters: { half_month: 14 } });
}
`
    );
    write(
      app,
      'src/lib/api.ts',
      `export async function ask() { return fetch('/api/assistant', { method: 'POST' }); }\n`
    );
    write(app, '.redanvil/claims.json', JSON.stringify({ deployUrl }));
    write(
      app,
      'tests/assistant-grounding.json',
      JSON.stringify({
        message: 'What can I plant during early August?',
        crossCheckPath: '/api/plantable?date=2026-08-01',
        assistantField: 'crops[].name',
        crossCheckField: 'items[].crop.name'
      })
    );
    return app;
  }

  it('FAILS the whole check when the deployed backend is not grounded (503)', async () => {
    const server = createServer((req, res) => {
      if ((req.url ?? '').includes('/api/assistant')) {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Assistant binding unavailable (AI missing)' }));
        return;
      }
      res.writeHead(404).end('{}');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${addr.port}`;
    const app = groundedAssistantApp(base);
    try {
      const r = await runCaptured((io) => runAssistantPresent(app, io));
      expect(r.code).toBe(1);
      expect(r.msg).toMatch(/live grounding proof failed/i);
      expect(r.msg).toMatch(/503/);
      console.log('runAssistantPresent live known-bad:', r.msg.slice(0, 300));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('PASSES the whole check when the deployed backend genuinely matches the cross-check', async () => {
    const server = createServer((req, res) => {
      const url = req.url ?? '';
      if (url.includes('/api/assistant')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            answer: 'ok',
            crops: [{ id: 'crop-tomatoes', name: 'Tomatoes' }],
            filters: { half_month: 14 }
          })
        );
        return;
      }
      if (url.includes('/api/plantable')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ items: [{ crop: { id: 'crop-tomatoes', name: 'Tomatoes' } }] }));
        return;
      }
      res.writeHead(404).end('{}');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${addr.port}`;
    const app = groundedAssistantApp(base);
    try {
      const r = await runCaptured((io) => runAssistantPresent(app, io));
      expect(r.code, r.msg).toBe(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
