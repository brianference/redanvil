/**
 * fe-visible-response must see a scroll reset that lives in a shared module the
 * app imports, and must still fail when no reachable code resets scroll.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runVisibleResponse } from '../scripts/checks/fe-visible-response.mjs';

const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/**
 * Build a repo with `shared/Page.tsx` and an app whose App.tsx imports it.
 *
 * @param sharedPage - Source of the shared page module.
 * @param importShared - Whether the app imports the shared page.
 * @returns The app directory.
 */
function fixture(sharedPage: string, importShared: boolean): string {
  const root = mkdtempSync(join(tmpdir(), 'fe-visible-'));
  roots.push(root);
  mkdirSync(join(root, 'shared'));
  writeFileSync(join(root, 'shared', 'Page.tsx'), sharedPage);
  const app = join(root, 'app');
  mkdirSync(join(app, 'src'), { recursive: true });
  const importLine = importShared ? "import { Page } from '../../shared/Page';\n" : '';
  writeFileSync(
    join(app, 'src', 'App.tsx'),
    `import { BrowserRouter } from 'react-router-dom';\n${importLine}export const App = () => null;\n`
  );
  return app;
}

/**
 * Run the check and report its outcome instead of exiting.
 *
 * @param appDir - App to check.
 * @returns 'pass', 'fail' or 'n/a'.
 */
function outcome(appDir: string): string {
  const stop = (kind: string) => (): never => {
    throw new Error(kind);
  };
  try {
    runVisibleResponse(appDir, { pass: stop('pass'), fail: stop('fail'), notApplicable: stop('n/a') });
  } catch (err: unknown) {
    return (err as Error).message;
  }
  return 'none';
}

const RESETTING_PAGE =
  "import { useEffect } from 'react';\nexport function Page() { useEffect(() => { window.scrollTo({ top: 0 }); }, []); return null; }\n";
const PLAIN_PAGE = 'export function Page() { return null; }\n';

describe('fe-visible-response scroll reset', () => {
  it('passes when the reset lives in a shared page the app imports', () => {
    expect(outcome(fixture(RESETTING_PAGE, true))).toBe('pass');
  });

  it('fails when the imported shared page does not reset scroll', () => {
    expect(outcome(fixture(PLAIN_PAGE, true))).toBe('fail');
  });

  it('fails when a resetting shared page exists but the app never imports it', () => {
    expect(outcome(fixture(RESETTING_PAGE, false))).toBe('fail');
  });
});
