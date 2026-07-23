#!/usr/bin/env node
/**
 * Fail the build when the repo's design-rules copy drifts from the skill source.
 *
 * `rules/per-app-pack.md` points builders at the REPO copy, so a stale copy is
 * what actually reaches the coder. The repo copy was two versions behind and was
 * missing the only section that explains how to use `notApplicable` correctly.
 * Same drift class the results verifier already guards for — a second copy of a
 * source of truth is a source of truth that will silently diverge.
 *
 * The skill lives outside the repo, so this only runs where it is present.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

const repoCopy = 'design-system/mobile-design-rules.md';
const skillCopy = join(homedir(), '.claude/skills/mobile-ux/references/mobile-design-rules.md');

if (!existsSync(skillCopy)) {
  console.log(`design-rules check skipped: no skill copy at ${skillCopy}`);
  process.exit(0);
}

/** SHA-256 of a file with line endings normalized, so CRLF/LF is not drift. */
const hash = (p) =>
  createHash('sha256').update(readFileSync(p, 'utf8').replace(/\r\n/g, '\n')).digest('hex');

const a = hash(repoCopy);
const b = hash(skillCopy);
if (a !== b) {
  console.error(
    `DESIGN RULES DRIFT: ${repoCopy} (${a.slice(0, 12)}) differs from the skill source (${b.slice(0, 12)}).\n` +
      `  Builders read the repo copy, so a stale copy ships stale rules.\n` +
      `  Fix: cp "${skillCopy}" ${repoCopy}`
  );
  process.exit(1);
}
console.log('design rules match the skill source');
