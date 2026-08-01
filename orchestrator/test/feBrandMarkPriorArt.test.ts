/**
 * Known-answer fixtures for `fe-brand-mark` and `fe-prior-art`.
 *
 * Both rules existed only as prose (§7.3a / per-app pack) and so could not fail
 * the scored gate. These cases bind each check to answers that MUST fail (text
 * span, emoji, missing COMPETITORS.md) and one that MUST pass (real assets +
 * all three prior-art docs), so a vacuous pass cannot land again.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  copyFileSync,
  existsSync,
  statSync,
  readFileSync
} from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadRubric } from '../src/rubric/index';
import { APP_CHECKS } from '../src/commands/gate';

const here = dirname(fileURLToPath(import.meta.url));
const CHECK_SCRIPT = join(here, '..', 'scripts', 'checks', 'check.mjs');
const BRAND_SCRIPT = join(here, '..', 'scripts', 'checks', 'fe-brand-mark.mjs');
const PRIOR_SCRIPT = join(here, '..', 'scripts', 'checks', 'fe-prior-art.mjs');
const node = process.execPath;

/** Real PNG used as a substantive brand/favicon/OG asset in the pass fixture. */
const REAL_PNG = join(
  here,
  '..',
  '..',
  'dashboard',
  'public',
  'logo-mark.png'
);

/** Temp dirs created this file; cleaned in afterEach. */
const tempDirs: string[] = [];

/**
 * Create a unique temp app directory and track it for cleanup.
 * @returns Absolute path to the empty app root.
 */
function makeAppDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'redanvil-brand-prior-'));
  tempDirs.push(dir);
  return dir;
}

/**
 * Write a file under appDir, creating parent directories as needed.
 * @param appDir App root.
 * @param relPath Path relative to app root.
 * @param body File contents.
 */
function write(appDir: string, relPath: string, body: string): void {
  const full = join(appDir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, 'utf8');
}

/**
 * Run check.mjs for a rule against an app directory.
 * @param ruleId Rule id.
 * @param appDir App root.
 * @returns Child-process result.
 */
function runCheck(ruleId: string, appDir: string) {
  return spawnSync(node, [CHECK_SCRIPT, ruleId, appDir], {
    encoding: 'utf8',
    env: process.env
  });
}

/**
 * Run a standalone check script.
 * @param script Absolute path to the .mjs check.
 * @param appDir App root.
 * @returns Child-process result.
 */
function runStandalone(script: string, appDir: string) {
  return spawnSync(node, [script, appDir], {
    encoding: 'utf8',
    env: process.env
  });
}

/**
 * Minimal index.html that points at real public assets.
 * @returns HTML string.
 */
function goodIndexHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Demo</title>
    <link rel="icon" href="/favicon-96.png" type="image/png" />
    <meta property="og:image" content="/og.png" />
  </head>
  <body><div id="root"></div></body>
</html>
`;
}

/**
 * Shell that references a real logo image (pass shape).
 * @returns TSX source.
 */
function goodShell(): string {
  return `
import { Link } from 'react-router-dom';

/** Site chrome with a real brand mark asset. */
export function Layout() {
  return (
    <header>
      <Link to="/" className="topbar__logo">
        <img src="/logo-mark.png" alt="" className="topbar__mark" height={40} />
        <span className="topbar__name">Demo App</span>
      </Link>
    </header>
  );
}
`;
}

/**
 * Install substantive PNG assets under public/ for the pass fixture.
 * @param appDir App root.
 */
function installRealAssets(appDir: string): void {
  expect(existsSync(REAL_PNG), `fixture PNG missing: ${REAL_PNG}`).toBe(true);
  mkdirSync(join(appDir, 'public'), { recursive: true });
  copyFileSync(REAL_PNG, join(appDir, 'public', 'logo-mark.png'));
  copyFileSync(REAL_PNG, join(appDir, 'public', 'favicon-96.png'));
  // OG needs ≥ 4KB; logo-mark may already clear that — pad defensively if not.
  const ogPath = join(appDir, 'public', 'og.png');
  copyFileSync(REAL_PNG, ogPath);
  const { size } = statSync(ogPath);
  if (size < 4096) {
    const buf = readFileSync(ogPath);
    const padded = Buffer.concat([buf, Buffer.alloc(4096 - buf.length, 0)]);
    writeFileSync(ogPath, padded);
  }
}

/**
 * Written prior-art docs with no unwritten markers.
 * @param appDir App root.
 */
function writePriorArtDocs(appDir: string): void {
  write(
    appDir,
    'SOURCES.md',
    `# Sources\n\nApp Store intake for this category.\n\n| app | url | ratings |\n|---|---|---:|\n| Example Gardener | https://apps.apple.com/example | 12000 |\n\nBorrowed component: the half-month plantable strip (shape changed to a full-bleed year grid).\n`
  );
  write(
    appDir,
    'INTEGRATIONS.md',
    `# Integrations\n\n## Connectors considered\n\n- None attached for this domain.\n\n| repo | stars | language | licence | last push | flags |\n|---|---:|---|---|---|---|\n| example/planting | 10 | TS | MIT | 2026-07-01 | |\n\n## Decision\n\n**Build / integrate / hybrid:** Build. No Worker-compatible planting calendar library returns Arizona low-desert windows. Seed from UA Cooperative Extension az1005 into D1 and serve from the store.\n\n**Why:** Runtime fit and licence are clean only if we own the data path.\n\n**Revisit when:** a maintained Worker-native calendar library appears with AZ1005 coverage.\n`
  );
  write(
    appDir,
    'COMPETITORS.md',
    `# Competitors\n\n## Assessment\n\n### Features and controls we are missing\n\n- Month filter chips on the plantable list\n- Saved crop lists per garden bed\n- Printable year grid export\n\n### Components worth borrowing\n\n- Half-month density strip: keep the idea, change density and position to a full year grid.\n\n### What we deliberately will not do\n\n- Multi-zone national coverage; this app is Cave Creek / AZ low desert only.\n`
  );
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

describe('fe-brand-mark and fe-prior-art are registered', () => {
  it('both rule ids are in the rubric as frontend blockers (det)', () => {
    const rubric = loadRubric();
    for (const id of ['fe-brand-mark', 'fe-prior-art']) {
      const rule = rubric.find((r) => r.id === id);
      expect(rule, id).toBeDefined();
      expect(rule?.lane).toBe('frontend');
      expect(rule?.severity).toBe('blocker');
      expect(rule?.method).toBe('det');
    }
  });

  it('both are wired into APP_CHECKS so the gate runs them', () => {
    const ids = APP_CHECKS.map((c) => c.ruleId);
    expect(ids).toContain('fe-brand-mark');
    expect(ids).toContain('fe-prior-art');
  });
});

describe('fe-brand-mark known-answer fixtures', () => {
  it('fails when the header brand mark is a text span (AZ)', () => {
    const app = makeAppDir();
    write(
      app,
      'src/components/Layout.tsx',
      `
export function Layout() {
  return (
    <header>
      <a className="topbar__logo" href="/">
        <span className="topbar__mark" aria-hidden="true">
          AZ
        </span>
        <span className="topbar__name">AZ Planting Calendar</span>
      </a>
    </header>
  );
}
`
    );
    write(app, 'index.html', goodIndexHtml());
    // Even with "real-looking" paths declared, a text span must fail.
    write(app, 'public/favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32"/></svg>');
    write(app, 'public/og.svg', '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630"/></svg>');

    const r = runCheck('fe-brand-mark', app);
    expect(r.status, r.stderr + r.stdout).toBe(1);
    expect(r.stderr).toMatch(/text-span|placeholder/i);
  });

  it('fails when the header brand mark is an emoji', () => {
    const app = makeAppDir();
    write(
      app,
      'src/components/Layout.tsx',
      `
export function Layout() {
  return (
    <header>
      <a className="topbar__logo" href="/">
        <span className="brand-mark" aria-hidden="true">🌵</span>
        <span className="topbar__name">Desert Calendar</span>
      </a>
    </header>
  );
}
`
    );
    write(app, 'index.html', goodIndexHtml());

    const r = runCheck('fe-brand-mark', app);
    expect(r.status, r.stderr + r.stdout).toBe(1);
    expect(r.stderr).toMatch(/emoji/i);
  });

  it('fails when favicon is a trivially small hand-drawn stub', () => {
    const app = makeAppDir();
    write(app, 'src/components/Layout.tsx', goodShell());
    write(
      app,
      'index.html',
      `<!doctype html><html><head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta property="og:image" content="/og.png" />
      </head><body></body></html>`
    );
    // 361-byte class stub: rect + text only.
    write(
      app,
      'public/favicon.svg',
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="4" fill="#0e1419"/>
  <text x="16" y="21" text-anchor="middle" font-size="11" fill="#eef2f5">AZ</text>
</svg>`
    );
    if (existsSync(REAL_PNG)) {
      mkdirSync(join(app, 'public'), { recursive: true });
      copyFileSync(REAL_PNG, join(app, 'public', 'logo-mark.png'));
      copyFileSync(REAL_PNG, join(app, 'public', 'og.png'));
    }

    const r = runStandalone(BRAND_SCRIPT, app);
    expect(r.status, r.stderr + r.stdout).toBe(1);
    expect(r.stderr).toMatch(/favicon|trivial|placeholder/i);
  });

  it('passes when a real asset is referenced and favicon/OG are substantive', () => {
    const app = makeAppDir();
    write(app, 'src/components/Layout.tsx', goodShell());
    write(app, 'index.html', goodIndexHtml());
    installRealAssets(app);

    const r = runCheck('fe-brand-mark', app);
    expect(r.status, r.stderr + r.stdout).toBe(0);
  });
});

describe('fe-prior-art known-answer fixtures', () => {
  it('fails when COMPETITORS.md is missing', () => {
    const app = makeAppDir();
    write(app, 'src/main.tsx', 'export {};\n');
    write(app, 'package.json', '{"name":"demo"}\n');
    write(
      app,
      'SOURCES.md',
      '# Sources\n\nReal app-store intake notes for the category with enough body to clear the floor.\n'
    );
    write(
      app,
      'INTEGRATIONS.md',
      '# Integrations\n\n## Decision\n\nBuild in-house after scanning candidates; no Worker-fit library for this domain.\n'
    );
    // COMPETITORS.md deliberately omitted.

    const r = runCheck('fe-prior-art', app);
    expect(r.status, r.stderr + r.stdout).toBe(1);
    expect(r.stderr).toMatch(/COMPETITORS\.md/i);
  });

  it('fails when a prior-art file still has the unwritten marker', () => {
    const app = makeAppDir();
    write(app, 'src/main.tsx', 'export {};\n');
    writePriorArtDocs(app);
    write(
      app,
      'COMPETITORS.md',
      `# Competitors\n\n## Assessment\n\nFill this in.\n\n### Features and controls we are missing\n\nList them.\n`
    );

    const r = runStandalone(PRIOR_SCRIPT, app);
    expect(r.status, r.stderr + r.stdout).toBe(1);
    expect(r.stderr).toMatch(/unwritten|Fill this in/i);
  });

  it('passes when all three docs exist without unwritten markers', () => {
    const app = makeAppDir();
    write(app, 'src/main.tsx', 'export {};\n');
    write(app, 'package.json', '{"name":"demo"}\n');
    writePriorArtDocs(app);

    const r = runCheck('fe-prior-art', app);
    expect(r.status, r.stderr + r.stdout).toBe(0);
  });
});

describe('combined pass fixture: real brand mark + all three prior-art docs', () => {
  it('passes both checks together', () => {
    const app = makeAppDir();
    write(app, 'src/components/Layout.tsx', goodShell());
    write(app, 'index.html', goodIndexHtml());
    installRealAssets(app);
    writePriorArtDocs(app);

    const brand = runCheck('fe-brand-mark', app);
    const prior = runCheck('fe-prior-art', app);
    expect(brand.status, brand.stderr + brand.stdout).toBe(0);
    expect(prior.status, prior.stderr + prior.stdout).toBe(0);
  });
});
