import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readFile, access } from 'node:fs/promises';
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
        path === '/'
          ? 'https://demo-app.pages.dev/'
          : `https://demo-app.pages.dev${path}`;
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
    const files = appFiles({
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
    });
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
