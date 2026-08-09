#!/usr/bin/env node
/**
 * The `qa-data` role: every citation and link must resolve.
 *
 * A dead citation is indistinguishable from a fabricated one to a reader, which
 * is why this is its own role rather than a line in a checklist.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).flatMap((a) => {
  const m = /^--([^=]+)=([\s\S]*)$/.exec(a); return m ? [[m[1], m[2]]] : [];
}));
if (!args.slug) { process.stderr.write('usage: qa-data.mjs --slug=X\n'); process.exit(2); }
const appDir = join(resolve(args.repoRoot ?? process.cwd()), args.slug);

const docsDir = join(appDir, 'docs');
const urls = new Set();
if (existsSync(docsDir)) {
  for (const e of readdirSync(docsDir, { withFileTypes: true, recursive: true })) {
    if (!e.isFile() || !/\.(md|json)$/.test(e.name)) continue;
    let text = readFileSync(join(e.parentPath ?? e.path, e.name), 'utf8');
    // Strip code spans and fenced blocks first. A URL inside `curl -sf
    // http://127.0.0.1:<port>/api/health` is a verification COMMAND, not a
    // citation, and reporting it as a dead link is checking the wrong thing --
    // the same false-positive shape as failing a document for naming the
    // markers it forbids.
    text = text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
    for (const m of text.matchAll(/https?:\/\/[^\s)\]"'<>]+/g)) {
      const url = m[0].replace(/[.,]$/, '');
      // Local and placeholder hosts are examples by definition; they are not
      // expected to resolve from CI or from a reader's machine.
      if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|example\.(com|org))/i.test(url)) continue;
      if (/<[a-z-]+>/i.test(url)) continue; // templated, e.g. https://<project>.pages.dev
      urls.add(url);
    }
  }
}

const checked = [];
for (const u of [...urls].slice(0, 40)) {
  try {
    // HEAD first; some hosts reject it, so fall back to a ranged GET rather than
    // recording a false dead link.
    let res = await fetch(u, { method: 'HEAD', redirect: 'follow' });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(u, { method: 'GET', headers: { range: 'bytes=0-64' }, redirect: 'follow' });
    }
    checked.push({ url: u, status: res.status, ok: res.status < 400 });
  } catch (err) {
    checked.push({ url: u, status: 0, ok: false, error: String(err).slice(0, 80) });
  }
}

mkdirSync(join(appDir, 'evidence'), { recursive: true });
const dead = checked.filter((c) => !c.ok);
writeFileSync(join(appDir, 'evidence', 'link-check.json'),
  JSON.stringify({ checkedAt: new Date().toISOString(), checked: checked.length, dead: dead.length, results: checked }, null, 2) + '\n');
console.log(`qa-data: checked ${checked.length} link(s), ${dead.length} dead`);
if (dead.length) { for (const d of dead.slice(0, 5)) console.log(`  DEAD ${d.status} ${d.url}`); process.exit(1); }
