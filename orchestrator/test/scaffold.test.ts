import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { scaffoldApp } from '../src/scaffold/scaffoldApp';
import { parseByKind } from '../src/schemas/index';
import { loadRubric } from '../src/rubric/index';
import { CORPUS_VERSION } from '../src/corpus/version';

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
    await scaffoldApp({ job: job.value, outDir: out, corpusDir, builtAt: '2026-07-21T00:00:00.000Z' });
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

  it('generates the required pages and Web Crypto auth', async () => {
    for (const p of ['Home', 'About', 'Terms', 'Privacy', 'Contact']) {
      const page = await readFile(join(out, 'src', 'pages', `${p}.tsx`), 'utf8');
      expect(page).toContain(`export function ${p}`);
    }
    const auth = await readFile(join(out, 'functions', 'lib', 'auth.ts'), 'utf8');
    expect(auth).toContain('PBKDF2');
    expect(auth).not.toContain('bcrypt');
  });
});
