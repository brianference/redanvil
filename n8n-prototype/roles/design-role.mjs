#!/usr/bin/env node
/**
 * Design and build roles delegated to Grok Build.
 *
 * The owner's instruction is to use Grok surgically for logos and component
 * design options, not for everything and not for whole-app rebuilds. Two rules
 * follow from what that cost when ignored:
 *
 * 1. Feed a COMPACT SPEC. Pointing jobs at the generated option HTML meant
 *    63KB + 57KB + 95KB re-read by every design job. A token table is twenty
 *    lines and says the same thing.
 * 2. Name the FORBIDDEN outcome. A decision doc that only says what to share
 *    will faithfully homogenise three chosen designs into one shell, which is
 *    exactly what happened and had to be rebuilt.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = /^--([^=]+)=([\s\S]*)$/.exec(a);
    return m ? [[m[1], m[2]]] : [];
  })
);
const role = args.role;
const slug = args.slug;
const root = resolve(args.repoRoot ?? process.cwd());
const appDir = join(root, slug ?? '');

/**
 * Read a file if present, else an empty string, so a prompt degrades rather
 * than throwing when an upstream role has not run.
 * @param {string} rel path relative to the app
 * @returns {string} contents or ''
 */
const read = (rel) => (existsSync(join(appDir, rel)) ? readFileSync(join(appDir, rel), 'utf8') : '');

const brief = read('docs/PRODUCT-BRIEF.md').slice(0, 1500);
const features = read('docs/FEATURES.md').slice(0, 800);

/** @type {Record<string,()=>string>} */
const PROMPTS = {
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

if (!role || !slug || !PROMPTS[role]) {
  process.stderr.write(`usage: design-role.mjs --role=<${Object.keys(PROMPTS).join('|')}> --slug=X\n`);
  process.exit(2);
}

mkdirSync(appDir, { recursive: true });

/**
 * Scope the agent to the app directory, not the whole repository.
 *
 * `--always-approve` pre-grants every approval, so whatever the agent can reach,
 * it can change without a human seeing it. Pointing that at the repo root let a
 * design job rewrite the orchestrator, the gate, or another app. None of these
 * roles has any business outside the app they are building, so the blast radius
 * is narrowed to match.
 */
const agentCwd = appDir;

const proc = spawnSync('grok', ['--always-approve', '--cwd', agentCwd, '-m', 'grok-4.5', '-p', PROMPTS[role]()], {
  cwd: root,
  encoding: 'utf8',
  timeout: 30 * 60 * 1000
});
if (proc.error) {
  process.stderr.write(`grok could not be launched: ${proc.error.message}\n`);
  process.exit(1);
}
process.stdout.write((proc.stdout ?? '').trim().split('\n').slice(-3).join('\n') + '\n');
process.exit(proc.status ?? 1);
