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

describe('check.mjs — fe-theme-tokens-only', () => {
  it('fails when a page component uses a raw hex color', () => {
    const app = makeAppDir();
    write(
      app,
      'src/pages/Home.tsx',
      `
import type { CSSProperties } from 'react';

/**
 * Demo page that hard-codes a brand color instead of a theme token.
 */
export function Home(): JSX.Element {
  const style: CSSProperties = {
    color: '#ff0000',
    padding: 8
  };
  return <div style={style}>Hello World Page Title Here</div>;
}
`
    );
    const r = runCheck('fe-theme-tokens-only', app);
    expect(r.status, r.stderr).not.toBe(0);
    expect(r.stderr).toMatch(/raw hex/i);
  });

  it('passes when components use theme tokens and hex lives only in theme.ts', () => {
    const app = makeAppDir();
    write(
      app,
      'src/theme.ts',
      `
/** Design tokens — raw hex is allowed only in this file. */
export const theme = {
  color: {
    accent: '#c41e3a',
    text: '#111111'
  }
} as const;
`
    );
    write(
      app,
      'src/pages/Home.tsx',
      `
import type { CSSProperties } from 'react';
import { theme } from '../theme';

/**
 * Demo page that reads colors from the theme module.
 */
export function Home(): JSX.Element {
  const style: CSSProperties = {
    color: theme.color.accent,
    padding: 8
  };
  return <div style={style}>{/* copy from i18n in real apps */}</div>;
}
`
    );
    const r = runCheck('fe-theme-tokens-only', app);
    expect(r.status, r.stderr).toBe(0);
  });
});

describe('check.mjs — hyg-no-binaries', () => {
  it('fails when a binary image is committed under src/', () => {
    const app = makeAppDir();
    // Minimal non-empty PNG-like bytes so the file is not an empty stub.
    write(app, 'src/lib/ok.ts', `export const version: string = '1';\n`);
    const full = join(app, 'src', 'assets', 'icon.png');
    mkdirSync(join(app, 'src', 'assets'), { recursive: true });
    writeFileSync(full, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const r = runCheck('hyg-no-binaries', app);
    expect(r.status, r.stderr).not.toBe(0);
    expect(r.stderr).toMatch(/binary under src/i);
  });

  it('passes when src has only source files', () => {
    const app = makeAppDir();
    write(
      app,
      'src/lib/util.ts',
      `
/**
 * Tiny helper used by the clean fixture.
 * @param n - Input number.
 * @returns Doubled value.
 */
export function double(n: number): number {
  return n * 2;
}
`
    );
    const r = runCheck('hyg-no-binaries', app);
    expect(r.status, r.stderr).toBe(0);
  });
});

describe('check.mjs — hyg-secret-scan', () => {
  it('fails when an AWS access key id appears in source', () => {
    const app = makeAppDir();
    write(
      app,
      'src/lib/config.ts',
      `
/** Broken config that embeds a live-looking AWS key. */
export const awsKey: string = 'AKIAIOSFODNN7EXAMPLE';
`
    );
    const r = runCheck('hyg-secret-scan', app);
    expect(r.status, r.stderr).not.toBe(0);
    expect(r.stderr).toMatch(/possible secret/i);
  });

  it('passes when no secret-shaped tokens appear', () => {
    const app = makeAppDir();
    write(
      app,
      'src/lib/config.ts',
      `
/**
 * Config that reads secrets from the environment only.
 */
export function getApiBase(): string {
  return process.env['API_BASE'] ?? 'https://example.com';
}
`
    );
    const r = runCheck('hyg-secret-scan', app);
    expect(r.status, r.stderr).toBe(0);
  });
});

describe('check.mjs — u-sec-sast', () => {
  it('fails when eval is used in app source', () => {
    const app = makeAppDir();
    write(
      app,
      'src/lib/run.ts',
      `
/**
 * Dangerous dynamic evaluation — SAST must reject this.
 * @param code - Untrusted code string.
 * @returns Evaluated result.
 */
export function runUserCode(code: string): unknown {
  return eval(code);
}
`
    );
    const r = runCheck('u-sec-sast', app);
    expect(r.status, r.stderr).not.toBe(0);
    expect(r.stderr).toMatch(/SAST sink/i);
  });

  it('passes when source has no dangerous sinks', () => {
    const app = makeAppDir();
    write(
      app,
      'src/lib/run.ts',
      `
/**
 * Safe string length helper.
 * @param code - Input text.
 * @returns Character count.
 */
export function measure(code: string): number {
  return code.length;
}
`
    );
    const r = runCheck('u-sec-sast', app);
    expect(r.status, r.stderr).toBe(0);
  });
});

describe('check.mjs — u-conc-no-padding', () => {
  it('fails when a source file has three or more consecutive blank lines', () => {
    const app = makeAppDir();
    write(
      app,
      'src/lib/padded.ts',
      `
/**
 * Intentionally padded export for the concision check.
 */
export function value(): number {
  return 1;
}



export function other(): number {
  return 2;
}
`
    );
    const r = runCheck('u-conc-no-padding', app);
    expect(r.status, r.stderr).not.toBe(0);
    expect(r.stderr).toMatch(/3\+ blank lines/i);
  });

  it('passes when blank-line runs stay under three', () => {
    const app = makeAppDir();
    write(
      app,
      'src/lib/compact.ts',
      `
/**
 * Compact module with at most one blank line between blocks.
 */
export function value(): number {
  return 1;
}

export function other(): number {
  return 2;
}
`
    );
    const r = runCheck('u-conc-no-padding', app);
    expect(r.status, r.stderr).toBe(0);
  });
});

describe('check.mjs — hyg-no-duplication', () => {
  it('fails when the same substantive 8-line block appears in two files', () => {
    const app = makeAppDir();
    // Eight non-comment, non-import lines >8 chars that are not style props and
    // not Pages Function boilerplate — the exact window the detector uses.
    const block = `
export function loadItems(flag: { ifActive: (fn: () => void) => boolean }, setState: (s: unknown) => void, errorMessage: string): void {
  flag.ifActive(() => {
    setState({ status: 'loading' as const });
  });
  const timeoutId = setTimeout(() => {
    flag.ifActive(() => {
      setState({ status: 'error' as const, message: errorMessage });
    });
  }, 10_000);
  void timeoutId;
}
`;
    write(app, 'src/pages/Alpha.tsx', `import type { ReactNode } from 'react';\n${block}\n`);
    write(app, 'src/pages/Beta.tsx', `import type { ReactNode } from 'react';\n${block}\n`);
    const r = runCheck('hyg-no-duplication', app);
    expect(r.status, r.stderr).not.toBe(0);
    expect(r.stderr).toMatch(/duplicated code/i);
  });

  it('passes when two pages share only style-token property runs', () => {
    const app = makeAppDir();
    write(
      app,
      'src/pages/Alpha.tsx',
      `
import type { CSSProperties } from 'react';

const cardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 56,
  padding: '10px 12px',
  background: 'var(--surface)',
  borderRadius: 8,
  boxSizing: 'border-box'
};

/** Alpha page shell. */
export function Alpha(): JSX.Element {
  return <div style={cardStyle}>Alpha unique body content here now</div>;
}
`
    );
    write(
      app,
      'src/pages/Beta.tsx',
      `
import type { CSSProperties } from 'react';

const cardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 56,
  padding: '10px 12px',
  background: 'var(--surface)',
  borderRadius: 8,
  boxSizing: 'border-box'
};

/** Beta page shell. */
export function Beta(): JSX.Element {
  return <section style={cardStyle}>Beta different body content here now</section>;
}
`
    );
    const r = runCheck('hyg-no-duplication', app);
    expect(r.status, r.stderr).toBe(0);
  });
});
