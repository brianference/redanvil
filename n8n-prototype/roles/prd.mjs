#!/usr/bin/env node
/**
 * The `prd` role: generate a PRD by DRIVING the deployed RedAnvil app-builder.
 *
 * The owner's standing instruction is that every app starts from a PRD produced
 * by https://redanvil.pages.dev/. There is no API shortcut -- /api/prd and
 * /api/generate are SPA fallback, returning the same HTML as a nonsense path,
 * and only /api/health answers JSON. So this drives the real wizard, which also
 * means every new app dogfoods the product.
 *
 * Writes docs/PRD.md and docs/prd-provenance.json. The provenance file exists
 * because a hand-written PRD is otherwise indistinguishable from a generated
 * one, and hand-writing it is exactly the shortcut this role prevents.
 *
 * Usage: node roles/prd.mjs --slug=sushi-finder --repoRoot=... --prompt="..."
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const BUILDER_URL = 'https://redanvil.pages.dev/';

/**
 * Parse `--key=value` arguments.
 * @param {string[]} argv raw args
 * @returns {Record<string,string>} parsed
 */
function parseArgs(argv) {
  /** @type {Record<string,string>} */
  const out = {};
  for (const a of argv) {
    const m = /^--([^=]+)=([\s\S]*)$/.exec(a);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/**
 * Preferred answers, tried in order against whatever the wizard offers.
 *
 * The wizard asks its questions as button groups rather than named fields, so an
 * answer is chosen by label. Anything unmatched falls through to the first
 * option, and every choice is recorded in provenance so the PRD's inputs are
 * auditable rather than implied.
 */
const PREFERRED = [
  'Marketplace',
  'Mobile app',
  'Yes',
  'Consumer',
  'Public',
  'Search',
  'Map'
];

/**
 * Click the best available answer in the current question, if any.
 * @param {import('playwright').Page} page the wizard page
 * @param {string[]} chosen accumulator of recorded choices
 * @returns {Promise<boolean>} whether an answer was clicked
 */
async function answerQuestion(page, chosen) {
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .map((b) => (b.textContent || '').trim())
      .filter((t) => t && !/^(☾|☰|✕|Back|Next|Send description)$/.test(t))
  );
  if (labels.length === 0) return false;

  const pick = PREFERRED.find((p) => labels.includes(p)) ?? labels[0];
  await page.getByRole('button', { name: pick, exact: true }).first().click();
  chosen.push(pick);
  return true;
}

const args = parseArgs(process.argv.slice(2));
const slug = args.slug;
const prompt = args.prompt;
if (!slug || !prompt) {
  process.stderr.write('usage: prd.mjs --slug=X --prompt="..." [--repoRoot=.]\n');
  process.exit(2);
}
const repoRoot = resolve(args.repoRoot ?? process.cwd());
const docsDir = join(repoRoot, slug, 'docs');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 1000 });

/** @type {string[]} */
const chosen = [];
await page.goto(BUILDER_URL, { waitUntil: 'networkidle' });
await page.locator('#composer-prompt').fill(prompt);
await page.getByRole('button', { name: /send description/i }).click();

// Walk the question sequence. Bounded, because an unbounded loop against a
// wizard that stops advancing would hang the role rather than fail it.
let markdown = '';
for (let step = 0; step < 12; step += 1) {
  await page.waitForTimeout(1200);
  const done = await page.evaluate(() => /product requirements|## 1\.|# PRD/i.test(document.body.innerText));
  if (done) {
    markdown = await page.evaluate(() => {
      const pre = document.querySelector('pre, article, [class*=prd], [class*=markdown]');
      return (pre?.textContent ?? document.body.innerText).trim();
    });
    break;
  }
  const answered = await answerQuestion(page, chosen);
  const next = page.getByRole('button', { name: /^next$/i }).first();
  if (await next.count()) await next.click().catch(() => {});
  else if (!answered) break;
}

await browser.close();

if (markdown.length < 2000) {
  process.stderr.write(
    `wizard produced ${markdown.length} chars, below the 2000 floor -- refusing to write a stub PRD\n`
  );
  process.exit(1);
}

mkdirSync(docsDir, { recursive: true });
writeFileSync(join(docsDir, 'PRD.md'), markdown + '\n');
writeFileSync(
  join(docsDir, 'prd-provenance.json'),
  JSON.stringify(
    {
      source: BUILDER_URL,
      generatedBy: 'roles/prd.mjs driving the deployed wizard with Playwright',
      generatedAt: new Date().toISOString(),
      prompt,
      wizardAnswers: chosen,
      characters: markdown.length
    },
    null,
    2
  ) + '\n'
);

console.log(`PRD written: ${markdown.length} chars, wizard answers: ${chosen.join(', ') || '(none)'}`);
