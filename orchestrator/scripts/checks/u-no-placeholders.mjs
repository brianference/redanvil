#!/usr/bin/env node
/**
 * u-no-placeholders — nothing user-visible may be a stand-in (R32).
 *
 * Usage: node u-no-placeholders.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = not applicable.
 *
 * Why: a scaffold emitted `body: '<Name> page for <slug>.'` and four
 * one-sentence legal pages shipped, passing every check. That template was not
 * an unfinished shortcut — a stub was its finished output. A placeholder that
 * renders as a plausible sentence is indistinguishable from real copy to
 * everyone except the person who wrote the template.
 *
 * Scans the locale bundle and page sources, because that is where user-visible
 * copy lives. Deliberately does NOT scan tests or fixtures: "example" is a
 * legitimate word in a test.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Where user-visible copy lives. */
const COPY_DIRS = [join('src', 'i18n'), join('src', 'pages'), join('src', 'components')];

/**
 * Placeholder shapes, each with what to say when it is found.
 *
 * The generated-stub pattern is first because it is the one that actually
 * shipped.
 */
const PATTERNS = [
  {
    // Anchored to the WHOLE string literal. Unanchored, this matched the middle
    // of real prose -- "Read the Privacy policy page for what we collect" -- and
    // would have had a correct sentence reworded to satisfy the checker. The
    // stub it exists for WAS the entire value: `body: 'About page for demo-app.'`
    re: /(['"`])\s*[A-Z]\w* page for [a-z0-9-]+\.?\s*\1/,
    why: 'a generated page stub ("<Name> page for <slug>") — R32: a template must emit real copy or something that fails a check, never a plausible sentence'
  },
  { re: /lorem\s+ipsum/i, why: 'lorem ipsum' },
  { re: /\bTBD\b|\bFIXME\b/, why: 'an unfinished marker in user-visible copy' },
  { re: /coming soon/i, why: '"coming soon" — ship the thing or do not link to it' },
  { re: /\bplaceholder text\b/i, why: 'literal placeholder text' },
  {
    re: /href=(["'])#\1/,
    why: 'href="#" — a link that goes nowhere reads as a working control'
  },
  {
    re: /\b(Example|Sample|Foo|Bar|Baz|Dummy|Test) (Item|Product|Name|Title|Company|User)\b/,
    why: 'a stand-in noun in user-visible copy'
  },
  { re: /your (company|product|app) name here/i, why: 'an unfilled brand slot' }
];

/** Every source file under dir. */
function filesIn(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...filesIn(full));
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(full);
  }
  return out;
}

/**
 * Run the check.
 *
 * @param {string} appDir App directory.
 * @param {{pass:()=>never, fail:(m?:string)=>never, notApplicable:(w?:string)=>never}} io
 */
export function runNoPlaceholders(appDir, io) {
  const files = COPY_DIRS.flatMap((d) => filesIn(join(appDir, d)));
  if (files.length === 0) io.notApplicable('no copy or page sources in this app');

  const hits = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const lines = src.split('\n');
    for (const { re, why } of PATTERNS) {
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        // A comment explaining the rule is not a violation of it.
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
        const m = re.exec(line);
        if (m) {
          hits.push(`${relative(appDir, file)}:${i + 1} ${why} — "${m[0].slice(0, 60)}"`);
          break;
        }
      }
    }
  }

  if (hits.length > 0) {
    io.fail(
      `${hits.length} placeholder(s) in user-visible copy:\n  ${hits.slice(0, 8).join('\n  ')}`
    );
  }
  io.pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node u-no-placeholders.mjs <appDir>');
    process.exit(2);
  }
  runNoPlaceholders(dir, {
    pass: () => process.exit(0),
    fail: (m) => {
      if (m) console.error(m);
      process.exit(1);
    },
    notApplicable: (w) => {
      if (w) console.error(`n/a: ${w}`);
      process.exit(3);
    }
  });
}
