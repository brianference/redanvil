#!/usr/bin/env node
/**
 * The `ship` role: deploy and PROVE the served asset hash matches the build.
 *
 * A wrangler success message is not proof. A matching asset hash is. This
 * records the claim only after fetching production and comparing, because
 * "deployed" and "serving what you built" are different facts and the gap
 * between them has bitten this project repeatedly.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).flatMap((a) => {
  const m = /^--([^=]+)=([\s\S]*)$/.exec(a); return m ? [[m[1], m[2]]] : [];
}));
if (!args.slug) { process.stderr.write('usage: ship.mjs --slug=X\n'); process.exit(2); }
const appDir = join(resolve(args.repoRoot ?? process.cwd()), args.slug);
const dist = join(appDir, 'dist', 'assets');
if (!existsSync(dist)) { process.stderr.write('no dist/assets -- nothing built to ship\n'); process.exit(1); }

const localJs = readdirSync(dist).find((f) => /^index-.*\.js$/.test(f));
if (!localJs) { process.stderr.write('no index-*.js in dist/assets\n'); process.exit(1); }

const project = args.project ?? args.slug;
const branch = args.branch ?? 'main';
const deploy = spawnSync(
  `npx wrangler pages deploy dist --project-name=${project} --branch=${branch} --commit-dirty=true`,
  { cwd: appDir, shell: true, encoding: 'utf8', timeout: 15 * 60 * 1000 }
);
process.stdout.write((deploy.stdout ?? '').trim().split('\n').slice(-1)[0] + '\n');

const url = args.url ?? `https://${project}.pages.dev`;
// Give the alias a moment; propagation lag has twice made a correct deploy look
// like a failed one.
await new Promise((r) => setTimeout(r, 6000));
const html = await fetch(url).then((r) => r.text()).catch(() => '');
const prodJs = (html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/) ?? [])[1];

const matched = prodJs === localJs;
mkdirSync(join(appDir, '.redanvil'), { recursive: true });
writeFileSync(join(appDir, '.redanvil', 'claims.json'),
  JSON.stringify({ deployUrl: url, localAsset: localJs, servedAsset: prodJs ?? null, assetHashMatches: matched, shippedAt: new Date().toISOString() }, null, 2) + '\n');

console.log(`ship: local ${localJs} | prod ${prodJs ?? 'NONE'} | ${matched ? 'MATCH' : 'MISMATCH'}`);
process.exit(matched ? 0 : 1);
