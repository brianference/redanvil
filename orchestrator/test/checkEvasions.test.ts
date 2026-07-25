/**
 * Regression tests for evasions found by auditing check.mjs against the rule
 * text it claims to enforce. Each case passed the check while violating the rule.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const CHECK_SCRIPT = fileURLToPath(new URL('../scripts/checks/check.mjs', import.meta.url));
const node = process.execPath;
const tempDirs: string[] = [];

/** Create a tracked temp app dir. @returns Absolute path. */
function makeAppDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'redanvil-evade-'));
  tempDirs.push(dir);
  return dir;
}

/**
 * Write a file under appDir, creating parents.
 * @param appDir App root.
 * @param relPath Repo-relative path.
 * @param body Contents.
 */
function write(appDir: string, relPath: string, body: string): void {
  const full = join(appDir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, 'utf8');
}

/**
 * Run one rule check.
 * @param ruleId Rule to check.
 * @param appDir Target app.
 * @returns Process result.
 */
function runCheck(ruleId: string, appDir: string): { status: number | null; stderr: string } {
  const r = spawnSync(node, [CHECK_SCRIPT, ruleId, appDir], { encoding: 'utf8', env: process.env });
  return { status: r.status, stderr: r.stderr };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir === undefined) break;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
});

describe('fe-no-unsanitized-html scans every occurrence', () => {
  it('fails when a LATER file uses dangerouslySetInnerHTML without a sanitizer', () => {
    // The check took only the FIRST match across the whole app and then asked
    // whether THAT file imported a sanitizer. A sanitized early file therefore
    // made every later unsanitized use invisible.
    const app = makeAppDir();
    write(
      app,
      'src/components/AaaSafe.tsx',
      `import DOMPurify from 'dompurify';\n` +
        `export function Safe(): JSX.Element {\n` +
        `  return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(input) }} />;\n}\n`
    );
    write(
      app,
      'src/components/ZzzUnsafe.tsx',
      `export function Unsafe(): JSX.Element {\n` +
        `  return <div dangerouslySetInnerHTML={{ __html: untrusted }} />;\n}\n`
    );
    const r = runCheck('fe-no-unsanitized-html', app);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/ZzzUnsafe/);
  });

  it('passes when every occurrence is sanitized in its own file', () => {
    const app = makeAppDir();
    write(
      app,
      'src/components/One.tsx',
      `import DOMPurify from 'dompurify';\n` +
        `export const One = () => <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(a) }} />;\n`
    );
    write(
      app,
      'src/components/Two.tsx',
      `import DOMPurify from 'dompurify';\n` +
        `export const Two = () => <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(b) }} />;\n`
    );
    expect(runCheck('fe-no-unsanitized-html', app).status).toBe(0);
  });
});

describe('hyg-secret-scan covers config and data files, not only src', () => {
  it('fails on a private key in wrangler.toml', () => {
    // The scan walked only src/ and functions/ for .ts/.tsx/.js, so a key in a
    // config file, a JSON fixture, or a workflow was never looked at.
    const app = makeAppDir();
    write(app, 'src/main.tsx', 'export const ok = 1;\n');
    write(
      app,
      'wrangler.toml',
      'name = "x"\nkey = "-----BEGIN RSA PRIVATE KEY-----abc-----END RSA PRIVATE KEY-----"\n'
    );
    const r = runCheck('hyg-secret-scan', app);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/wrangler\.toml/);
  });

  it('fails on a GitHub token in a JSON config', () => {
    const app = makeAppDir();
    write(app, 'src/main.tsx', 'export const ok = 1;\n');
    write(app, 'config/settings.json', `{ "token": "ghp_${'a'.repeat(36)}" }\n`);
    expect(runCheck('hyg-secret-scan', app).status).toBe(1);
  });

  it('fails on a Google API key in source', () => {
    const app = makeAppDir();
    write(app, 'src/maps.ts', `export const key = 'AIza${'B'.repeat(35)}';\n`);
    expect(runCheck('hyg-secret-scan', app).status).toBe(1);
  });

  it('passes a clean app', () => {
    const app = makeAppDir();
    write(app, 'src/main.tsx', 'export const ok = 1;\n');
    write(app, 'wrangler.toml', 'name = "x"\ncompatibility_date = "2026-07-01"\n');
    expect(runCheck('hyg-secret-scan', app).status).toBe(0);
  });
});

describe('fe-theme-tokens-only covers all rendered source', () => {
  it('fails on a raw hex in a stylesheet', () => {
    // The rule says theme tokens only. The check looked at .ts/.tsx under
    // components/ and pages/ exclusively, so a hardcoded colour in a CSS file or
    // in src/App.tsx was never examined.
    const app = makeAppDir();
    write(app, 'src/app.css', '.hero { background: #ff0044; }\n');
    const r = runCheck('fe-theme-tokens-only', app);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/app\.css/);
  });

  it('fails on a raw hex outside components and pages', () => {
    const app = makeAppDir();
    write(app, 'src/App.tsx', `export const App = () => <div style={{ color: '#123456' }} />;\n`);
    expect(runCheck('fe-theme-tokens-only', app).status).toBe(1);
  });

  it('still exempts theme and token definition files', () => {
    const app = makeAppDir();
    write(app, 'src/theme.ts', `export const tokens = { bg: '#0b0b0f', fg: '#ffffff' };\n`);
    write(app, 'src/theme.css', ':root { --bg: #0b0b0f; }\n');
    expect(runCheck('fe-theme-tokens-only', app).status).toBe(0);
  });
});
