/**
 * A fresh scaffold must already satisfy the blockers that kept failing on
 * apps built from the previous skeleton: breadcrumbs, test runners, binaries,
 * duplication, inline width, and resource links (n/a when there is no item page).
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaffoldApp } from '../src/scaffold/scaffoldApp';
import { sessionCookieName } from '../src/scaffold/applyAuthKit';
import type { Job } from '../src/schemas/job';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const corpusDir = join(repoRoot, 'rules');
const builtAt = '2026-09-23T00:00:00.000Z';

const dirs: string[] = [];

/**
 * Valid job. `hasAuth` is the string the schema stores, not a boolean.
 *
 * @param slug - App slug.
 * @param hasAuth - Whether to request the auth kit.
 * @returns A job object.
 */
function job(slug: string, hasAuth: boolean): Job {
  return {
    kind: 'job',
    slug,
    prompt: 'Build a neighborhood tool library with search',
    targetType: 'fullstack-web',
    threshold: 90,
    answers: hasAuth ? { hasAuth: 'true' } : {},
    createdAt: '2026-09-23T00:00:00.000Z',
    entities: []
  };
}

/**
 * Run one deterministic check the way the gate does.
 *
 * @param ruleId - Rubric id.
 * @param appDir - Scaffold directory.
 * @returns Exit code and combined output.
 */
function runCheck(ruleId: string, appDir: string): { status: number; output: string } {
  const result = spawnSync(
    process.execPath,
    ['orchestrator/scripts/checks/check.mjs', ruleId, appDir],
    { cwd: repoRoot, encoding: 'utf8', timeout: 600_000 }
  );
  return { status: result.status ?? -1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/**
 * Install the scaffold's own dependencies. `npm ci` needs a lockfile the
 * scaffold does not generate; `npm install` is what a new app actually runs.
 *
 * @param appDir - Scaffold directory.
 */
function installApp(appDir: string): void {
  const result = spawnSync(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund'],
    { cwd: appDir, encoding: 'utf8', shell: true, timeout: 300_000 }
  );
  if (result.status !== 0) {
    throw new Error(`npm install failed: ${result.stdout ?? ''}${result.stderr ?? ''}`);
  }
  // The scaffold resolves its own @playwright/test, which may need a browser
  // build the repo did not install; the browser test lane cannot start without it.
  const browsers = spawnSync('npx', ['playwright', 'install', 'chromium'], {
    cwd: appDir,
    encoding: 'utf8',
    shell: true,
    timeout: 300_000
  });
  if (browsers.status !== 0) {
    throw new Error(`playwright install failed: ${browsers.stdout ?? ''}${browsers.stderr ?? ''}`);
  }
}

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('scaffold baseline', () => {
  it('derives a cookie name port.mjs will accept', () => {
    expect(sessionCookieName('demo-app')).toBe('demo_app_session');
    expect(sessionCookieName('demo-app')).toMatch(/^[a-z0-9_]+_session$/);
  });

  it('applies the auth kit only when hasAuth is true', async () => {
    const plain = await mkdtemp(join(tmpdir(), 'b4g-plain-'));
    const authed = await mkdtemp(join(tmpdir(), 'b4g-auth-'));
    dirs.push(plain, authed);

    const plainResult = await scaffoldApp({
      job: job('plain-app', false),
      outDir: plain,
      corpusDir,
      builtAt
    });
    const authedResult = await scaffoldApp({
      job: job('auth-app', true),
      outDir: authed,
      corpusDir,
      builtAt
    });

    expect(plainResult.authKitApplied).toBe(false);
    expect(existsSync(join(plain, 'functions', '_lib', 'appconfig.ts'))).toBe(false);
    expect(existsSync(join(plain, 'migrations', '0002_auth_core.sql'))).toBe(false);

    expect(authedResult.authKitApplied).toBe(true);
    const config = await readFile(join(authed, 'functions', '_lib', 'appconfig.ts'), 'utf8');
    expect(config).toContain("cookieName: 'auth_app_session'");
    expect(config).toContain('auth-app');
    expect(existsSync(join(authed, 'functions', 'api', 'auth', 'login.ts'))).toBe(true);
    expect(existsSync(join(authed, 'migrations', '0002_auth_core.sql'))).toBe(true);
    const wrangler = await readFile(join(authed, 'wrangler.toml'), 'utf8');
    expect(wrangler).toContain('SITE_URL');
    expect(wrangler).toContain('https://auth-app.pages.dev');
    const pkg = JSON.parse(await readFile(join(authed, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies.zod).toBeTruthy();

    // The kit is source, not a binary, and it must not trip the hygiene checks.
    for (const dir of [plain, authed]) {
      for (const rule of ['hyg-no-binaries', 'hyg-no-duplication', 'fe-no-inline-width'] as const) {
        const check = runCheck(rule, dir);
        expect(check.status, `${rule} ${dir}\n${check.output}`).toBe(0);
      }
      const links = runCheck('fe-resource-links', dir);
      expect(links.status, links.output).toBe(3);
      expect(links.output).toContain('no item detail route');
    }
  }, 120_000);

  it('passes breadcrumbs and the test runners, and both fail when the shell or a lane is removed', async () => {
    const out = await mkdtemp(join(tmpdir(), 'b4g-checks-'));
    dirs.push(out);
    await scaffoldApp({
      job: job('check-app', false),
      outDir: out,
      corpusDir,
      builtAt
    });
    installApp(out);

    const runners = runCheck('u-test-runners', out);
    expect(runners.status, runners.output).toBe(0);
    expect(runners.output).toContain('vitest-unit: PASS');
    expect(runners.output).toContain('vitest-browser: PASS');
    expect(runners.output).toContain('vitest-vrt: PASS');

    const crumbs = runCheck('fe-breadcrumbs', out);
    expect(crumbs.status, crumbs.output).toBe(0);
    expect(crumbs.output).toContain('fe-breadcrumbs PASS');

    // Temp copy: drop the breadcrumb prop. The check rebuilds, so delete dist
    // or it would measure the previous build and stay green.
    const brokenCrumbs = await mkdtemp(join(tmpdir(), 'b4g-crumbs-bad-'));
    dirs.push(brokenCrumbs);
    await cp(out, brokenCrumbs, { recursive: true });
    const docPath = join(brokenCrumbs, 'src', 'components', 'DocPage.tsx');
    const doc = await readFile(docPath, 'utf8');
    await writeFile(docPath, doc.replace(' breadcrumb={breadcrumb}', ''));
    await rm(join(brokenCrumbs, 'dist'), { recursive: true, force: true });
    const crumbsFail = runCheck('fe-breadcrumbs', brokenCrumbs);
    expect(crumbsFail.status, crumbsFail.output).toBe(1);
    expect(crumbsFail.output).toMatch(/breadcrumb/i);

    // Temp copy: remove every signal u-test-runners uses for the browser and
    // VRT lanes. The unit lane stays, so a green unit run cannot hide the gap.
    const brokenRunners = await mkdtemp(join(tmpdir(), 'b4g-runners-bad-'));
    dirs.push(brokenRunners);
    await cp(out, brokenRunners, { recursive: true });
    await rm(join(brokenRunners, 'src', 'lib', 'focus.browser.test.ts'), { force: true });
    await rm(join(brokenRunners, 'src', 'lib', 'shell.vrt.test.ts'), { force: true });
    const workspace = [
      "import { defineWorkspace } from 'vitest/config';",
      'export default defineWorkspace([',
      '  { test: { name: "unit", environment: "node", include: ["src/**/*.test.ts"] } }',
      ']);',
      ''
    ].join('\n');
    await writeFile(join(brokenRunners, 'vitest.workspace.ts'), workspace);
    const pkgPath = join(brokenRunners, 'package.json');
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as {
      scripts: Record<string, string>;
    };
    delete pkg.scripts['test:browser'];
    delete pkg.scripts['test:vrt'];
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    const runnersFail = runCheck('u-test-runners', brokenRunners);
    expect(runnersFail.status, runnersFail.output).toBe(1);
    expect(runnersFail.output).toMatch(/browser lane not configured/);
    expect(runnersFail.output).toMatch(/VRT lane not configured/);
  }, 420_000);
});
