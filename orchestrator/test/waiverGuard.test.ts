import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { assertWaiversAreReal } from '../src/gate/waivers';

const dirs: string[] = [];

/** Create a tracked temp app dir. @returns Absolute path. */
function appDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'redanvil-waiver-'));
  dirs.push(d);
  return d;
}

/**
 * Write a file under dir, creating parents.
 * @param dir App root.
 * @param rel Relative path.
 * @param body Contents.
 */
function write(dir: string, rel: string, body: string): void {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, 'utf8');
}

afterEach(() => {
  while (dirs.length > 0) {
    const d = dirs.pop();
    if (d === undefined) break;
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
});

describe('every waiver is checked against reality, not just the ci lane', () => {
  it('rejects --na ci when the app ships workflows', () => {
    const d = appDir();
    write(d, '.github/workflows/ci.yml', 'name: CI\n');
    expect(() => assertWaiversAreReal(d, ['ci'])).toThrow(/ci lane applies/i);
  });

  it('allows --na ci when the app ships no workflows', () => {
    expect(() => assertWaiversAreReal(appDir(), ['ci'])).not.toThrow();
  });

  it('rejects waiving u-plat-migrations when a D1 binding really exists', () => {
    // This was waivable with no check at all. A D1 binding is exactly when the
    // rule applies, so waiving it there hides an unreproducible schema.
    const d = appDir();
    write(d, 'wrangler.toml', 'name = "x"\n[[d1_databases]]\nbinding = "DB"\n');
    expect(() => assertWaiversAreReal(d, ['u-plat-migrations'])).toThrow(/D1 binding/i);
  });

  it('allows waiving u-plat-migrations when there is no D1 binding', () => {
    const d = appDir();
    write(d, 'wrangler.toml', 'name = "x"\n');
    expect(() => assertWaiversAreReal(d, ['u-plat-migrations'])).not.toThrow();
  });

  it('rejects waiving u-sec-timeouts when a function really calls fetch', () => {
    const d = appDir();
    write(
      d,
      'functions/api/x.ts',
      'export async function onRequest(){ return fetch("https://a"); }\n'
    );
    expect(() => assertWaiversAreReal(d, ['u-sec-timeouts'])).toThrow(/outbound fetch/i);
  });

  it('rejects waiving u-val-input-validation when a handler really reads a body', () => {
    const d = appDir();
    write(
      d,
      'functions/api/x.ts',
      'export async function onRequest(c){ const b = await c.request.json(); return new Response(b); }\n'
    );
    expect(() => assertWaiversAreReal(d, ['u-val-input-validation'])).toThrow(/request body/i);
  });

  it('rejects waiving u-plat-runtime-parity when the app has a wrangler.toml', () => {
    const d = appDir();
    write(d, 'wrangler.toml', 'name = "x"\n');
    expect(() => assertWaiversAreReal(d, ['u-plat-runtime-parity'])).toThrow(/wrangler\.toml/i);
  });

  it('reports every bad waiver at once, not just the first', () => {
    const d = appDir();
    write(d, '.github/workflows/ci.yml', 'name: CI\n');
    write(d, 'wrangler.toml', 'name = "x"\n[[d1_databases]]\nbinding = "DB"\n');
    let message = '';
    try {
      assertWaiversAreReal(d, ['ci', 'u-plat-migrations']);
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/ci lane applies/i);
    expect(message).toMatch(/D1 binding/i);
  });

  it('says nothing about a waiver it has no way to check', () => {
    // `process` cannot be decided from the app directory, so it stays waivable.
    // Silence here is deliberate: inventing a rule for it would be worse.
    expect(() => assertWaiversAreReal(appDir(), ['process'])).not.toThrow();
  });
});

describe('lane waivers are checked too, not just individual rules', () => {
  it('refuses --na frontend on an app that ships components', () => {
    // The widest lever in the whole gate: this one flag removes 22 rules,
    // including every visual blocker, and nothing used to look.
    const d = appDir();
    write(d, 'src/components/Page.tsx', 'export const Page = () => null;\n');
    expect(() => assertWaiversAreReal(d, ['frontend'])).toThrow(/frontend lane applies/i);
  });

  it('refuses --na security, typing, concision, hygiene and testing on an app with source', () => {
    const d = appDir();
    write(d, 'src/main.ts', 'export const a = 1;\n');
    for (const lane of ['security', 'typing', 'concision', 'hygiene', 'testing']) {
      expect(() => assertWaiversAreReal(d, [lane]), lane).toThrow(
        new RegExp(`${lane} lane applies`, 'i')
      );
    }
  });

  it('still allows a lane waiver when the subject genuinely is absent', () => {
    // An empty directory ships nothing, so nothing in those lanes applies.
    expect(() => assertWaiversAreReal(appDir(), ['frontend', 'typing', 'testing'])).not.toThrow();
  });

  it('keeps allowing --na process, which the app directory cannot decide', () => {
    const d = appDir();
    write(d, 'src/main.ts', 'export const a = 1;\n');
    expect(() => assertWaiversAreReal(d, ['process'])).not.toThrow();
  });
});
