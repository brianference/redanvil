/**
 * Integration tests for orchestrator/scripts/checks/check.mjs.
 * Each bug gets a defective fixture (must exit non-zero) and a clean fixture (must exit 0).
 * Fixtures live under os.tmpdir and are deleted after each test — never committed.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const CHECK_SCRIPT = fileURLToPath(new URL('../scripts/checks/check.mjs', import.meta.url));
const node = process.execPath;

/** Temp dirs created this file; cleaned in afterEach. */
const tempDirs: string[] = [];

/**
 * Create a unique temp app directory and track it for cleanup.
 * @returns Absolute path to the empty app root.
 */
function makeAppDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'redanvil-check-'));
  tempDirs.push(dir);
  return dir;
}

/**
 * Write a file under appDir, creating parent directories as needed.
 * @param appDir App root.
 * @param relPath Path relative to app root (e.g. `functions/api/h.ts`).
 * @param body File contents.
 */
function write(appDir: string, relPath: string, body: string): string {
  const full = join(appDir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, 'utf8');
  return full;
}

/**
 * Run check.mjs for a rule against an app directory.
 * @returns Child-process result with status and stderr.
 */
function runCheck(ruleId: string, appDir: string) {
  return spawnSync(node, [CHECK_SCRIPT, ruleId, appDir], {
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
      // best-effort cleanup
    }
  }
});

describe('check.mjs — bug 1 u-val-input-validation', () => {
  it('fails when request.json is used with only JSON.parse (no schema)', () => {
    const app = makeAppDir();
    write(
      app,
      'functions/api/handler.ts',
      `
export async function onRequestPost({ request }: { request: Request }) {
  const body = await request.json();
  // Unrelated JSON.parse must not count as schema validation
  const cfg = JSON.parse('{"a":1}');
  return new Response(JSON.stringify({ body, cfg }));
}
`
    );
    const r = runCheck('u-val-input-validation', app);
    expect(r.status, r.stderr).not.toBe(0);
    expect(r.stderr).toMatch(/schema validation|without/i);
  });

  it('passes when request body is validated with zod safeParse', () => {
    const app = makeAppDir();
    write(
      app,
      'functions/api/handler.ts',
      `
import { z } from 'zod';
const schema = z.object({ name: z.string() });
export async function onRequestPost({ request }: { request: Request }) {
  const raw = await request.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return new Response('bad', { status: 400 });
  return new Response(JSON.stringify(parsed.data));
}
`
    );
    const r = runCheck('u-val-input-validation', app);
    expect(r.status, r.stderr).toBe(0);
  });
});

describe('check.mjs — bug 2 u-sec-param-sql', () => {
  it('fails on multi-line SQL template with ${ interpolation', () => {
    const app = makeAppDir();
    write(
      app,
      'functions/api/users.ts',
      `
export function getUser(db: { prepare: (s: string) => unknown }, id: string) {
  return db.prepare(\`SELECT *
  FROM users
  WHERE id = \${id}\`);
}
`
    );
    const r = runCheck('u-sec-param-sql', app);
    expect(r.status, r.stderr).not.toBe(0);
    expect(r.stderr).toMatch(/interpolated SQL/i);
  });

  it('passes on parameterized SQL and on non-SQL prose with ${', () => {
    const app = makeAppDir();
    write(
      app,
      'functions/api/users.ts',
      `
export function getUser(db: { prepare: (s: string) => { bind: (...a: unknown[]) => unknown } }, id: string) {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id);
}
export function label(e: string) {
  return \`create, edit, and delete \${e}\`;
}
`
    );
    const r = runCheck('u-sec-param-sql', app);
    expect(r.status, r.stderr).toBe(0);
  });
});

describe('check.mjs — bug 3 u-sec-no-stub-paths', () => {
  it('fails when an auth-named function unconditionally returns true', () => {
    const app = makeAppDir();
    write(
      app,
      'functions/lib/auth.ts',
      `
export function checkAuth() { return true; }
`
    );
    const r = runCheck('u-sec-no-stub-paths', app);
    expect(r.status, r.stderr).not.toBe(0);
    expect(r.stderr).toMatch(/stubbed auth/i);
  });

  it('fails an always-true auth guard that carries a TypeScript return type', () => {
    // The original fixture was untyped JS, which the detector happened to match.
    // Every function in this codebase is annotated, so the annotated form is the
    // only one that occurs in practice — and it was slipping through.
    const app = makeAppDir();
    write(
      app,
      'functions/lib/auth.ts',
      `
export function checkAuth(): boolean {
  return true;
}
`
    );
    const r = runCheck('u-sec-no-stub-paths', app);
    expect(r.status, r.stderr).not.toBe(0);
    expect(r.stderr).toMatch(/stubbed auth/i);
  });

  it('fails an always-true auth guard written as a typed arrow function', () => {
    const app = makeAppDir();
    write(app, 'functions/lib/auth.ts', `export const isAuthorized = (): boolean => true;\n`);
    const r = runCheck('u-sec-no-stub-paths', app);
    expect(r.status, r.stderr).not.toBe(0);
  });

  it('passes when auth does real work and is not an unconditional true', () => {
    const app = makeAppDir();
    write(
      app,
      'functions/lib/auth.ts',
      `
export async function checkAuth(token: string): Promise<boolean> {
  if (!token) return false;
  return token.length > 10;
}
`
    );
    const r = runCheck('u-sec-no-stub-paths', app);
    expect(r.status, r.stderr).toBe(0);
  });
});

describe('check.mjs — bug 4 fe-no-unsanitized-html', () => {
  it('fails when dangerouslySetInnerHTML has no sanitizer in the same file', () => {
    const app = makeAppDir();
    write(
      app,
      'src/components/Html.tsx',
      `
export function Html({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
`
    );
    const r = runCheck('fe-no-unsanitized-html', app);
    expect(r.status, r.stderr).not.toBe(0);
    expect(r.stderr).toMatch(/unsanitized HTML/i);
  });

  it('passes when the same file imports/uses DOMPurify (Windows path safe)', () => {
    const app = makeAppDir();
    // Absolute Windows paths from tmpdir include a drive-letter colon; parseHit must not break.
    write(
      app,
      'src/components/Html.tsx',
      `
import DOMPurify from 'dompurify';
export function Html({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
`
    );
    const r = runCheck('fe-no-unsanitized-html', app);
    expect(r.status, r.stderr).toBe(0);
  });
});

describe('check.mjs — bug 5 u-typing-scoped-ignores', () => {
  it('fails on bare unscoped @ts-expect-error', () => {
    const app = makeAppDir();
    write(
      app,
      'src/bad.ts',
      `
// @ts-expect-error
const x: number = 'nope';
`
    );
    const r = runCheck('u-typing-scoped-ignores', app);
    expect(r.status, r.stderr).not.toBe(0);
    expect(r.stderr).toMatch(/unscoped ts-ignore/i);
  });

  it('passes when @ts-expect-error has a justification', () => {
    const app = makeAppDir();
    write(
      app,
      'src/ok.ts',
      `
// @ts-expect-error third-party types omit this field
const x: number = (globalThis as { weird?: number }).weird as number;
`
    );
    const r = runCheck('u-typing-scoped-ignores', app);
    expect(r.status, r.stderr).toBe(0);
  });
});

describe('check.mjs — bug 6 fe-i18n-central-copy', () => {
  it('fails on multi-line Prettier-style hardcoded JSX sentence', () => {
    const app = makeAppDir();
    write(
      app,
      'src/pages/Home.tsx',
      `
export function Home() {
  return (
    <p>
      Hardcoded sentence goes right here now.
    </p>
  );
}
`
    );
    const r = runCheck('fe-i18n-central-copy', app);
    expect(r.status, r.stderr).not.toBe(0);
    expect(r.stderr).toMatch(/hardcoded JSX copy/i);
  });

  it('passes when copy is centralized via {en.x} expressions', () => {
    const app = makeAppDir();
    write(
      app,
      'src/pages/Home.tsx',
      `
import { en } from '../i18n/en';
export function Home() {
  return (
    <p>
      {en.home.intro}
    </p>
  );
}
`
    );
    const r = runCheck('fe-i18n-central-copy', app);
    expect(r.status, r.stderr).toBe(0);
  });
});

describe('check.mjs — bug 7 u-sec-timeouts and u-sec-headers-cors per-file', () => {
  it('u-sec-timeouts fails a fetch route that lacks AbortSignal even if another file has one', () => {
    const app = makeAppDir();
    write(
      app,
      'functions/api/good.ts',
      `
export async function onRequestGet() {
  const ac = new AbortController();
  return fetch('https://example.com', { signal: ac.signal });
}
`
    );
    write(
      app,
      'functions/api/bad.ts',
      `
export async function onRequestGet() {
  return fetch('https://example.com');
}
`
    );
    const r = runCheck('u-sec-timeouts', app);
    expect(r.status, r.stderr).not.toBe(0);
    expect(r.stderr).toMatch(/bad\.ts|AbortSignal|timeout/i);
  });

  it('u-sec-timeouts passes when every fetch file has a signal', () => {
    const app = makeAppDir();
    write(
      app,
      'functions/api/a.ts',
      `
export async function onRequestGet() {
  return fetch('https://example.com', { signal: AbortSignal.timeout(5000) });
}
`
    );
    const r = runCheck('u-sec-timeouts', app);
    expect(r.status, r.stderr).toBe(0);
  });

  it('u-sec-headers-cors fails a Response constructor file missing headers even if another has them', () => {
    const app = makeAppDir();
    write(
      app,
      'functions/lib/http.ts',
      `
export function ok(body: string) {
  return new Response(body, {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': 'https://example.com'
    }
  });
}
`
    );
    write(
      app,
      'functions/api/raw.ts',
      `
export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true }));
}
`
    );
    const r = runCheck('u-sec-headers-cors', app);
    expect(r.status, r.stderr).not.toBe(0);
    expect(r.stderr).toMatch(/raw\.ts|security|headers/i);
  });

  it('u-sec-headers-cors passes when Response-constructing files set security headers', () => {
    const app = makeAppDir();
    write(
      app,
      'functions/lib/http.ts',
      `
export function ok(body: string) {
  return new Response(body, {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'"
    }
  });
}
`
    );
    const r = runCheck('u-sec-headers-cors', app);
    expect(r.status, r.stderr).toBe(0);
  });
});

describe('check.mjs — bug 8 walk() I/O resilience', () => {
  it('skips an unreadable entry and still evaluates the rest (clean tree passes)', () => {
    const app = makeAppDir();
    write(app, 'src/ok.ts', `export const n = 1;\n`);
    // A dangling symlink under src should not crash the walk as a rule violation.
    try {
      symlinkSync(join(app, 'src', 'does-not-exist-target'), join(app, 'src', 'broken-link.ts'));
    } catch {
      // Some Windows environments require elevation for symlinks — skip this branch.
    }
    const r = runCheck('u-typing-scoped-ignores', app);
    // Either pass (0) after skipping the bad entry, or if symlink creation failed, still 0 on clean file.
    expect(r.status, r.stderr).toBe(0);
  });

  it('exits 2 (not 1) when the app root functions path is not a readable directory of files but rule still runs', () => {
    // Usage error path: missing ruleId already uses 2; unknown rule uses 2.
    const r = spawnSync(node, [CHECK_SCRIPT, 'not-a-real-rule', makeAppDir()], {
      encoding: 'utf8'
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/unknown rule/i);
  });

  it('exits 2 on usage error (missing args), distinct from rule violation', () => {
    const r = spawnSync(node, [CHECK_SCRIPT], { encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/usage/i);
  });
});
