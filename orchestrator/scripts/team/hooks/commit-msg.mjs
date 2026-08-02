#!/usr/bin/env node
/**
 * Worktree commit-msg: reject messages claiming done/complete/finished/working/
 * verified/passing unless the role's measurement artifact exists and records pass.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const worktreeDir = process.cwd();
const msgFile = process.argv[2];
if (!msgFile || !existsSync(msgFile)) {
  console.error('commit-msg: missing commit message file argument');
  process.exit(1);
}

const message = readFileSync(msgFile, 'utf8');
const lib = join(dirname(fileURLToPath(import.meta.url)), 'lib-enforcement.mjs');
if (!existsSync(lib)) {
  console.error('commit-msg: missing lib-enforcement.mjs');
  process.exit(1);
}

const { evaluateCommitMsg } = await import(pathToFileURL(lib).href);
const result = evaluateCommitMsg(worktreeDir, message);

if (!result.ok) {
  console.error('commit-msg: REFUSED');
  for (const r of result.reasons) console.error(`  - ${r}`);
  process.exit(1);
}

process.exit(0);
