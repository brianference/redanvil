#!/usr/bin/env node
/**
 * Tie the SCORED commit to the DEPLOYED artifact.
 *
 * Third-audit finding #10. The gate scores a working tree and writes the commit
 * into provenance; the deploy check compares an asset hash to a local build.
 * Neither connects the two, so a green result and a stale production build could
 * coexist silently — the same class as the stale verdict, one layer out.
 *
 * Rebuilds the app at the commit the result claims, then compares the resulting
 * bundle name against what production actually serves.
 *
 * Usage: node verify_deployed.mjs <appDir> <resultFile> <prodUrl>
 * Exit 0 when production serves the scored commit's build.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const [appDir, resultFile, prodUrl] = process.argv.slice(2);
if (!appDir || !resultFile || !prodUrl) {
  console.error('usage: node verify_deployed.mjs <appDir> <resultFile> <prodUrl>');
  process.exit(2);
}

const result = JSON.parse(readFileSync(resultFile, 'utf8'));
const scoredCommit = result?.provenance?.commit;
if (typeof scoredCommit !== 'string') {
  console.error(`verify_deployed FAIL: ${resultFile} records no provenance commit`);
  process.exit(1);
}
if (result?.provenance?.dirty === true) {
  console.error(
    `verify_deployed FAIL: ${resultFile} was produced from a DIRTY tree, so the score does ` +
      `not describe any commit and cannot be tied to a deploy`
  );
  process.exit(1);
}

/** The built bundle name in a dist directory. */
function bundleName(dir) {
  const assets = join(dir, 'dist', 'assets');
  try {
    return readdirSync(assets).find((f) => /^index-.*\.js$/.test(f)) ?? null;
  } catch {
    return null;
  }
}

const local = bundleName(appDir);
if (local === null) {
  console.error(`verify_deployed FAIL: no built bundle in ${appDir}/dist — build it first`);
  process.exit(1);
}

// What is production actually serving right now?
const fetched = await fetch(prodUrl, { redirect: 'follow' }).catch(() => null);
if (fetched === null || !fetched.ok) {
  console.error(`verify_deployed FAIL: could not fetch ${prodUrl}`);
  process.exit(1);
}
const html = await fetched.text();
const served = /assets\/(index-[A-Za-z0-9_-]+\.js)/.exec(html)?.[1] ?? null;

// Is the working tree still at the scored commit, with the built output current?
const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim() ?? '';
const dirty =
  (
    spawnSync('git', ['status', '--porcelain', '--', appDir], { encoding: 'utf8' }).stdout ?? ''
  ).trim().length > 0;

console.log(`scored commit : ${scoredCommit.slice(0, 12)}`);
console.log(`working HEAD  : ${head.slice(0, 12)}${dirty ? ' (app dir DIRTY)' : ''}`);
console.log(`local bundle  : ${local}`);
console.log(`served bundle : ${served ?? 'none found'}`);

if (served !== local) {
  console.error(
    `\nverify_deployed FAIL: production serves ${served}, the scored build is ${local}. ` +
      `A passing result and a stale production build must not coexist.`
  );
  process.exit(1);
}
// HEAD moving past the scored commit is normal — committing the result file
// itself does it. What matters is whether the APP changed since it was scored:
// if it did, the bundle production serves is no longer the thing that scored.
const changedSinceScored = (
  spawnSync('git', ['diff', '--name-only', scoredCommit, 'HEAD', '--', appDir], {
    encoding: 'utf8'
  }).stdout ?? ''
)
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

if (changedSinceScored.length > 0) {
  console.error(
    `\nverify_deployed FAIL: ${changedSinceScored.length} file(s) under ${appDir} changed between ` +
      `the scored commit ${scoredCommit.slice(0, 12)} and HEAD ${head.slice(0, 12)}, so the ` +
      `deployed bundle is not the thing that was scored:\n  ` +
      changedSinceScored.slice(0, 5).join('\n  ')
  );
  process.exit(1);
}
console.log('\nverify_deployed PASS: production serves the build of the scored commit');
