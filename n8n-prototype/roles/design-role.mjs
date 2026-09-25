#!/usr/bin/env node
/**
 * Design and build roles.
 *
 * The owner's instruction is to use Grok surgically for logos and component
 * design options, not for everything and not for whole-app rebuilds. Only
 * logo, palette and layout run on Grok (GROK_ALLOWED_ROLES in
 * orchestrator/scripts/lib/engine-policy.mjs); `build` and `content` are
 * coding and copy, so runAgentWithFailover sends them to Claude with no Grok
 * fallback. Two rules
 * follow from what that cost when ignored:
 *
 * 1. Feed a COMPACT SPEC. Pointing jobs at the generated option HTML meant
 *    63KB + 57KB + 95KB re-read by every design job. A token table is twenty
 *    lines and says the same thing.
 * 2. Name the FORBIDDEN outcome. A decision doc that only says what to share
 *    will faithfully homogenise three chosen designs into one shell, which is
 *    exactly what happened and had to be rebuilt.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runAgentWithFailover } from './agent-failover.mjs';

/** Overall bound for one design role. The heartbeat inside the failover is shorter. */
const ROLE_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * logo is the only design prompt that calls image_gen. The others are text
 * and HTML. A grok hang on logo must fail, not become a Claude essay.
 */
const IMAGE_ROLES = new Set(['logo']);

/**
 * Whether this design role's artifact is a Grok Imagine image.
 * @param {string} role
 * @returns {boolean}
 */
export function designRoleNeedsImages(role) {
  return IMAGE_ROLES.has(role);
}

/**
 * @param {string} appDir
 * @returns {(rel: string) => string}
 */
function reader(appDir) {
  return (rel) => (existsSync(join(appDir, rel)) ? readFileSync(join(appDir, rel), 'utf8') : '');
}

/**
 * Prompt text per design role. `read` is closed over the app directory.
 * @param {string} role
 * @param {string} slug
 * @param {(rel: string) => string} read
 * @returns {string|null}
 */
function promptFor(role, slug, read) {
  const brief = read('docs/PRODUCT-BRIEF.md').slice(0, 1500);
  const features = read('docs/FEATURES.md').slice(0, 800);
  /** @type {Record<string, () => string>} */
  const prompts = {
  logo: () => `Run the LOGO role for ${slug}.

Generate FIVE real brand marks with your image_gen tool into
${slug}/design-refs/logos/mark-01.png .. mark-05.png. Not emoji, not text
initials, not SVG scribbles.

Vary the CONCEPTS genuinely -- do not produce five versions of one idea. Each
must read at 24px and hold up at 200px, and each must be generated on a
TRANSPARENT background: an opaque backdrop makes the favicon a solid blob at
32x32 and puts a pale tile behind the header logo. That defect shipped once.

Build ${slug}/design-refs/logos/gallery.html showing every mark at 240px on both
a light and a dark card, plus a 24/32/48px strip beside a wordmark so header
legibility is visible. Numbered 1-5.

Write ${slug}/design-refs/logos/DECISION.md listing all five, naming mark-05
explicitly, choice left OPEN. Do not pick for the owner.

Product: ${brief}`,

  palette: () => `Run the PALETTE role for ${slug}.

Colour is its own choice axis, never inherited from whichever layout wins. Produce
FIVE complete directions in ${slug}/design-refs/palettes/palette-01..05.html --
bg, surface, text, muted, border, primary, primary-contrast, success, plus a
display and body face.

They must differ in TEMPERATURE, CONTRAST STRATEGY and TYPE VOICE, not be five
tints of one hue: one dark-first, one near-monochrome with a single accent, one
warm editorial serif, one cool low-chroma, one your strongest idea.

Gallery at ${slug}/design-refs/palettes/gallery.html: one column per direction,
each showing a LIGHT and a DARK phone of the SAME real screen so only colour and
type vary. Every direction must pass WCAG AA in BOTH themes, measured with
axe-core and stated -- never hand-computed.

DECISION.md names palette-05, contains the word "dark", choice OPEN.

Product: ${brief}`,

  layout: () => `Run the LAYOUT role for ${slug}.

Produce THREE structurally distinct layout options as
${slug}/design-refs/design-options/option-a.html, option-b.html, option-c.html,
plus gallery.html.

Structurally distinct means they differ in WHAT OWNS THE FOLD and what the result
unit is -- not one skeleton recoloured. Draw direction from
${slug}/design-refs/SOURCES.md if it exists.

Write DECISION.md with the options table AND a "Forbidden" section naming the
flattened outcome: a shared hero above every view, one search control reused by
all, one palette everywhere. A decision that records only what is SHARED will
produce one shell with three widgets -- that happened and had to be rebuilt.

Choice OPEN. Do not pick for the owner.

Product: ${brief}
Features: ${features}`,

  build: () => `Run the ENGINEER role for ${slug}.

Read ${slug}/docs/PRD.md, docs/FEATURES.md, and the DECIDED design in
design-refs/*/DECISION.md. Build what was decided -- the decisions are binding and
you must not substitute your own.

Read ${slug}/docs/REUSE-SCAN.md FIRST and use what it found rather than
hand-rolling a capability that has a maintained implementation.

Stack is Cloudflare Pages + Functions + D1. No Express, no Postgres, no Node-only
globals in Worker or browser code. Zod at every boundary, parameterised D1 queries
only, real data seeded from real examples.

Make the acceptance tests in ${slug}/test/acceptance pass. They were written from
the PRD before the build and they currently fail; that is the target.`,

  content: () => `Run the CONTENT role for ${slug}.

Write real Terms and Privacy pages at ${slug}/src/pages/Terms.tsx and
Privacy.tsx. Every statement must be TRUE for this app -- do not describe data
handling the app does not do.

Legal pages specced as "real content, no boilerplate" once shipped at 81 words.
The floor here is 1500 bytes each and it is measured, not promised.

Also write loading, empty and error states for every screen, and coverage
boundaries where the app's data does not reach.

Product: ${brief}`
  };
  const build = prompts[role];
  return build ? build() : null;
}

/** Counted artifact each design role is asked to produce. */
const ARTIFACTS = {
  logo: 'design-refs/logos/DECISION.md',
  palette: 'design-refs/palettes/DECISION.md',
  layout: 'design-refs/design-options/DECISION.md',
  build: 'src',
  content: 'src/pages/Terms.tsx'
};

/**
 * Copy a provisional mark so an unattended logo run is not deadlocked by the
 * contract that wants public/brand-mark.png before the owner has chosen.
 *
 * The pick is flagged in PROVISIONAL.md. An existing brand-mark.png is left
 * alone. A failure here is logged and does not change the agent's exit code:
 * the contract refuses a missing mark on its own.
 *
 * @param {string} appDir
 * @returns {string} extra stdout, possibly empty
 */
function provisionalLogo(appDir) {
  try {
    const marksDir = join(appDir, 'design-refs', 'logos');
    const publicDir = join(appDir, 'public');
    const target = join(publicDir, 'brand-mark.png');
    if (existsSync(target) || !existsSync(marksDir)) return '';
    const candidates = readdirSync(marksDir)
      .filter((name) => /^mark-\d+\.png$/i.test(name))
      .sort();
    if (candidates.length === 0) return '';
    const decisionPath = join(marksDir, 'DECISION.md');
    const decision = existsSync(decisionPath) ? readFileSync(decisionPath, 'utf8') : '';
    const recommended = candidates.find((name) =>
      new RegExp(`recommend\\w*[^\\n]*${name.replace('.png', '')}`, 'i').test(decision)
    );
    const picked = recommended ?? candidates[0];
    mkdirSync(publicDir, { recursive: true });
    copyFileSync(join(marksDir, picked), target);
    writeFileSync(
      join(marksDir, 'PROVISIONAL.md'),
      `# Provisional logo pick\n\n` +
        `**${picked}** was copied to \`public/brand-mark.png\` by the logo role, ` +
        `not chosen by the owner.\n\n` +
        `A machine picked this so an unattended run could continue past the logo ` +
        `contract. It is NOT a decision. The owner gate still owns the real one: ` +
        `all ${candidates.length} candidates are in this folder with a gallery, and ` +
        `approving a different mark at the gate replaces this file.\n\n` +
        `Candidates: ${candidates.join(', ')}\n`
    );
    return `provisional logo: ${picked} -> public/brand-mark.png (flagged for owner review)\n`;
  } catch (err) {
    process.stderr.write(`provisional logo pick failed: ${String(err)}\n`);
    return '';
  }
}

/**
 * Run one design role.
 *
 * The agent cwd is the app directory. `--always-approve` pre-grants every
 * approval, so the working directory is the blast radius. None of these roles
 * has any business outside the app they are building.
 *
 * @param {{role: string, slug: string, repoRoot?: string, runAgent?: typeof runAgentWithFailover}} opts
 * @returns {Promise<{status: number, stdout: string, stderr: string}>}
 */
export async function runDesignRole(opts) {
  const root = resolve(opts.repoRoot ?? process.cwd());
  const appDir = join(root, opts.slug ?? '');
  const prompt = opts.slug ? promptFor(opts.role, opts.slug, reader(appDir)) : null;
  if (!opts.role || !opts.slug || !prompt) {
    return {
      status: 2,
      stdout: '',
      stderr: `usage: design-role.mjs --role=<${Object.keys(ARTIFACTS).join('|')}> --slug=X\n`
    };
  }
  mkdirSync(appDir, { recursive: true });
  const runAgent = opts.runAgent ?? runAgentWithFailover;
  const result = await runAgent({
    prompt,
    cwd: appDir,
    timeoutMs: ROLE_TIMEOUT_MS,
    needsImages: designRoleNeedsImages(opts.role),
    role: opts.role,
    artifact: ARTIFACTS[opts.role] ?? '',
    appDir
  });
  let extra = '';
  if (opts.role === 'logo' && result.ok) extra = provisionalLogo(appDir);
  const tail = (result.stdout ?? '').trim().split('\n').slice(-3).join('\n');
  const stdout = `${tail}${tail ? '\n' : ''}${extra}engine: ${result.engine ?? 'none'}\n`;
  const stderr = result.ok ? '' : `${result.reason ?? result.stderr ?? ''}\n`;
  const status = result.ok ? 0 : typeof result.status === 'number' && result.status !== 0 ? result.status : 1;
  return { status, stdout, stderr };
}

/**
 * @param {string[]} argv
 * @returns {Record<string, string>}
 */
function parseArgs(argv) {
  return Object.fromEntries(
    argv.flatMap((arg) => {
      const match = /^--([^=]+)=([\s\S]*)$/.exec(arg);
      return match ? [[match[1], match[2]]] : [];
    })
  );
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const args = parseArgs(process.argv.slice(2));
  const result = await runDesignRole({ role: args.role, slug: args.slug, repoRoot: args.repoRoot });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status);
}
