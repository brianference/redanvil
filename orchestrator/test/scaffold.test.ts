import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { scaffoldApp } from '../src/scaffold/scaffoldApp';
import { parseByKind } from '../src/schemas/index';
import { JobSchema } from '../src/schemas/job';
import { loadRubric } from '../src/rubric/index';
import { CORPUS_VERSION } from '../src/corpus/version';
import { appFiles } from '../src/scaffold/templates';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const corpusDir = join(repoRoot, 'rules');

const job = parseByKind('job', {
  kind: 'job',
  slug: 'demo-app',
  prompt: 'Build a demo app with search',
  targetType: 'fullstack-web',
  threshold: 90,
  answers: {},
  createdAt: '2026-07-21T00:00:00.000Z'
});

describe('scaffoldApp', () => {
  let out: string;
  beforeAll(async () => {
    out = await mkdtemp(join(tmpdir(), 'redanvil-scaffold-'));
    if (job.kind !== 'job') throw new Error('job fixture invalid');
    await scaffoldApp({
      job: job.value,
      outDir: out,
      corpusDir,
      builtAt: '2026-07-21T00:00:00.000Z'
    });
  });
  afterAll(async () => {
    await rm(out, { recursive: true, force: true });
  });

  it('writes a conformance manifest that validates and records the corpus version', async () => {
    const raw = JSON.parse(await readFile(join(out, 'conformance.json'), 'utf8'));
    const parsed = parseByKind('conformance', raw);
    expect(parsed.kind).toBe('conformance');
    if (parsed.kind === 'conformance') {
      expect(parsed.value.corpusVersion).toBe(CORPUS_VERSION);
      expect(parsed.value.ruleCount).toBe(loadRubric().length);
    }
  });

  it('injects the base-15 and per-app pack into CLAUDE.md', async () => {
    const md = await readFile(join(out, 'CLAUDE.md'), 'utf8');
    expect(md).toContain('Strict typing');
    expect(md).toContain('Web Crypto');
  });

  it('generates a Cloudflare-compliant package.json with wrangler and no forbidden deps', async () => {
    const pkg = JSON.parse(await readFile(join(out, 'package.json'), 'utf8'));
    expect(pkg.devDependencies.wrangler).toBeTruthy();
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(allDeps.bcrypt).toBeUndefined();
    expect(allDeps['better-sqlite3']).toBeUndefined();
    expect(allDeps.express).toBeUndefined();
  });

  it('includes lint/type deps the scripts and JSX annotations require', async () => {
    const pkg = JSON.parse(await readFile(join(out, 'package.json'), 'utf8'));
    expect(pkg.devDependencies.eslint).toBeTruthy();
    expect(pkg.devDependencies['@typescript-eslint/eslint-plugin']).toBeTruthy();
    expect(pkg.devDependencies['@typescript-eslint/parser']).toBeTruthy();
    expect(pkg.devDependencies['@types/react']).toBeTruthy();
    expect(pkg.devDependencies['@types/react-dom']).toBeTruthy();
  });

  it('pins vitest and its coverage provider to the same exact version', async () => {
    const pkg = JSON.parse(await readFile(join(out, 'package.json'), 'utf8'));
    const vitest = pkg.devDependencies.vitest;
    const provider = pkg.devDependencies['@vitest/coverage-v8'];
    expect(provider, 'the coverage provider must ship with the scaffold').toBeTruthy();
    // @vitest/coverage-v8 declares an EXACT peer on vitest (2.1.9 requires
    // "vitest": "2.1.9"), so a caret on either side lets npm resolve them to
    // different 2.x releases and `npm install` fails on the peer conflict before
    // a generated app runs anything. Ranges are rejected outright, not just
    // mismatches: `^2.1.9` on both happens to work today only because 2.1.9 is
    // the newest 2.x, and that stops being true the moment 2.1.10 ships.
    expect(vitest, 'vitest must be an exact version, not a range').toMatch(/^\d+\.\d+\.\d+$/);
    expect(provider, 'the provider must be an exact version, not a range').toMatch(
      /^\d+\.\d+\.\d+$/
    );
    expect(provider, 'provider and vitest must be the same version').toBe(vitest);
  });

  it('emits coverage config that writes the summary the gate reads', async () => {
    const config = await readFile(join(out, 'vitest.config.ts'), 'utf8');
    // json-summary is what produces coverage/coverage-summary.json. Without it
    // u-test-presence and u-test-coverage-ratchet have nothing to read.
    expect(config).toContain('json-summary');
    expect(config).toContain("provider: 'v8'");
    // Components and pages are Playwright's surface; vitest's V8 provider cannot
    // see a browser it did not launch, so including them would report 0% for
    // files that are in fact tested.
    expect(config).toContain("include: ['src/lib/**', 'src/hooks/**', 'functions/**']");
    expect(config).not.toContain("include: ['src/**'");

    const pkg = JSON.parse(await readFile(join(out, 'package.json'), 'utf8'));
    expect(pkg.scripts['test:coverage']).toBe('vitest run --coverage');
    // An audit nobody runs is a file, not a gate.
    expect(pkg.scripts.verify).toContain('test:coverage');
  });

  it('ships an API example set and a tracked coverage-ratchet state file', async () => {
    const examples = JSON.parse(await readFile(join(out, 'tests', 'api-examples.json'), 'utf8'));
    // The scaffold really generates functions/api/health.ts, so the starter
    // example describes a route that exists rather than one someone remembered.
    expect(examples.examples.map((e: { route: string }) => e.route)).toContain('/api/health');

    const state = JSON.parse(
      await readFile(join(out, '.redanvil', 'coverage-state.json'), 'utf8')
    );
    expect(state.baseCommit, 'no baseline until a run records one').toBeNull();
    expect(state.highWaterPct).toBe(0);

    // The ratchet reads this file's git history to catch the bar being lowered.
    // An ignored file has no history, so ignoring it silently disables the check.
    const ignore = await readFile(join(out, '.gitignore'), 'utf8');
    expect(ignore).toContain('coverage/');
    expect(ignore).not.toContain('.redanvil');
  });

  it('generates the required pages and Web Crypto auth', async () => {
    for (const p of ['Home', 'About', 'Terms', 'Privacy', 'Contact']) {
      const page = await readFile(join(out, 'src', 'pages', `${p}.tsx`), 'utf8');
      expect(page).toContain(`export function ${p}`);
    }
    const auth = await readFile(join(out, 'functions', 'lib', 'auth.ts'), 'utf8');
    expect(auth).toContain('PBKDF2');
    expect(auth).not.toContain('bcrypt');
  });

  it('emits public/sitemap.xml listing the five shell routes', async () => {
    const sitemap = await readFile(join(out, 'public', 'sitemap.xml'), 'utf8');
    expect(sitemap).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    for (const path of ['/', '/about', '/terms', '/privacy', '/contact']) {
      const loc =
        path === '/' ? 'https://demo-app.pages.dev/' : `https://demo-app.pages.dev${path}`;
      expect(sitemap).toContain(`<loc>${loc}</loc>`);
    }
  });

  it('emits a public OG asset matching fe-seo-assets', async () => {
    const og = await readFile(join(out, 'public', 'og.svg'), 'utf8');
    expect(og).toContain('<svg');
    expect(og).toContain('demo-app');
    await expect(access(join(out, 'public', 'robots.txt'))).resolves.toBeUndefined();
  });

  it('emits migrations/0001_init.sql with CREATE TABLE when entities are empty', async () => {
    const sql = await readFile(join(out, 'migrations', '0001_init.sql'), 'utf8');
    expect(sql).toMatch(/CREATE\s+TABLE/i);
    // Slug-derived fallback table for jobs with no entities.
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS demo_app');
    expect(sql).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT');
    expect(sql).toContain('created_at TEXT NOT NULL');
  });

  it('emits eslint.config.js with no-explicit-any and no-unused-vars', async () => {
    const cfg = await readFile(join(out, 'eslint.config.js'), 'utf8');
    expect(cfg).toContain('@typescript-eslint/no-explicit-any');
    expect(cfg).toContain('@typescript-eslint/no-unused-vars');
    expect(cfg).toContain('@typescript-eslint/parser');
  });

  it('emits at least one behavioral test file', async () => {
    const testSrc = await readFile(join(out, 'src', 'lib', 'routes.test.ts'), 'utf8');
    expect(testSrc).toContain("from 'vitest'");
    expect(testSrc).toContain('pathForPage');
    expect(testSrc).not.toContain('expect(true).toBe(true)');
    const routes = await readFile(join(out, 'src', 'lib', 'routes.ts'), 'utf8');
    expect(routes).toContain('export const ROUTES');
    expect(routes).toContain("path: '/about'");
  });

  it('emits design-system/tokens.json and theme imports that path', async () => {
    const tokensPath = join(out, 'design-system', 'tokens.json');
    await expect(access(tokensPath)).resolves.toBeUndefined();
    const tokens = JSON.parse(await readFile(tokensPath, 'utf8')) as { color: { accent: string } };
    expect(tokens.color.accent).toMatch(/^#/);
    const theme = await readFile(join(out, 'src', 'theme.ts'), 'utf8');
    expect(theme).toContain("from '../design-system/tokens.json'");
    expect(theme).not.toContain('../../design-system/tokens.json');
  });

  it('emits an i18n bundle and pages read copy from it', async () => {
    const en = await readFile(join(out, 'src', 'i18n', 'en.ts'), 'utf8');
    expect(en).toContain('export const en');
    expect(en).toContain('pages:');
    const home = await readFile(join(out, 'src', 'pages', 'Home.tsx'), 'utf8');
    expect(home).toContain("from '../i18n/en'");
    expect(home).toContain('en.pages.home');
    expect(home).not.toMatch(/<p>Home content\.<\/p>/);
  });
});

describe('scaffold migrations from job.entities', () => {
  it('JobSchema defaults entities to [] so legacy job JSON still parses', () => {
    const parsed = JobSchema.safeParse({
      kind: 'job',
      slug: 'legacy-job',
      prompt: 'Build something real enough',
      targetType: 'fullstack-web',
      threshold: 90,
      answers: {},
      createdAt: '2026-07-21T00:00:00.000Z'
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.entities).toEqual([]);
  });

  it('emits CREATE TABLE for each provided entity and its fields', () => {
    const files = appFiles(
      {
        kind: 'job',
        slug: 'market-app',
        prompt: 'Build a marketplace for local makers',
        targetType: 'fullstack-web',
        threshold: 90,
        answers: {},
        createdAt: '2026-07-21T00:00:00.000Z',
        entities: [
          {
            name: 'Listing',
            fields: [
              { name: 'title', type: 'text' },
              { name: 'price_cents', type: 'integer' }
            ]
          },
          { name: 'Seller', fields: [{ name: 'display_name', type: 'text' }] }
        ]
      },
      '2026-07-21T00:00:00.000Z'
    );
    const sql = files['migrations/0001_init.sql'];
    expect(sql).toBeDefined();
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS listing');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS seller');
    expect(sql).toContain('title TEXT');
    expect(sql).toContain('price_cents INTEGER');
    expect(sql).toContain('display_name TEXT');
    expect(sql).not.toContain('CREATE TABLE IF NOT EXISTS market_app');
  });
});

describe('a scaffold is usable the moment it exists', () => {
  let out: string;
  beforeAll(async () => {
    out = await mkdtemp(join(tmpdir(), 'redanvil-scaffold-usable-'));
    if (job.kind !== 'job') throw new Error('job fixture invalid');
    await scaffoldApp({
      job: job.value,
      outDir: out,
      corpusDir,
      builtAt: '2026-07-21T00:00:00.000Z'
    });
  });
  afterAll(async () => {
    await rm(out, { recursive: true, force: true });
  });

  // Both of these were found by scaffolding a real job and trying to build it,
  // which nothing had done end-to-end before.

  it('ships every design file its own CLAUDE.md tells the builder to read', async () => {
    const claude = await readFile(join(out, 'CLAUDE.md'), 'utf8');
    // Pull the design-system paths the rule pack actually cites, so this test
    // tracks the pack rather than a hard-coded list that can drift from it.
    const cited = [...claude.matchAll(/`?\/?(design-system\/[\w.-]+\.md)`?/g)]
      .map((m) => m[1])
      .filter((rel): rel is string => rel !== undefined);
    expect(cited.length, 'the rule pack should cite design guidance').toBeGreaterThan(0);
    for (const rel of new Set(cited)) {
      expect(
        existsSync(join(out, rel)),
        `CLAUDE.md tells the builder to follow ${rel}, but the scaffold does not ship it`
      ).toBe(true);
    }
  });

  it('is a git repository with one commit, so git-backed rules can run', async () => {
    // `hyg-env-ignored` is a security blocker implemented as `git check-ignore
    // .env`, which exits 128 outside a repository. Every generated app failed
    // it on day one despite shipping a correct .gitignore.
    const inside = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: out,
      encoding: 'utf8'
    });
    expect(inside.stdout.trim()).toBe('true');

    const ignored = spawnSync('git', ['check-ignore', '.env'], { cwd: out, encoding: 'utf8' });
    expect(ignored.status, '.env must be git-ignored in a fresh scaffold').toBe(0);

    const log = spawnSync('git', ['log', '--oneline'], { cwd: out, encoding: 'utf8' });
    expect(log.stdout.trim().length).toBeGreaterThan(0);
  });

  it('carries the desktop-width rules into the app the builder reads', async () => {
    // These lived only in the PRD. An agent starting from a scaffold never saw
    // them, so the two guidance channels had silently diverged.
    const claude = await readFile(join(out, 'CLAUDE.md'), 'utf8');
    expect(claude).toMatch(/80% of the viewport/);
    expect(claude).toMatch(/never a container box/i);
    expect(claude).toMatch(/maxWidth/);
    expect(claude).toMatch(/Design direction/i);
  });
});
