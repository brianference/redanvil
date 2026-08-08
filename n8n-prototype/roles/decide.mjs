#!/usr/bin/env node
/**
 * The `decide` role: record the owner's choices. It CANNOT manufacture one.
 *
 * This runner only verifies that each design DECISION.md carries a real recorded
 * choice and writes a summary. If a choice is missing it fails, because the
 * entire point of a human gate is that the process stops until a person decides.
 * A role that could invent the decision would make the gate decorative.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = /^--([^=]+)=([\s\S]*)$/.exec(a);
    return m ? [[m[1], m[2]]] : [];
  })
);
if (!args.slug) {
  process.stderr.write('usage: decide.mjs --slug=X [--repoRoot=.]\n');
  process.exit(2);
}
const appDir = join(resolve(args.repoRoot ?? process.cwd()), args.slug);

/** Each axis the owner must decide, and the token that proves they did. */
const AXES = [
  { axis: 'logo', file: 'design-refs/logos/DECISION.md', token: 'CHOSEN' },
  { axis: 'palette', file: 'design-refs/palettes/DECISION.md', token: 'CHOSEN' },
  { axis: 'layout', file: 'design-refs/design-options/DECISION.md', token: 'DECIDED' }
];

const missing = [];
const recorded = [];
for (const a of AXES) {
  const p = join(appDir, a.file);
  if (!existsSync(p)) {
    missing.push(`${a.axis}: no ${a.file}`);
    continue;
  }
  const text = readFileSync(p, 'utf8');
  // A STRUCTURED marker, not a bare word. Matching the word alone reported a
  // decision from the line "not chosen, not shortlisted by default" -- a
  // document saying nothing was chosen was read as a choice. Same shape as the
  // brief failed for the phrase "not emoji or letter placeholders". The marker
  // must be followed by a colon and a value, which prose about choosing is not.
  const marker = new RegExp(`\\*{0,2}${a.token}\\*{0,2}\\s*:\\s*\\S+`, 'i');
  const line = text.split('\n').find((l) => marker.test(l)) ?? '';
  if (!line) {
    missing.push(
      `${a.axis}: ${a.file} records no "${a.token}: <value>" -- the owner has not picked`
    );
    continue;
  }
  recorded.push({ axis: a.axis, file: a.file, choice: line.trim().slice(0, 160) });
}

if (missing.length) {
  process.stderr.write(`decide: the owner has not decided ${missing.length} axis/axes:\n`);
  for (const m of missing) process.stderr.write(`  - ${m}\n`);
  process.stderr.write('This role records a decision; it cannot make one. Waiting on the owner.\n');
  process.exit(1);
}

mkdirSync(join(appDir, 'evidence'), { recursive: true });
writeFileSync(
  join(appDir, 'evidence', 'decisions.json'),
  JSON.stringify({ recordedAt: new Date().toISOString(), decisions: recorded }, null, 2) + '\n'
);
console.log(`decide: ${recorded.length} axis/axes recorded -- ${recorded.map((r) => r.axis).join(', ')}`);
